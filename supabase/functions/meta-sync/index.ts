import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// meta-sync: descobre contas e sincroniza campanhas, conjuntos, anúncios e métricas diárias do Meta Ads.
// Autenticação: header x-sync-secret igual ao segredo "meta_sync_secret" guardado no Vault.
// Corpo (POST JSON):
//   { "mode": "discover" }
//   { "mode": "sync", "meta_account_id": "act_123", "days": 7 }   (sem meta_account_id = todas as contas com is_selected)
//   { "mode": "sync", "since": "2026-09-01", "until": "2026-09-23" }

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const META_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN");
const META_API_VERSION = Deno.env.get("META_API_VERSION") || "v26.0";
const GRAPH = `https://graph.facebook.com/${META_API_VERSION}`;

type Row = Record<string, unknown>;
type Account = { id: string; meta_account_id: string; name: string | null; timezone_name: string | null };

const json = (body: unknown, status = 200) => Response.json(body, { status });

// ---------- Supabase REST ----------
const sbHeaders = {
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  apikey: SERVICE_ROLE_KEY,
  "Content-Type": "application/json",
};

async function sb(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...sbHeaders, ...(init.headers as Record<string, string> | undefined) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${path.split("?")[0]} ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

async function upsert(table: string, rows: Row[], onConflict: string, returning = false): Promise<Row[]> {
  const out: Row[] = [];
  for (let i = 0; i < rows.length; i += 500) {
    const data = await sb(`${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
      method: "POST",
      headers: { Prefer: `resolution=merge-duplicates,return=${returning ? "representation" : "minimal"}` },
      body: JSON.stringify(rows.slice(i, i + 500)),
    });
    if (returning && Array.isArray(data)) out.push(...data);
  }
  return out;
}

async function startRun(mode: "discover" | "sync", adAccountId: string | null, details: Row): Promise<string | null> {
  try {
    const data = await sb("meta_sync_runs", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ mode, ad_account_id: adAccountId, status: "running", details }),
    });
    return data?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function finishRun(id: string | null, status: "success" | "error", rows: number, error?: string) {
  if (!id) return;
  try {
    await sb(`meta_sync_runs?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status, rows_upserted: rows, finished_at: new Date().toISOString(), error_message: error ?? null }),
    });
  } catch { /* log de execução não pode derrubar a sincronização */ }
}

// ---------- Meta Graph API ----------
class MetaError extends Error {
  constructor(message: string, public code?: number) { super(message); }
}

async function metaGet(pathOrUrl: string): Promise<any> {
  const url = new URL(pathOrUrl.startsWith("http") ? pathOrUrl : `${GRAPH}/${pathOrUrl.replace(/^\//, "")}`);
  if (!url.searchParams.has("access_token")) url.searchParams.set("access_token", META_ACCESS_TOKEN!);
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (res.ok && !data?.error) return data;
    const code = data?.error?.code;
    const transient = data?.error?.is_transient || [1, 2, 4, 17, 32, 613, 80000, 80004].includes(code);
    if (transient && attempt < 2) {
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
      continue;
    }
    throw new MetaError(data?.error?.message || `Meta HTTP ${res.status}`, code);
  }
  throw new MetaError("Meta: tentativas esgotadas");
}

async function metaAll(path: string): Promise<any[]> {
  const rows: any[] = [];
  let next: string | undefined = path;
  while (next) {
    const page = await metaGet(next);
    rows.push(...(page.data || []));
    next = page.paging?.next;
  }
  return rows;
}

// ---------- helpers ----------
const num = (v: unknown) => (v === undefined || v === null || v === "" ? null : Number(v));
const int = (v: unknown) => (v === undefined || v === null || v === "" ? 0 : Math.round(Number(v)));
// Orçamentos vêm em centavos da moeda da conta (BRL): divide por 100.
const money = (v: unknown) => (v === undefined || v === null || v === "" ? null : Number(v) / 100);
const fundingText = (a: any) => {
  const d = a?.funding_source_details ?? {};
  return [d?.type, d?.display_string, d?.name, d?.funding_source_type].filter(Boolean).join(" ").toLowerCase();
};

