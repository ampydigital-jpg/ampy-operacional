import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { buildReportV5, stageOf, isVagas } from "./build_v5.ts";

// traffic-weekly: usado pelo n8n.
// mode "weekly" (padrão): atualiza as contas (meta-sync + meta-period-sync) e devolve o consolidado da semana.
// mode "build": monta os pedidos de preenchimento do Slides do relatório de um cliente (layout v5, modelo com chaves).
// Versão 8: layouts v1 e v2 saíram do pacote; o código deles está salvo no projeto (claude/traffic-weekly) para rollback.
// Versão 11: só layout v4 no pacote (v3 salvo em claude/traffic-weekly/rollback-v10).
// Versão 13: alcance e frequência do comparativo sem campanhas excluídas (consulta na Meta), ajustes visuais do v4.
// Versão 14: etapa 100% pelo nome (na dúvida, Meio); campanhas de VAGAS fora dos funis, só na tabela de campanhas.
// Versão 15: layout v5 (resumo com 6 indicadores, vendas "?" no funil, comparativo com engajamento e seguidores, criativos por etapa). v4 salvo no projeto.
// Versão 16: sincronização com no máximo 5 contas por vez e nova tentativa quando a Supabase limita chamadas entre funções.
// Versão 18: mês inteiro compara com o mês anterior; build aceita report_label (ex.: "mensal") e auto_texts (leitura e observação geradas pelos números).
// Autenticação: header x-api-key igual ao segredo "n8n_traffic_secret" do Vault.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { Authorization: `Bearer ${KEY}`, apikey: KEY, "Content-Type": "application/json" };
const DAY = 86_400_000;

const json = (body: unknown, status = 200) => Response.json(body, { status });

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers as Record<string, string> | undefined) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path.split("?")[0]} ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const rpc = (name: string, body: unknown = {}) => rest(`rpc/${name}`, { method: "POST", body: JSON.stringify(body) });

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const isDate = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

function lastWeek() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const t = new Date(`${today}T12:00:00Z`);
  const thisMonday = new Date(t.getTime() - ((t.getUTCDay() + 6) % 7) * DAY);
  return { since: ymd(new Date(thisMonday.getTime() - 7 * DAY)), until: ymd(new Date(thisMonday.getTime() - DAY)) };
}

// Última quinzena fechada: 1 a 15 ou 16 ao último dia do mês.
function lastHalfMonth() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [y, m, d] = today.split("-").map(Number);
  if (d >= 16) return { since: ymd(new Date(Date.UTC(y, m - 1, 1))), until: ymd(new Date(Date.UTC(y, m - 1, 15))) };
  return { since: ymd(new Date(Date.UTC(y, m - 2, 16))), until: ymd(new Date(Date.UTC(y, m - 1, 0))) };
}

// Último mês fechado: dia 1 ao último dia do mês anterior.
function lastMonth() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [y, m] = today.split("-").map(Number);
  return { since: ymd(new Date(Date.UTC(y, m - 2, 1))), until: ymd(new Date(Date.UTC(y, m - 1, 0))) };
}

// Mesma regra de public.traffic_prev_period: quinzena compara com a quinzena anterior; outros períodos, mesmo tamanho logo antes.
function prevPeriod(range: { since: string; until: string }) {
  const s = new Date(`${range.since}T12:00:00Z`);
  const u = new Date(`${range.until}T12:00:00Z`);
  const y = s.getUTCFullYear(), m = s.getUTCMonth(), d = s.getUTCDate();
  const lastOfMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const until = ymd(new Date(s.getTime() - DAY));
  if (d === 1 && u.getUTCMonth() === m && u.getUTCDate() === lastOfMonth) return { since: ymd(new Date(Date.UTC(y, m - 1, 1))), until };
  if (d === 1 && u.getUTCMonth() === m && u.getUTCDate() === 15) return { since: ymd(new Date(Date.UTC(y, m - 1, 16))), until };
  if (d === 16 && u.getUTCMonth() === m && u.getUTCDate() === lastOfMonth) return { since: ymd(new Date(Date.UTC(y, m, 1))), until };
  const len = Math.round((u.getTime() - s.getTime()) / DAY) + 1;
  return { since: ymd(new Date(s.getTime() - len * DAY)), until };
}

type SyncResult = { meta_account_id: string; name: string | null; ok: boolean; error: string | null };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Chamadas entre funções têm limite por rajada (RateLimitError). Espera o tempo pedido e tenta de novo.
async function callFn(name: string, secret: string, body: unknown, tries = 3) {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-sync-secret": secret },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      return { res, data };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const wait = Number((e as { retryAfterMs?: number })?.retryAfterMs) || Number(msg.match(/Retry after (\d+)ms/i)?.[1]) || 0;
      if (i < tries - 1 && /rate limit/i.test(msg)) { await sleep(Math.min(Math.max(wait, 2000) + 500, 65_000)); continue; }
      throw e;
    }
  }
}

