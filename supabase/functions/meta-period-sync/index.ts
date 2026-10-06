import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// meta-period-sync: métricas agregadas por período (alcance e frequência corretos) e criativos dos principais anúncios.
// Autenticação: header x-sync-secret igual ao segredo "meta_sync_secret" do Vault (mesmo da meta-sync).
// Corpo (POST JSON): { "meta_account_id": "act_123", "periods": [{"since":"2026-09-14","until":"2026-09-20"}], "top_ads": 6 }
// Versão 3: mode "reach" devolve alcance, impressões e investimento de um grupo de campanhas, sem repetir pessoas
//   { "mode": "reach", "meta_account_id": "act_123", "periods": [...], "campaign_ids": ["123", "456"] }  (só leitura, não grava nada)
// Versão 4: mode "followers" devolve novos seguidores do Instagram por período (conta do Instagram ligada à página que anuncia)
//   { "mode": "followers", "meta_account_id": "act_123", "periods": [...] }  (só leitura, não grava nada)

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const META_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN");
const META_API_VERSION = Deno.env.get("META_API_VERSION") || "v26.0";
const GRAPH = `https://graph.facebook.com/${META_API_VERSION}`;
const H = { Authorization: `Bearer ${KEY}`, apikey: KEY, "Content-Type": "application/json" };