function classifyBilling(a: any): string | null {
  if (a?.is_prepay_account === true) return "PRE_PAGO";
  const t = fundingText(a);
  if (/pix/.test(t)) return "PIX";
  if (/card|cart[aã]o|visa|mastercard|master card|amex|american express|elo/.test(t)) return "CARTAO";
  if (/invoice|invoicing|credit line|credit_line|fatur/.test(t)) return "FATURAMENTO";
  if (a?.is_prepay_account === false) return "COBRANCA_AUTOMATICA";
  return null;
}

function financialFields(a: any, now: string): Row {
  const d = a?.funding_source_details ?? null;
  return {
    amount_spent_total: money(a?.amount_spent),
    balance: money(a?.balance),
    spend_cap: money(a?.spend_cap),
    is_prepay_account: typeof a?.is_prepay_account === "boolean" ? a.is_prepay_account : null,
    billing_type: classifyBilling(a),
    payment_method_label: d?.display_string ?? d?.name ?? d?.type ?? null,
    funding_source_details: d,
    financial_synced_at: now,
  };
}

async function fetchAccountDetails(act: string): Promise<any> {
  const core = "id,account_id,name,currency,timezone_name,account_status,amount_spent,balance,spend_cap";
  try {
    return await metaGet(`${act}?fields=${core},is_prepay_account,funding_source_details`);
  } catch (e) {
    if (e instanceof MetaError) return await metaGet(`${act}?fields=${core}`);
    throw e;
  }
}

const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