async function syncOne(a: { meta_account_id: string; name: string | null }, syncSecret: string, range: { since: string; until: string }, prev: { since: string; until: string }): Promise<SyncResult> {
  try {
    const daily = await callFn("meta-sync", syncSecret, { mode: "sync", meta_account_id: a.meta_account_id, since: prev.since, until: range.until });
    const r = daily.data?.results?.[0];
    if (!r?.ok) return { meta_account_id: a.meta_account_id, name: a.name, ok: false, error: r?.error ?? daily.data?.error ?? `HTTP ${daily.res.status}` };
    const period = await callFn("meta-period-sync", syncSecret, { meta_account_id: a.meta_account_id, periods: [range, prev], top_ads: 12 });
    const pr = period.data?.results?.[0];
    if (!pr?.ok) return { meta_account_id: a.meta_account_id, name: a.name, ok: false, error: `período: ${pr?.error ?? period.data?.error ?? `HTTP ${period.res.status}`}` };
    return { meta_account_id: a.meta_account_id, name: a.name, ok: true, error: null };
  } catch (e) {
    return { meta_account_id: a.meta_account_id, name: a.name, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Versão 16: no máximo 5 contas ao mesmo tempo (antes todas juntas estouravam o limite de rajada entre funções).
async function syncAccounts(ids: string[] | null, range: { since: string; until: string }, prev: { since: string; until: string }): Promise<SyncResult[]> {
  const syncSecret = await rpc("meta_sync_secret");
  let accounts: { meta_account_id: string; name: string | null }[] = await rest("meta_ad_accounts?select=meta_account_id,name&is_selected=eq.true");
  if (ids) accounts = accounts.filter((a) => ids.includes(a.meta_account_id));

  const results: SyncResult[] = new Array(accounts.length);
  let next = 0;
  const worker = async () => {
    while (next < accounts.length) {
      const i = next++;
      results[i] = await syncOne(accounts[i], syncSecret, range, prev);
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, accounts.length) }, worker));
  return results;
}

// Soma de ações de engajamento das campanhas (nível campanha, período exato).
const ENG = { interacoes: ["post_reaction", "comment", "post", "onsite_conversion.post_save"], video: ["video_view"] };
async function engagementOf(c: any, period: { since: string; until: string }, campaignIds: string[]) {
  if (!campaignIds.length) return null;
  const inList = `(${campaignIds.map((i) => `"${i}"`).join(",")})`;
  const rows: any[] = await rest(`meta_period_insights?select=actions&level=eq.campaign&since=eq.${period.since}&until=eq.${period.until}&entity_id=in.${encodeURIComponent(inList)}`);
  if (!rows.length) return null;
  const out: Record<string, number> = { interacoes: 0, video: 0 };
  for (const r of rows) for (const a of r.actions ?? []) {
    for (const [k, types] of Object.entries(ENG)) if (types.includes(String(a.action_type))) out[k] += Number(a.value ?? 0);
  }
  return out;
}

// Dados extras do layout: período anterior por campanha, anúncios com investimento por campanha, alcance, engajamento e seguidores.
async function v4Extra(report: any, prev: { since: string; until: string }, range: { since: string; until: string }, cfg: any) {
  const c = report.client ?? {};
  const excluded: string[] = ((cfg.exclude_campaigns ?? {})[c.report_client_id] ?? []).map(String);
  const prevReport = await rpc("traffic_client_report", { p_report_client_id: c.report_client_id, p_since: prev.since, p_until: prev.until });
  const camps = (report.campaigns ?? []).filter((x: any) => !excluded.includes(String(x.name)) && !isVagas(String(x.name)) && Number(x.spend) > 0);
  const ids = camps.map((x: any) => String(x.campaign_id));
  const scopeIds = camps.filter((x: any) => ["meio", "fundo"].includes(String(stageOf(x.name)))).map((x: any) => String(x.campaign_id));

  const adsByCampaign: Record<string, number> = {};
  if (ids.length) {
    const inList = `(${ids.map((i: string) => `"${i}"`).join(",")})`;
    let rows: any[] = await rest(`meta_period_insights?select=entity_id,meta_campaign_id&level=eq.ad&since=eq.${range.since}&until=eq.${range.until}&spend=gt.0&meta_campaign_id=in.${encodeURIComponent(inList)}`);
    if (!rows.length) rows = await rest(`meta_insights_daily?select=entity_id,meta_campaign_id&level=eq.ad&spend=gt.0&date_start=gte.${range.since}&date_start=lte.${range.until}&meta_campaign_id=in.${encodeURIComponent(inList)}&limit=5000`);
    const seen: Record<string, Set<string>> = {};
    for (const r of rows) (seen[String(r.meta_campaign_id)] ??= new Set()).add(String(r.entity_id));
    for (const [k, v] of Object.entries(seen)) adsByCampaign[k] = v.size;
  }

  // Alcance sem pessoas repetidas: escopo do funil (meio e fundo) e conta inteira sem campanhas excluídas, atual e anterior.
  const prevIds = (prevReport?.campaigns ?? []).filter((x: any) => !excluded.includes(String(x.name)) && !isVagas(String(x.name)) && Number(x.spend) > 0).map((x: any) => String(x.campaign_id));
  let reach: any = null, reachAll: any = null, reachAllPrev: any = null, reachError: string | null = null;
  if (c.meta_account_id && ids.length) {
    try {
      const secret = await rpc("meta_sync_secret");
      const ask = async (period: { since: string; until: string }, campaignIds: string[]) => {
        if (!campaignIds.length) return null;
        const { res, data } = await callFn("meta-period-sync", secret, { mode: "reach", meta_account_id: c.meta_account_id, periods: [period], campaign_ids: campaignIds });
        if (res.ok && data?.ok) return data.periods?.[0] ?? null;
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      };
      reachAll = await ask(range, ids);
      reach = scopeIds.length === ids.length ? reachAll : await ask(range, scopeIds);
      reachAllPrev = await ask(prev, prevIds);
    } catch (e) { reachError = e instanceof Error ? e.message : String(e); }
  }
  // Engajamento das campanhas do funil (sem vagas e sem excluídas), atual e anterior.
  const engagement = { current: await engagementOf(c, range, ids), previous: await engagementOf(c, prev, prevIds) };
  // Novos seguidores do Instagram no período (meta-period-sync mode "followers"); sem permissão ou sem conta ligada, fica sem dados.
  let followers: any = null;
  if (c.meta_account_id) {
    try {
      const secret = await rpc("meta_sync_secret");
      const { res, data } = await callFn("meta-period-sync", secret, { mode: "followers", meta_account_id: c.meta_account_id, periods: [range, prev] });
      if (res.ok && data?.ok) followers = { current: data.periods?.[0]?.follows ?? null, previous: data.periods?.[1]?.follows ?? null, account: data.instagram ?? null };
      else followers = { current: null, previous: null, error: String(data?.error ?? `HTTP ${res.status}`).slice(0, 120) };
    } catch (e) { followers = { current: null, previous: null, error: e instanceof Error ? e.message : String(e) }; }
  }
  return { prevReport, adsByCampaign, reach, reachAll, reachAllPrev, reachError, engagement, followers };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });

  let expected: string | null = null;
  try {
    expected = await rpc("n8n_traffic_secret");
  } catch {
    return json({ ok: false, error: "segredo indisponível" }, 500);
  }
  if (!expected || req.headers.get("x-api-key") !== expected) return json({ ok: false, error: "unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const range = isDate(body.since) && isDate(body.until)
    ? { since: body.since as string, until: body.until as string }
    : (body.period === "quinzena" ? lastHalfMonth() : body.period === "mes" ? lastMonth() : lastWeek());
  const prev = prevPeriod(range);

  try {
    if (body.mode === "build") {
      if (!body.report_client_id) return json({ ok: false, error: "informe report_client_id" }, 400);
      const report = await rpc("traffic_client_report", { p_report_client_id: body.report_client_id, p_since: range.since, p_until: range.until });
      const settings: { key: string; value: unknown }[] = await rest("traffic_report_settings?select=key,value");
      const cfg = Object.fromEntries(settings.map((s) => [s.key, s.value]));
      const layout = String(body.layout ?? cfg.weekly_layout ?? "v5").toLowerCase();
      if (layout === "v4" || layout === "v5") {
        const extra = await v4Extra(report, prev, range, cfg);
        const built = buildReportV5(report, extra.prevReport, extra, body, cfg);
        return json({ ok: true, ...built, extra: { reach: extra.reach, reach_all: extra.reachAll, reach_all_prev: extra.reachAllPrev, reach_error: extra.reachError, ads_by_campaign: extra.adsByCampaign, engagement: extra.engagement, followers: extra.followers } });
      }
      return json({ ok: false, error: `layout ${layout} não está nesta versão da função; use v5 (v4 e v3 salvos no projeto para rollback)` }, 400);
    }

    const ids: string[] | null = Array.isArray(body.meta_account_ids) && body.meta_account_ids.length ? body.meta_account_ids.map(String) : null;
    let sync: SyncResult[] = [];
    if (body.sync !== false) sync = await syncAccounts(ids, range, prev);
    const report = await rpc("traffic_weekly_report", { p_since: range.since, p_until: range.until, p_account_ids: ids });
    return json({ ok: true, generated_at: new Date().toISOString(), period: range, previous: prev, ...report, sync, sync_errors: sync.filter((s) => !s.ok) });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