const json = (b: unknown, s = 200) => Response.json(b, { status: s });

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers as Record<string, string> | undefined) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path.split("?")[0]} ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function upsert(table: string, rows: unknown[], onConflict: string) {
  for (let i = 0; i < rows.length; i += 500) {
    await rest(`${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows.slice(i, i + 500)),
    });
  }
}

class MetaError extends Error {}

async function metaGet(pathOrUrl: string): Promise<any> {
  const url = new URL(pathOrUrl.startsWith("http") ? pathOrUrl : `${GRAPH}/${pathOrUrl.replace(/^\//, "")}`);
  if (!url.searchParams.has("access_token")) url.searchParams.set("access_token", META_ACCESS_TOKEN!);
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (res.ok && !data?.error) return data;
    const code = data?.error?.code;
    const transient = data?.error?.is_transient || [1, 2, 4, 17, 32, 613, 80000, 80004].includes(code);
    if (transient && attempt < 2) { await new Promise((r) => setTimeout(r, 4000 * (attempt + 1))); continue; }
    throw new MetaError(data?.error?.message || `Meta HTTP ${res.status}`);
  }
  throw new MetaError("Meta: tentativas esgotadas");
}

async function metaAll(path: string): Promise<any[]> {
  const rows: any[] = [];
  let next: string | undefined = path;
  while (next) { const page = await metaGet(next); rows.push(...(page.data || [])); next = page.paging?.next; }
  return rows;
}

const num = (v: unknown) => (v === undefined || v === null || v === "" ? null : Number(v));
const int = (v: unknown) => (v === undefined || v === null || v === "" ? 0 : Math.round(Number(v)));

function parseResult(results: any) {
  if (!Array.isArray(results) || !results.length) return { indicator: null, count: null };
  const r = results[0];
  const v = Array.isArray(r?.values) && r.values.length ? Number(r.values[0]?.value) : NaN;
  return { indicator: r?.indicator ?? null, count: Number.isFinite(v) ? v : null };
}

function resultCount(r: any) {
  const p = parseResult(r.results);
  if (p.count !== null) return p.count;
  const lead = (r.actions ?? []).find((a: any) => a.action_type === "lead");
  return lead ? Number(lead.value) : 0;
}

const BASE = "spend,impressions,reach,frequency,clicks,inline_link_clicks,ctr,cpc,cpm,actions,action_values,purchase_roas";
const FIELDS: Record<string, string> = {
  account: `account_id,${BASE}`,
  campaign: `campaign_id,campaign_name,objective,${BASE}`,
  adset: `campaign_id,adset_id,adset_name,objective,${BASE}`,
  ad: `campaign_id,campaign_name,adset_id,ad_id,ad_name,objective,${BASE}`,
};

async function insights(act: string, level: string, since: string, until: string) {
  const tr = encodeURIComponent(JSON.stringify({ since, until }));
  const build = (withResults: boolean) =>
    `${act}/insights?level=${level}&time_range=${tr}&use_unified_attribution_setting=true&fields=${FIELDS[level]}${withResults ? ",results,cost_per_result" : ""}&limit=500`;
  try { return await metaAll(build(true)); } catch (e) {
    if (e instanceof MetaError && /result/i.test(e.message)) return await metaAll(build(false));
    throw e;
  }
}

// Alcance de um grupo de campanhas no período: a Meta conta cada pessoa uma vez só.
async function groupReach(act: string, period: { since: string; until: string }, campaignIds: string[]) {
  const tr = encodeURIComponent(JSON.stringify(period));
  const filtering = encodeURIComponent(JSON.stringify([{ field: "campaign.id", operator: "IN", value: campaignIds }]));
  const data = await metaAll(`${act}/insights?level=account&time_range=${tr}&fields=reach,impressions,spend,frequency&filtering=${filtering}&limit=50`);
  const r = data[0] ?? {};
  return { since: period.since, until: period.until, reach: int(r.reach), impressions: int(r.impressions), spend: Number(r.spend ?? 0), frequency: num(r.frequency) };
}

// Conta do Instagram que anuncia pela conta de anúncios: página mais usada nos anúncios com conta do Instagram ligada.
async function instagramOf(act: string) {
  const pages = await metaAll(`${act}/promote_pages?fields=id,name,instagram_business_account{id,username,followers_count}&limit=50`);
  const withIg = pages.filter((p: any) => p.instagram_business_account?.id);
  if (!withIg.length) {
    // Diagnóstico sem expor segredo: quantas páginas a conta devolveu e quais permissões o acesso tem.
    const perms = await metaAll("me/permissions").then((r) => r.filter((x: any) => x.status === "granted").map((x: any) => x.permission)).catch(() => []);
    throw new MetaError(`sem Instagram acessível: ${pages.length} página(s) devolvida(s); permissões: ${perms.join(", ") || "não informadas"}`);
  }
  if (withIg.length === 1) return withIg[0].instagram_business_account;
  const ads = await metaAll(`${act}/ads?fields=creative{object_story_spec{page_id}}&effective_status=${encodeURIComponent('["ACTIVE","PAUSED"]')}&limit=100`).catch(() => []);
  const freq: Record<string, number> = {};
  for (const a of ads) { const pid = a?.creative?.object_story_spec?.page_id; if (pid) freq[pid] = (freq[pid] ?? 0) + 1; }
  withIg.sort((a: any, b: any) => (freq[b.id] ?? 0) - (freq[a.id] ?? 0));
  return withIg[0].instagram_business_account;
}

const unix = (d: string, endOfDay = false) => Math.floor(new Date(`${d}T${endOfDay ? "23:59:59" : "00:00:00"}-03:00`).getTime() / 1000);

// Novos seguidores no período: follows_and_unfollows (seguiu / deixou de seguir); sem esse dado, soma diária de follower_count (últimos 30 dias).
async function followsIn(igId: string, period: { since: string; until: string }) {
  try {
    const d = await metaGet(`${igId}/insights?metric=follows_and_unfollows&period=day&metric_type=total_value&breakdown=follow_type&since=${unix(period.since)}&until=${unix(period.until, true)}`);
    const results = d?.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
    const get = (k: string) => { const r = results.find((x: any) => (x.dimension_values ?? []).includes(k)); return r ? Number(r.value) : 0; };
    if (results.length) return { since: period.since, until: period.until, follows: get("FOLLOWER"), unfollows: get("NON_FOLLOWER"), source: "follows_and_unfollows" };
  } catch { /* tenta a métrica diária */ }
  const d = await metaGet(`${igId}/insights?metric=follower_count&period=day&since=${unix(period.since)}&until=${unix(period.until, true)}`);
  const values = d?.data?.[0]?.values ?? [];
  return { since: period.since, until: period.until, follows: values.reduce((a: number, v: any) => a + Number(v.value ?? 0), 0), unfollows: null, source: "follower_count" };
}

async function syncAccount(acc: { id: string; meta_account_id: string; name: string }, periods: { since: string; until: string }[], topAds: number) {
  const act = acc.meta_account_id;
  const now = new Date().toISOString();
  let rows = 0;
  let adsForCreatives: any[] = [];
  for (const [pi, p] of periods.entries()) {
    const levels = pi === 0 ? ["account", "campaign", "adset", "ad"] : ["account", "campaign"];
    for (const level of levels) {
      const data = await insights(act, level, p.since, p.until);
      const mapped = data.map((r: any) => {
        const entity = level === "account" ? act : level === "campaign" ? r.campaign_id : level === "adset" ? r.adset_id : r.ad_id;
        const name = level === "account" ? acc.name : level === "campaign" ? r.campaign_name : level === "adset" ? r.adset_name : r.ad_name;
        const { indicator, count } = parseResult(r.results);
        return {
          ad_account_id: acc.id, level, entity_id: String(entity), entity_name: name ?? null,
          meta_campaign_id: r.campaign_id ?? null, since: p.since, until: p.until, objective: r.objective ?? null,
          spend: Number(r.spend ?? 0), impressions: int(r.impressions), reach: int(r.reach), frequency: num(r.frequency),
          clicks: int(r.clicks), inline_link_clicks: int(r.inline_link_clicks), ctr: num(r.ctr), cpc: num(r.cpc), cpm: num(r.cpm),
          actions: r.actions ?? [], action_values: r.action_values ?? [], purchase_roas: r.purchase_roas ?? [],
          results: r.results ?? [], result_indicator: indicator, result_count: count, raw: r, synced_at: now,
        };
      });
      await upsert("meta_period_insights", mapped, "ad_account_id,level,entity_id,since,until");
      rows += mapped.length;
      if (level === "ad" && pi === 0) {
        const bySpend = [...data].sort((a, b) => Number(b.spend ?? 0) - Number(a.spend ?? 0)).slice(0, topAds);
        const byResult = [...data].sort((a, b) => resultCount(b) - resultCount(a)).slice(0, topAds);
        const seen = new Set<string>();
        adsForCreatives = [...byResult, ...bySpend].filter((a) => {
          const k = String(a.ad_id);
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
      }
    }
  }

  // Criativos dos principais anúncios da semana (miniatura grande e texto)
  const creatives = [];
  for (const ad of adsForCreatives) {
    try {
      const a = await metaGet(`${ad.ad_id}?fields=name,creative{id,object_type,title,body,image_url,thumbnail_url}`);
      let thumb = a?.creative?.thumbnail_url ?? null;
      if (a?.creative?.id) {
        try {
          const big = await metaGet(`${a.creative.id}?fields=thumbnail_url&thumbnail_width=720&thumbnail_height=720`);
          thumb = big?.thumbnail_url ?? thumb;
        } catch { /* mantém miniatura padrão */ }
      }
      creatives.push({
        meta_ad_id: String(ad.ad_id), ad_account_id: acc.id, creative_id: a?.creative?.id ?? null, ad_name: a?.name ?? ad.ad_name ?? null,
        thumbnail_url: thumb, image_url: a?.creative?.image_url ?? null, title: a?.creative?.title ?? null,
        body: a?.creative?.body ?? null, object_type: a?.creative?.object_type ?? null, synced_at: now,
      });
    } catch { /* anúncio sem criativo acessível */ }
  }
  if (creatives.length) await upsert("meta_ad_creatives", creatives, "meta_ad_id");
  return { account: act, name: acc.name, ok: true, rows, creatives: creatives.length };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  let expected: string | null = null;
  try { expected = await rest("rpc/meta_sync_secret", { method: "POST", body: "{}" }); } catch { return json({ ok: false, error: "segredo indisponível" }, 500); }
  if (!expected || req.headers.get("x-sync-secret") !== expected) return json({ ok: false, error: "unauthorized" }, 401);
  if (!META_ACCESS_TOKEN) return json({ ok: false, error: "META_ACCESS_TOKEN ausente" }, 503);

  const body = await req.json().catch(() => ({}));
  const periods = Array.isArray(body.periods) ? body.periods.filter((p: any) => p?.since && p?.until) : [];
  if (!periods.length) return json({ ok: false, error: "informe periods" }, 400);

  if (body.mode === "reach") {
    const ids: string[] = Array.isArray(body.campaign_ids) ? body.campaign_ids.map(String).filter(Boolean) : [];
    if (!body.meta_account_id || !ids.length) return json({ ok: false, error: "informe meta_account_id e campaign_ids" }, 400);
    try {
      const out = [];
      for (const p of periods) out.push(await groupReach(String(body.meta_account_id), p, ids));
      return json({ ok: true, periods: out });
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 502);
    }
  }

  if (body.mode === "followers") {
    if (!body.meta_account_id) return json({ ok: false, error: "informe meta_account_id" }, 400);
    try {
      const ig = await instagramOf(String(body.meta_account_id));
      const out = [];
      for (const p of periods) {
        try { out.push(await followsIn(ig.id, p)); }
        catch (e) { out.push({ since: p.since, until: p.until, follows: null, error: e instanceof Error ? e.message : String(e) }); }
      }
      return json({ ok: true, instagram: { id: ig.id, username: ig.username ?? null, followers_count: ig.followers_count ?? null }, periods: out });
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 502);
    }
  }

  const topAds = Math.min(Math.max(Number(body.top_ads) || 6, 0), 20);
  const filter = body.meta_account_id ? `meta_account_id=eq.${encodeURIComponent(body.meta_account_id)}` : "is_selected=eq.true";
  const accounts = await rest(`meta_ad_accounts?select=id,meta_account_id,name&${filter}`);
  const results = [];
  for (const acc of accounts) {
    try { results.push(await syncAccount(acc, periods, topAds)); }
    catch (e) { results.push({ account: acc.meta_account_id, name: acc.name, ok: false, error: e instanceof Error ? e.message : String(e) }); }
  }
  const ok = results.every((r: any) => r.ok);
  return json({ ok, results }, ok ? 200 : 207);
});