function ymd(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function dateRange(body: any, tz: string) {
  if (body.since && body.until) return { since: String(body.since), until: String(body.until) };
  const days = Math.min(Math.max(Number(body.days) || 7, 1), 90);
  const now = new Date();
  return { since: ymd(new Date(now.getTime() - (days - 1) * 86_400_000), tz), until: ymd(now, tz) };
}

// "results" = coluna Resultados do Gerenciador de Anúncios (indicator + values).
function parseResult(results: any): { indicator: string | null; count: number | null } {
  if (!Array.isArray(results) || results.length === 0) return { indicator: null, count: null };
  const r = results[0];
  const v = Array.isArray(r?.values) && r.values.length ? Number(r.values[0]?.value) : NaN;
  return { indicator: r?.indicator ?? null, count: Number.isFinite(v) ? v : null };
}

// ---------- descoberta ----------
async function discover() {
  const runId = await startRun("discover", null, { api_version: META_API_VERSION });
  try {
    const accounts = await metaAll("me/adaccounts?fields=id,account_id,name,currency,timezone_name,account_status&limit=100");
    const now = new Date().toISOString();
    const enriched = [];
    for (const a of accounts) {
      try {
        const details = await fetchAccountDetails(a.id);
        enriched.push({ ...a, ...details });
      } catch {
        enriched.push(a);
      }
    }
    const rows = enriched.map((a) => ({
      meta_account_id: a.id,
      account_id: a.account_id ?? null,
      name: a.name ?? null,
      currency: a.currency ?? null,
      timezone_name: a.timezone_name ?? null,
      account_status: a.account_status ?? null,
      ...financialFields(a, now),
      updated_at: now,
    }));
    await upsert("meta_ad_accounts", rows, "meta_account_id");
    await finishRun(runId, "success", rows.length);
    return { ok: true, discovered: rows.length, accounts: rows.map((r) => ({ id: r.meta_account_id, name: r.name })) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finishRun(runId, "error", 0, msg);
    throw e;
  }
}

// ---------- sincronização ----------
const INSIGHT_BASE = "spend,impressions,reach,frequency,clicks,inline_link_clicks,ctr,cpc,cpm,actions,action_values,cost_per_action_type";
const LEVEL_FIELDS: Record<string, string> = {
  account: `account_id,${INSIGHT_BASE}`,
  campaign: `campaign_id,campaign_name,objective,${INSIGHT_BASE}`,
  adset: `campaign_id,campaign_name,adset_id,adset_name,objective,${INSIGHT_BASE}`,
  ad: `campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,objective,${INSIGHT_BASE}`,
};

async function fetchInsights(act: string, level: string, since: string, until: string): Promise<any[]> {
  const tr = encodeURIComponent(JSON.stringify({ since, until }));
  const build = (withResults: boolean) =>
    `${act}/insights?level=${level}&time_increment=1&time_range=${tr}&use_unified_attribution_setting=true` +
    `&fields=${LEVEL_FIELDS[level]}${withResults ? ",results,cost_per_result" : ""}&limit=500`;
  try {
    return await metaAll(build(true));
  } catch (e) {
    // Se a Meta recusar o campo "results" neste nível, busca sem ele.
    if (e instanceof MetaError && /result/i.test(e.message)) return await metaAll(build(false));
    throw e;
  }
}

async function syncAccount(acc: Account, body: any) {
  const tz = acc.timezone_name || "America/Sao_Paulo";
  const { since, until } = dateRange(body, tz);
  const runId = await startRun("sync", acc.id, { api_version: META_API_VERSION, since, until });
  const act = acc.meta_account_id;
  const now = new Date().toISOString();
  let total = 0;

  try {
    // Dados financeiros da conta (somente leitura)
    try {
      const accountDetails = await fetchAccountDetails(act);
      await sb(`meta_ad_accounts?id=eq.${acc.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...financialFields(accountDetails, now), updated_at: now }),
      });
    } catch { /* métricas de mídia continuam mesmo se detalhes financeiros não estiverem disponíveis */ }

    // Campanhas
    const campaigns = await metaAll(
      `${act}/campaigns?fields=id,name,status,effective_status,objective,buying_type,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time&limit=200`,
    );
    const campSaved = await upsert(
      "meta_campaigns",
      campaigns.map((c) => ({
        ad_account_id: acc.id,
        meta_campaign_id: c.id,
        name: c.name ?? null,
        status: c.status ?? null,
        effective_status: c.effective_status ?? null,
        objective: c.objective ?? null,
        buying_type: c.buying_type ?? null,
        daily_budget: money(c.daily_budget),
        lifetime_budget: money(c.lifetime_budget),
        start_time: iso(c.start_time),
        stop_time: iso(c.stop_time),
        meta_created_time: iso(c.created_time),
        meta_updated_time: iso(c.updated_time),
        last_synced_at: now,
      })),
      "meta_campaign_id",
      true,
    );
    const campMap = new Map(campSaved.map((r) => [r.meta_campaign_id as string, r.id as string]));
    total += campaigns.length;

    // Conjuntos
    const adsets = await metaAll(
      `${act}/adsets?fields=id,name,campaign_id,status,effective_status,optimization_goal,billing_event,daily_budget,lifetime_budget,targeting,start_time,end_time,created_time,updated_time&limit=200`,
    );
    const adsetSaved = await upsert(
      "meta_adsets",
      adsets.map((s) => ({
        ad_account_id: acc.id,
        campaign_id: campMap.get(s.campaign_id) ?? null,
        meta_adset_id: s.id,
        meta_campaign_id: s.campaign_id ?? null,
        name: s.name ?? null,
        status: s.status ?? null,
        effective_status: s.effective_status ?? null,
        optimization_goal: s.optimization_goal ?? null,
        billing_event: s.billing_event ?? null,
        daily_budget: money(s.daily_budget),
        lifetime_budget: money(s.lifetime_budget),
        targeting: s.targeting ?? null,
        start_time: iso(s.start_time),
        end_time: iso(s.end_time),
        meta_created_time: iso(s.created_time),
        meta_updated_time: iso(s.updated_time),
        last_synced_at: now,
      })),
      "meta_adset_id",
      true,
    );
    const adsetMap = new Map(adsetSaved.map((r) => [r.meta_adset_id as string, r.id as string]));
    total += adsets.length;

    // Anúncios
    const ads = await metaAll(
      `${act}/ads?fields=id,name,campaign_id,adset_id,status,effective_status,creative{id},created_time,updated_time&limit=200`,
    );
    await upsert(
      "meta_ads",
      ads.map((a) => ({
        ad_account_id: acc.id,
        campaign_id: campMap.get(a.campaign_id) ?? null,
        adset_id: adsetMap.get(a.adset_id) ?? null,
        meta_ad_id: a.id,
        meta_campaign_id: a.campaign_id ?? null,
        meta_adset_id: a.adset_id ?? null,
        name: a.name ?? null,
        status: a.status ?? null,
        effective_status: a.effective_status ?? null,
        creative_id: a.creative?.id ?? null,
        meta_created_time: iso(a.created_time),
        meta_updated_time: iso(a.updated_time),
        last_synced_at: now,
      })),
      "meta_ad_id",
    );
    total += ads.length;

    // Métricas diárias por nível
    for (const level of ["account", "campaign", "adset", "ad"]) {
      const rows = await fetchInsights(act, level, since, until);
      const mapped = rows.map((r) => {
        const entityId = level === "account" ? act : level === "campaign" ? r.campaign_id : level === "adset" ? r.adset_id : r.ad_id;
        const entityName = level === "account" ? acc.name : level === "campaign" ? r.campaign_name : level === "adset" ? r.adset_name : r.ad_name;
        const { indicator, count } = parseResult(r.results);
        return {
          ad_account_id: acc.id,
          level,
          entity_id: String(entityId),
          entity_name: entityName ?? null,
          date_start: r.date_start,
          date_stop: r.date_stop,
          meta_campaign_id: r.campaign_id ?? null,
          meta_adset_id: r.adset_id ?? null,
          objective: r.objective ?? null,
          spend: Number(r.spend ?? 0),
          impressions: int(r.impressions),
          reach: int(r.reach),
          frequency: num(r.frequency),
          clicks: int(r.clicks),
          inline_link_clicks: int(r.inline_link_clicks),
          ctr: num(r.ctr),
          cpc: num(r.cpc),
          cpm: num(r.cpm),
          actions: r.actions ?? [],
          action_values: r.action_values ?? [],
          cost_per_action_type: r.cost_per_action_type ?? [],
          results: r.results ?? [],
          cost_per_result: r.cost_per_result ?? [],
          result_indicator: indicator,
          result_count: count,
          raw: r,
          synced_at: now,
        };
      });
      await upsert("meta_insights_daily", mapped, "ad_account_id,level,entity_id,date_start,date_stop");
      total += mapped.length;
    }

    await sb(`meta_ad_accounts?id=eq.${acc.id}`, {
      method: "PATCH",
      body: JSON.stringify({ last_synced_at: now, updated_at: now }),
    });
    await finishRun(runId, "success", total);
    return { account: act, name: acc.name, ok: true, rows: total, since, until };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finishRun(runId, "error", total, msg);
    return { account: act, name: acc.name, ok: false, error: msg, since, until };
  }
}

// ---------- entrada ----------
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });

  let expected: string | null = null;
  try {
    expected = await sb("rpc/meta_sync_secret", { method: "POST", body: "{}" });
  } catch {
    return json({ ok: false, error: "sync secret indisponível" }, 500);
  }
  if (!expected || req.headers.get("x-sync-secret") !== expected) return json({ ok: false, error: "unauthorized" }, 401);
  if (!META_ACCESS_TOKEN) return json({ ok: false, error: "META_ACCESS_TOKEN is not configured" }, 503);

  const body = await req.json().catch(() => ({}));
  const mode = body.mode ?? "sync";

  try {
    if (mode === "discover") return json(await discover());

    const filter = body.meta_account_id
      ? `meta_account_id=eq.${encodeURIComponent(body.meta_account_id)}`
      : "is_selected=eq.true";
    const accounts: Account[] = await sb(`meta_ad_accounts?select=id,meta_account_id,name,timezone_name&${filter}`);
    if (!accounts?.length) return json({ ok: false, error: "nenhuma conta encontrada/selecionada" }, 404);

    const results = [];
    for (const acc of accounts) results.push(await syncAccount(acc, body));
    const ok = results.every((r) => r.ok);
    return json({ ok, results }, ok ? 200 : 207);
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
