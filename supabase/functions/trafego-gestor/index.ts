import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// trafego-gestor: gestor de tráfego da Ampy (Meta Ads).
// Lê os dados já sincronizados (meta_insights_daily, meta_campaigns, meta_adsets, meta_ads), aplica regras fixas
// e executa na Meta: pausa anúncio ruim, reduz e aumenta orçamento diário. Registra tudo em trafego_acoes e trafego_alertas.
// Cálculo sempre no nível de anúncio (campanha com objetivo "mixed" não distorce o custo por resultado).
// Autenticação: header x-api-key igual ao segredo "n8n_traffic_secret" do Vault (mesma credencial do n8n).
// Ações (POST JSON, campo action):
//   rodar      { modo?: "executar"|"simular", origem?, contas?: ["act_..."] }  analisa e age; devolve resumo e textos
//   desfazer   { acao_id, origem? }                                            desfaz uma ação executada
//   manual     { nivel, objeto_id, tipo: "pausar"|"reativar"|"orcamento", valor?, motivo?, origem? }
//   historico  { dias?, conta? }                                               ações e alertas recentes
//   salvar_meta { meta_account_id, result_indicator?, cpr_alvo?, cpr_max?, roas_alvo?, nome_resultado?, orcamento_mensal?, modo?, objetivo_negocio?, observacoes? }
//   status     {}                                                              chave geral, token de escrita, última rodada
// Escrita na Meta usa o token do Vault "meta_write_token" (precisa de ads_management). Sem ele tudo fica em simulação.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const READ_TOKEN = Deno.env.get("META_ACCESS_TOKEN")!;
const V = Deno.env.get("META_API_VERSION") || "v26.0";
const GRAPH = `https://graph.facebook.com/${V}`;
const TZ = "America/Sao_Paulo";
const DAY = 86_400_000;
const H = { Authorization: `Bearer ${KEY}`, apikey: KEY, "Content-Type": "application/json" };
const json = (body: unknown, status = 200) => Response.json(body, { status });

type J = Record<string, any>;

// ---------- Supabase ----------
async function sb(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers as Record<string, string> | undefined) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path.split("?")[0]} ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}
const rpc = (name: string, body: unknown = {}) => sb(`rpc/${name}`, { method: "POST", body: JSON.stringify(body) });
async function all(path: string): Promise<J[]> {
  const out: J[] = [];
  for (let off = 0; ; off += 1000) {
    const page = await sb(`${path}${path.includes("?") ? "&" : "?"}limit=1000&offset=${off}`);
    out.push(...(page ?? []));
    if (!page || page.length < 1000) return out;
  }
}
const insert = (table: string, rows: J | J[]) => sb(table, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(rows) });
const patch = (path: string, body: J) => sb(path, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(body) });

// ---------- Meta ----------
async function metaGet(id: string, fields: string) {
  const res = await fetch(`${GRAPH}/${id}?fields=${fields}&access_token=${READ_TOKEN}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) throw new Error(data?.error?.message || `Meta HTTP ${res.status}`);
  return data;
}
async function metaPost(id: string, params: Record<string, string>, token: string) {
  const body = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`${GRAPH}/${id}`, { method: "POST", body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) throw new Error(data?.error?.error_user_msg || data?.error?.message || `Meta HTTP ${res.status}`);
  return data;
}

// ---------- datas e formatação ----------
const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const addDays = (s: string, n: number) => new Date(new Date(`${s}T12:00:00Z`).getTime() + n * DAY).toISOString().slice(0, 10);
const dm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
function fmt(n: number, d = 0) {
  const [i, f] = Math.abs(n).toFixed(d).split(".");
  return (n < 0 ? "-" : "") + i.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (f ? "," + f : "");
}
const brl = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? "sem dados" : "R$ " + fmt(n, 2));
const pctv = (n: number) => fmt(n, 0) + "%";
const nomeConta = (s: string | null) => String(s || "").replace(/^\s*CA\s*-?\s*/i, "").trim();
const curto = (s: string, max = 40) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > max ? t.slice(0, max - 1) + "…" : t; };

const RESULT: Record<string, [string, string]> = {
  "actions:onsite_conversion.messaging_conversation_started_7d": ["conversas", "conversa"],
  "profile_visit_view": ["visitas ao perfil", "visita ao perfil"],
  "total_profile_visits": ["visitas ao perfil", "visita ao perfil"],
  "actions:offsite_conversion.fb_pixel_initiate_checkout": ["checkouts", "checkout"],
  "actions:offsite_conversion.fb_pixel_purchase": ["compras", "compra"],
  "actions:omni_purchase": ["compras", "compra"],
  "actions:offsite_conversion.fb_pixel_add_to_cart": ["adições ao carrinho", "adição ao carrinho"],
  "actions:offsite_conversion.fb_pixel_lead": ["leads", "lead"],
  "actions:onsite_conversion.lead_grouped": ["leads", "lead"],
  "actions:lead": ["leads", "lead"],
  "actions:link_click": ["cliques no link", "clique"],
  "actions:landing_page_view": ["visitas ao site", "visita ao site"],
  "video_thruplay_watched_actions": ["ThruPlays", "ThruPlay"],
  "actions:post_engagement": ["engajamentos", "engajamento"],
  "reach": ["pessoas alcançadas", "mil pessoas"],
};
const unidade = (ind: string | null, n = 2) => (ind && RESULT[ind] ? RESULT[ind][n === 1 ? 1 : 0] : n === 1 ? "resultado" : "resultados");
const PURCHASE = ["offsite_conversion.fb_pixel_purchase", "omni_purchase", "purchase"];

// ---------- agregação ----------
type Agg = { spend: number; res: number; value: number; compras: number; imp: number; clicks: number; dias: number };
const zero = (): Agg => ({ spend: 0, res: 0, value: 0, compras: 0, imp: 0, clicks: 0, dias: 0 });
function addRow(a: Agg, r: J, ind: string | null) {
  a.spend += Number(r.spend || 0);
  a.imp += Number(r.impressions || 0);
  a.clicks += Number(r.inline_link_clicks || 0);
  if (Number(r.spend || 0) > 0) a.dias += 1;
  if (ind && normInd(r.result_indicator) === ind) a.res += Number(r.result_count || 0);
  const av = (r.action_values || []).find((x: J) => PURCHASE.includes(String(x.action_type)));
  if (av) a.value += Number(av.value || 0);
  const ac = (r.actions || []).find((x: J) => PURCHASE.includes(String(x.action_type)));
  if (ac) a.compras += Number(ac.value || 0);
}
const cpr = (a: Agg) => (a.res > 0 ? a.spend / a.res : null);
const roas = (a: Agg) => (a.spend > 0 ? a.value / a.spend : null);

// "mixed" (campanha com objetivos diferentes) não serve; visitas ao perfil aparecem com dois nomes na Meta.
function normInd(x: unknown): string | null {
  const s = String(x || "");
  if (!s || s === "mixed") return null;
  if (s === "total_profile_visits") return "profile_visit_view";
  return s;
}

// Tipo de resultado da entidade: o indicador mais frequente nos 30 dias (ponderado por resultados).
function indicadorDe(rows: J[]): string | null {
  const m = new Map<string, number>();
  for (const r of rows) { const k = normInd(r.result_indicator); if (k) m.set(k, (m.get(k) || 0) + 1 + Number(r.result_count || 0)); }
  let best: string | null = null, n = -1;
  for (const [k, v] of m) if (v > n) { best = k; n = v; }
  return best;
}

// ---------- configuração ----------
async function carregarConfig() {
  const rows = await sb("trafego_config?select=key,value");
  const cfg: J = Object.fromEntries(rows.map((r: J) => [r.key, r.value]));
  let token: string | null = null;
  try { token = await rpc("meta_write_token"); } catch { token = null; }
  return { execucaoAtiva: cfg.execucao_ativa === true, R: cfg.regras || {}, equipeWhats: cfg.equipe_whatsapp || [], equipeEmail: cfg.equipe_email || [], token: token || null };
}

// ---------- execução de uma ação na Meta ----------
type Acao = {
  meta_account_id: string; conta_nome: string; nivel: "campaign" | "adset" | "ad"; objeto_id: string; objeto_nome: string;
  tipo: "pausar" | "reduzir_orcamento" | "aumentar_orcamento" | "reativar" | "ajustar_orcamento";
  regra: string; motivo: string; antes: J; depois: J; metricas?: J; origem: string; desfaz_acao_id?: number | null;
};
const TABELA: Record<string, [string, string]> = { campaign: ["meta_campaigns", "meta_campaign_id"], adset: ["meta_adsets", "meta_adset_id"], ad: ["meta_ads", "meta_ad_id"] };

async function aplicar(a: Acao, simular: string | null, token: string | null, execucaoId: number | null) {
  const base = { ...a, execucao_id: execucaoId, metricas: a.metricas ?? null, desfaz_acao_id: a.desfaz_acao_id ?? null };
  if (simular || !token) {
    const [row] = await insert("trafego_acoes", { ...base, status: "simulado", erro: simular || "sem token de escrita (meta_write_token)" });
    return row;
  }
  try {
    // Confere o estado atual na Meta antes de mexer.
    const live = await metaGet(a.objeto_id, a.nivel === "ad" ? "status,effective_status" : "status,effective_status,daily_budget");
    if (a.tipo === "pausar" && live.status !== "ACTIVE") {
      const [row] = await insert("trafego_acoes", { ...base, status: "bloqueado", erro: `já estava ${live.status}` });
      return row;
    }
    if (a.tipo === "reativar" && live.status === "ACTIVE") {
      const [row] = await insert("trafego_acoes", { ...base, status: "bloqueado", erro: "já estava ativo" });
      return row;
    }
    const params: Record<string, string> = {};
    if (a.tipo === "pausar") params.status = "PAUSED";
    else if (a.tipo === "reativar") params.status = "ACTIVE";
    else {
      const atual = Number(live.daily_budget || 0) / 100;
      if (!(atual > 0)) {
        const [row] = await insert("trafego_acoes", { ...base, status: "bloqueado", erro: "sem orçamento diário neste nível" });
        return row;
      }
      if (Math.abs(atual - Number(a.antes.daily_budget)) > 0.5 && a.tipo !== "ajustar_orcamento") {
        // Orçamento mudou desde a sincronização: recalcula pela mesma proporção.
        const fator = Number(a.depois.daily_budget) / Number(a.antes.daily_budget);
        base.antes = { ...a.antes, daily_budget: atual };
        base.depois = { ...a.depois, daily_budget: Math.round(atual * fator * 100) / 100 };
      }
      params.daily_budget = String(Math.round(Number(base.depois.daily_budget) * 100));
    }
    await metaPost(a.objeto_id, params, token);
    const now = new Date().toISOString();
    const [tab, col] = TABELA[a.nivel];
    const local: J = params.status ? { status: params.status, effective_status: params.status } : { daily_budget: Number(base.depois.daily_budget) };
    try { await patch(`${tab}?${col}=eq.${a.objeto_id}`, local); } catch { /* espelho local não derruba a ação */ }
    const [row] = await insert("trafego_acoes", { ...base, status: "executado", executado_at: now });
    return row;
  } catch (e) {
    const [row] = await insert("trafego_acoes", { ...base, status: "erro", erro: e instanceof Error ? e.message.slice(0, 400) : String(e) });
    return row;
  }
}

// ---------- análise ----------
async function rodar(body: J) {
  const C = await carregarConfig();
  const R = C.R;
  const origem = String(body.origem || "diario");
  const pedidoSimular = body.modo === "simular";
  const hoje = ymd(new Date());
  const ontem = addDays(hoje, -1);
  const jan = Number(R.janela_dias || 7);
  const w7 = addDays(ontem, -(jan - 1));
  const w3 = addDays(ontem, -2);
  const p7s = addDays(w7, -jan), p7e = addDays(w7, -1);
  const ref = addDays(ontem, -(Number(R.referencia_dias || 30) - 1));
  const mes = hoje.slice(0, 8) + "01";
  const desde = [ref, p7s, mes].sort()[0];

  const [exec] = await insert("trafego_execucoes", { origem, modo: pedidoSimular || !C.execucaoAtiva || !C.token ? "simular" : "executar", periodo: { janela: [w7, ontem], referencia: [ref, ontem] } });
  const execId = exec.id as number;

  try {
    let contas = await sb("meta_ad_accounts?select=id,meta_account_id,name,account_status,balance,spend_cap,amount_spent_total,payment_method_label,last_synced_at&is_selected=eq.true");
    if (Array.isArray(body.contas) && body.contas.length) contas = contas.filter((c: J) => body.contas.includes(c.meta_account_id));
    const cfgContas: J[] = await sb("trafego_contas?select=*");
    const metas: J[] = await sb("trafego_metas?select=*");
    const ids = contas.map((c: J) => c.id);
    const inIds = `in.(${ids.join(",")})`;
    const camps = await all(`meta_campaigns?select=meta_campaign_id,ad_account_id,name,effective_status,daily_budget,lifetime_budget,meta_created_time&ad_account_id=${inIds}`);
    const adsets = await all(`meta_adsets?select=meta_adset_id,meta_campaign_id,ad_account_id,name,effective_status,daily_budget,lifetime_budget,meta_created_time&ad_account_id=${inIds}`);
    const ads = await all(`meta_ads?select=meta_ad_id,meta_adset_id,meta_campaign_id,ad_account_id,name,effective_status,meta_created_time&ad_account_id=${inIds}`);
    const ins = await all(`meta_insights_daily?select=ad_account_id,level,entity_id,meta_campaign_id,meta_adset_id,date_start,spend,impressions,inline_link_clicks,result_indicator,result_count,actions,action_values&ad_account_id=${inIds}&date_start=gte.${desde}&date_start=lte.${ontem}&order=date_start.asc`);
    const recentes: J[] = await sb(`trafego_acoes?select=id,objeto_id,tipo,status,created_at,desfeito_at,meta_account_id,origem&created_at=gte.${new Date(Date.now() - 14 * DAY).toISOString()}`);

    // índices
    const rowsBy = new Map<string, J[]>();
    for (const r of ins) { const k = `${r.level}|${r.entity_id}`; (rowsBy.get(k) ?? rowsBy.set(k, []).get(k)!).push(r); }
    const janela = (rows: J[], s: string, e: string, ind: string | null) => { const a = zero(); for (const r of rows) if (r.date_start >= s && r.date_start <= e) addRow(a, r, ind); return a; };
    const idade = (iso: string | null) => (iso ? (Date.now() - new Date(iso).getTime()) / DAY : 999);
    const mexidoRecente = (id: string) => recentes.some((x) => x.objeto_id === id && x.status === "executado" && !x.desfeito_at && Date.now() - new Date(x.created_at).getTime() < Number(R.horas_entre_mudancas || 72) * 3600_000);
    const pausadoPeloGestor = (id: string) => recentes.some((x) => x.objeto_id === id && x.tipo === "pausar" && x.status === "executado" && !x.desfeito_at);
    const acoesHojeConta = (act: string) => recentes.filter((x) => x.meta_account_id === act && ["executado", "simulado"].includes(x.status) && x.origem === origem && ymd(new Date(x.created_at)) === hoje).length;

    const propostas: (Acao & { prioridade: number; simular: string | null })[] = [];
    const alertas: J[] = [];
    const resumoContas: J[] = [];
    const alerta = (c: J, tipo: string, sev: string, msg: string, chave: string, dados: J = {}) =>
      alertas.push({ execucao_id: execId, meta_account_id: c.meta_account_id, conta_nome: nomeConta(c.name), tipo, severidade: sev, mensagem: msg, chave: `${tipo}|${chave}`, dados });

    for (const c of contas) {
      const act = c.meta_account_id;
      const cc = cfgContas.find((x) => x.meta_account_id === act) || { modo: "executar" };
      if (cc.modo === "desligado") continue;
      const nome = nomeConta(c.name);
      const simConta = pedidoSimular ? "rodada em simulação" : !C.execucaoAtiva ? "execução geral desligada" : cc.modo === "observar" ? "conta em modo observar" : null;
      const myCamps = camps.filter((x) => x.ad_account_id === c.id);
      const myAdsets = adsets.filter((x) => x.ad_account_id === c.id);
      const myAds = ads.filter((x) => x.ad_account_id === c.id);
      const contaRows = rowsBy.get(`account|${act}`) || [];
      const g7 = janela(contaRows, w7, ontem, null), gp = janela(contaRows, p7s, p7e, null), gOntem = janela(contaRows, ontem, ontem, null), gMes = janela(contaRows, mes, ontem, null);
      const ativas = myCamps.filter((x) => x.effective_status === "ACTIVE");

      // Tudo é calculado no nível de anúncio: cada anúncio tem um tipo de resultado (campanha "mixed" não atrapalha).
      const adRows = new Map<string, J[]>();
      for (const r of ins) if (r.level === "ad" && r.ad_account_id === c.id) (adRows.get(r.entity_id) ?? adRows.set(r.entity_id, []).get(r.entity_id)!).push(r);
      const indAd = new Map<string, string | null>();
      for (const [id, rows] of adRows) {
        const r0 = rows[0];
        indAd.set(id, indicadorDe(rows.filter((r) => r.date_start >= ref))
          || indicadorDe((rowsBy.get(`adset|${r0.meta_adset_id}`) || []).filter((r) => r.date_start >= ref))
          || indicadorDe((rowsBy.get(`campaign|${r0.meta_campaign_id}`) || []).filter((r) => r.date_start >= ref)));
      }
      // anúncio ainda sem tipo: o tipo dominante da campanha dele
      const domCamp = new Map<string, Map<string, number>>();
      for (const [id, rows] of adRows) { const ind = indAd.get(id); if (!ind) continue; const m = domCamp.get(rows[0].meta_campaign_id) ?? domCamp.set(rows[0].meta_campaign_id, new Map()).get(rows[0].meta_campaign_id)!; m.set(ind, (m.get(ind) || 0) + rows.reduce((s, r) => s + Number(r.spend || 0), 0)); }
      const topo = (m?: Map<string, number>) => { let b: string | null = null, v = -1; for (const [k, n] of m ?? []) if (n > v) { b = k; v = n; } return b; };
      for (const [id, rows] of adRows) if (!indAd.get(id)) indAd.set(id, topo(domCamp.get(rows[0].meta_campaign_id)));
      const indCamp = new Map<string, string | null>();
      for (const cp of myCamps) indCamp.set(cp.meta_campaign_id, topo(domCamp.get(cp.meta_campaign_id)));
      // soma de anúncios (filtro por campanha/conjunto) num período, separada por tipo de resultado
      const somaAds = (filtro: (r: J) => boolean, s: string, e: string) => {
        const por = new Map<string, Agg>(); let total = 0;
        for (const [id, rows] of adRows) {
          const ind = indAd.get(id); if (!ind) continue;
          for (const r of rows) if (r.date_start >= s && r.date_start <= e && filtro(r)) { addRow(por.get(ind) ?? por.set(ind, zero()).get(ind)!, r, ind); total += Number(r.spend || 0); }
        }
        return { por, total };
      };
      const refAgg = somaAds(() => true, ref, ontem).por;
      const metaDe = (ind: string | null) => metas.find((m) => m.meta_account_id === act && m.result_indicator === ind) || metas.find((m) => m.meta_account_id === act && m.result_indicator === "*") || null;
      const alvoDe = (ind: string | null): J | null => {
        const m = metaDe(ind);
        if (m?.roas_alvo) return { modo: "roas", alvo: Number(m.roas_alvo), fonte: "meta" };
        if (!ind) return null;
        if (m?.cpr_alvo) return { modo: "cpr", alvo: Number(m.cpr_alvo), max: m.cpr_max ? Number(m.cpr_max) : null, fonte: "meta" };
        const a = refAgg.get(ind);
        if (a && a.res >= 5) return { modo: "cpr", alvo: a.spend / a.res, max: null, fonte: "historico" };
        return null;
      };

      // resumo da conta por tipo de resultado
      const s7 = somaAds(() => true, w7, ontem).por, sp = somaAds(() => true, p7s, p7e).por;
      const porInd = new Map<string, { a7: Agg; ap: Agg }>();
      for (const [ind, a] of s7) porInd.set(ind, { a7: a, ap: sp.get(ind) ?? zero() });
      const resultados = [...porInd.entries()].filter(([, o]) => o.a7.spend > 0).sort((x, y) => y[1].a7.spend - x[1].a7.spend).map(([ind, o]) => {
        const alvo = alvoDe(ind);
        return { ind, nome: unidade(ind), res: o.a7.res, cpr: cpr(o.a7), cpr_ant: cpr(o.ap), spend: o.a7.spend, alvo: alvo?.modo === "cpr" ? alvo.alvo : null, fonte: alvo?.fonte ?? null, roas: alvo?.modo === "roas" ? roas(o.a7) : null, roas_alvo: alvo?.modo === "roas" ? alvo.alvo : null };
      });

      // ---- alertas da conta ----
      const media = g7.spend / jan;
      if (Number(c.account_status) !== 1) {
        const st: Record<number, string> = { 2: "desativada", 3: "com pagamento pendente", 7: "em análise de risco", 8: "com pagamento pendente", 9: "em período de carência", 100: "em encerramento", 101: "encerrada" };
        alerta(c, "conta_status", "critico", `conta ${st[Number(c.account_status)] || `com status ${c.account_status}`}`, act);
      }
      const cap = Number(c.spend_cap || 0);
      let limiteParado = false;
      if (cap > 0) {
        const resta = cap - Number(c.amount_spent_total || 0);
        if (resta <= 1 && ativas.length) { limiteParado = true; alerta(c, "limite_gasto", "critico", `conta parada, limite de gastos atingido (${brl(cap)}). Aumentar o limite ou receber novo pagamento`, act, { cap, resta }); }
        else if (media > 0 && resta / media < Number(R.limite_gasto_dias_alerta || 3)) alerta(c, "limite_gasto", "atencao", `limite de gastos acaba em ${fmt(Math.max(resta / media, 0), 0)} dia(s) (${brl(resta)} restantes, média ${brl(media)}/dia)`, act, { cap, resta, media });
      }
      const saldo = String(c.payment_method_label || "").match(/Saldo disponível \(R\$\s*([\d.,]+)/i);
      if (saldo && media > 0) {
        const v = Number(saldo[1].replace(/\./g, "").replace(",", "."));
        if (v / media < Number(R.limite_gasto_dias_alerta || 3)) alerta(c, "saldo", v < media ? "critico" : "atencao", `saldo pré-pago de ${brl(v)}, dá para ${fmt(v / media, 0)} dia(s) na média atual`, act, { saldo: v, media });
      }
      if (!limiteParado && ativas.length && gOntem.spend === 0 && g7.spend > 0) alerta(c, "sem_entrega", "critico", `nenhum gasto ontem com ${ativas.length} campanha(s) ativa(s). Conferir pagamento, reprovação ou orçamento`, act);
      const reprov = myAds.filter((x) => ["DISAPPROVED", "WITH_ISSUES"].includes(x.effective_status) && myCamps.some((cp) => cp.meta_campaign_id === x.meta_campaign_id && cp.effective_status === "ACTIVE"));
      for (const ad of reprov.slice(0, 5)) alerta(c, "anuncio_reprovado", "atencao", `anúncio "${curto(ad.name)}" ${ad.effective_status === "DISAPPROVED" ? "reprovado" : "com problema"} numa campanha ativa`, ad.meta_ad_id);
      for (const r of resultados) {
        if (r.cpr !== null && r.cpr_ant !== null && r.cpr_ant > 0 && r.cpr > r.cpr_ant * 1.4 && r.spend >= Number(R.gasto_minimo_orcamento || 30))
          alerta(c, "custo_subiu", "atencao", `custo por ${unidade(r.ind, 1)} subiu ${pctv((r.cpr / r.cpr_ant - 1) * 100)} na semana (${brl(r.cpr)} contra ${brl(r.cpr_ant)})`, `${act}|${r.ind}`);
      }
      const orcMensal = cc.orcamento_mensal ? Number(cc.orcamento_mensal) : null;
      const diasMes = new Date(Date.UTC(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)), 0)).getUTCDate();
      const restamDias = diasMes - Number(hoje.slice(8, 10)) + 1;
      const orcDiarioAtivo = ativas.reduce((s, cp) => s + Number(cp.daily_budget || 0), 0) + myAdsets.filter((s) => s.effective_status === "ACTIVE" && !Number(myCamps.find((cp) => cp.meta_campaign_id === s.meta_campaign_id)?.daily_budget || 0)).reduce((s, x) => s + Number(x.daily_budget || 0), 0);
      const projecao = gMes.spend + orcDiarioAtivo * restamDias;
      if (orcMensal && projecao > orcMensal * 1.1) alerta(c, "ritmo_mes", "atencao", `ritmo passa do orçamento do mês: projeção ${brl(projecao)} para ${brl(orcMensal)} (gasto até ontem ${brl(gMes.spend)})`, act, { projecao, orcMensal });

      // ---- regras de anúncio ----
      let cotaConta = Math.max(Number(R.max_acoes_por_conta_dia || 3) - acoesHojeConta(act), 0);
      const ativosPorConjunto = new Map<string, number>();
      for (const ad of myAds) if (ad.effective_status === "ACTIVE") ativosPorConjunto.set(ad.meta_adset_id, (ativosPorConjunto.get(ad.meta_adset_id) || 0) + 1);
      const gminP = Number(R.gasto_minimo_pausa || 20), gminO = Number(R.gasto_minimo_orcamento || 30);
      for (const ad of myAds) {
        if (ad.effective_status !== "ACTIVE" || idade(ad.meta_created_time) < Number(R.dias_minimos_no_ar || 3)) continue;
        if (pausadoPeloGestor(ad.meta_ad_id) || mexidoRecente(ad.meta_ad_id)) continue;
        const rows = adRows.get(ad.meta_ad_id) || [];
        const ind = indAd.get(ad.meta_ad_id) || indCamp.get(ad.meta_campaign_id) || null;
        const alvo = alvoDe(ind);
        if (!alvo) continue;
        const a = janela(rows, w7, ontem, ind);
        if (a.spend <= 0) continue;
        let motivo = "", regra = "";
        if (alvo.modo === "cpr") {
          const limite = alvo.max ?? Number(R.pausar_caro_x_alvo || 2) * alvo.alvo;
          if (a.res === 0 && a.spend >= Math.max(gminP, Number(R.pausar_sem_resultado_x_alvo || 2) * alvo.alvo)) { regra = "anuncio_sem_resultado"; motivo = `${brl(a.spend)} em ${jan} dias e 0 ${unidade(ind)} (referência ${brl(alvo.alvo)} por ${unidade(ind, 1)})`; }
          else if (a.res > 0 && cpr(a)! >= limite && a.spend >= Math.max(gminP, 3 * alvo.alvo)) { regra = "anuncio_caro"; motivo = `${brl(cpr(a))} por ${unidade(ind, 1)} em ${jan} dias, limite ${brl(limite)} (${fmt(a.res)} ${unidade(ind)}, ${brl(a.spend)})`; }
        } else {
          const r7 = roas(a) ?? 0;
          if (a.compras === 0 && a.spend >= 3 * gminP) { regra = "anuncio_sem_venda"; motivo = `${brl(a.spend)} em ${jan} dias sem venda`; }
          else if (a.compras > 0 && r7 < 0.5 * alvo.alvo && a.spend >= 3 * gminP) { regra = "anuncio_roas_baixo"; motivo = `ROAS ${fmt(r7, 2)} em ${jan} dias, meta ${fmt(alvo.alvo, 2)}`; }
        }
        if (!regra) continue;
        const nAtivos = ativosPorConjunto.get(ad.meta_adset_id) || 0;
        if (nAtivos <= 1) {
          alerta(c, "unico_anuncio_ruim", "atencao", `anúncio "${curto(ad.name)}" está ruim (${motivo}) mas é o único ativo do conjunto. Subir criativo novo`, ad.meta_ad_id);
          continue;
        }
        ativosPorConjunto.set(ad.meta_adset_id, nAtivos - 1);
        propostas.push({ meta_account_id: act, conta_nome: nome, nivel: "ad", objeto_id: ad.meta_ad_id, objeto_nome: ad.name, tipo: "pausar", regra, motivo, antes: { status: "ACTIVE" }, depois: { status: "PAUSED" }, metricas: { ...a, cpr: cpr(a), indicador: ind, alvo }, origem, prioridade: 1, simular: simConta });
      }

      // ---- regras de orçamento (campanha com orçamento ou conjunto com orçamento) ----
      const comOrc: J[] = [
        ...myCamps.filter((x) => x.effective_status === "ACTIVE" && Number(x.daily_budget) > 0).map((x) => ({ nivel: "campaign", id: x.meta_campaign_id, nome: x.name, orc: Number(x.daily_budget), criado: x.meta_created_time, camp: x.meta_campaign_id })),
        ...myAdsets.filter((x) => x.effective_status === "ACTIVE" && Number(x.daily_budget) > 0).map((x) => ({ nivel: "adset", id: x.meta_adset_id, nome: x.name, orc: Number(x.daily_budget), criado: x.meta_created_time, camp: x.meta_campaign_id })),
      ];
      let folgaMes = orcMensal ? orcMensal - projecao : 0;
      for (const o of comOrc) {
        if (idade(o.criado) < Number(R.dias_minimos_no_ar || 3) || mexidoRecente(o.id)) continue;
        const filtro = (r: J) => (o.nivel === "campaign" ? r.meta_campaign_id === o.id : r.meta_adset_id === o.id);
        const t7 = somaAds(filtro, w7, ontem);
        let ind: string | null = null, maior = 0;
        for (const [k, a] of t7.por) if (a.spend > maior) { ind = k; maior = a.spend; }
        if (!ind || t7.total <= 0) continue;
        // objetivos misturados no mesmo orçamento: sem como julgar, fica de fora
        if (maior / t7.total < 0.8) continue;
        const alvo = alvoDe(ind);
        if (!alvo) continue;
        const a7 = t7.por.get(ind)!, a3 = somaAds(filtro, w3, ontem).por.get(ind) ?? zero();
        let dir = 0, motivo = "";
        if (alvo.modo === "cpr") {
          const c7 = cpr(a7), c3 = cpr(a3);
          if (a7.spend >= Math.max(gminO, 3 * alvo.alvo) && (a7.res === 0 || c7! > Number(R.reduzir_se_cpr_x_alvo || 1.4) * alvo.alvo) && (a3.res === 0 || c3! > alvo.alvo)) {
            dir = -1; motivo = `${a7.res ? `${brl(c7)} por ${unidade(ind, 1)}` : `0 ${unidade(ind)}`} em ${jan} dias contra referência ${brl(alvo.alvo)}${a3.res ? `, últimos 3 dias ${brl(c3)}` : ", sem resultado nos últimos 3 dias"}`;
          } else if (a7.res >= Number(R.resultados_minimos_aumento || 5) && c7! <= Number(R.aumentar_se_cpr_x_alvo || 0.8) * alvo.alvo && a3.res > 0 && c3! <= alvo.alvo) {
            dir = 1; motivo = `${brl(c7)} por ${unidade(ind, 1)} em ${jan} dias (${fmt(a7.res)} ${unidade(ind)}) contra referência ${brl(alvo.alvo)}`;
          }
        } else {
          const r7 = roas(a7) ?? 0, r3 = roas(a3) ?? 0;
          if (a7.spend >= gminO && r7 < 0.7 * alvo.alvo && r3 < alvo.alvo) { dir = -1; motivo = `ROAS ${fmt(r7, 2)} em ${jan} dias, meta ${fmt(alvo.alvo, 2)}`; }
          else if (a7.compras >= Number(R.resultados_minimos_aumento || 5) && r7 >= 1.25 * alvo.alvo && r3 >= alvo.alvo) { dir = 1; motivo = `ROAS ${fmt(r7, 2)} em ${jan} dias, meta ${fmt(alvo.alvo, 2)}`; }
        }
        if (!dir) continue;
        if (dir < 0) {
          const minimo = Number(R.orcamento_minimo_diario || 6);
          const novo = Math.max(minimo, Math.round(o.orc * (1 - Number(R.reduzir_pct || 20) / 100) * 100) / 100);
          if (novo >= o.orc) { alerta(c, "orcamento_no_minimo", "atencao", `"${curto(o.nome)}" está ruim (${motivo}) e já no orçamento mínimo. Avaliar pausar ou trocar criativo`, o.id); continue; }
          propostas.push({ meta_account_id: act, conta_nome: nome, nivel: o.nivel, objeto_id: o.id, objeto_nome: o.nome, tipo: "reduzir_orcamento", regra: "orcamento_reduzir", motivo, antes: { daily_budget: o.orc }, depois: { daily_budget: novo }, metricas: { a7, a3, indicador: ind, alvo }, origem, prioridade: 2, simular: simConta });
        } else {
          const novo = Math.round(o.orc * (1 + Number(R.aumentar_pct || 20) / 100) * 100) / 100;
          const extra = (novo - o.orc) * restamDias;
          if (!orcMensal) { alerta(c, "pronto_para_escalar", "info", `"${curto(o.nome)}" pode subir orçamento (${motivo}). Cadastrar orçamento mensal da conta para o gestor escalar sozinho`, o.id); continue; }
          if (extra > folgaMes) { alerta(c, "escala_sem_verba", "info", `"${curto(o.nome)}" pode subir orçamento (${motivo}), mas não cabe no orçamento do mês`, o.id); continue; }
          folgaMes -= extra;
          propostas.push({ meta_account_id: act, conta_nome: nome, nivel: o.nivel, objeto_id: o.id, objeto_nome: o.nome, tipo: "aumentar_orcamento", regra: "orcamento_aumentar", motivo, antes: { daily_budget: o.orc }, depois: { daily_budget: novo }, metricas: { a7, a3, indicador: ind, alvo }, origem, prioridade: 3, simular: simConta });
        }
      }

      // cota por conta: pausas primeiro, depois reduções, depois aumentos
      const daConta = propostas.filter((p) => p.meta_account_id === act).sort((x, y) => x.prioridade - y.prioridade);
      for (const p of daConta) { if (cotaConta > 0) cotaConta--; else (p as J).fora_da_cota = true; }

      resumoContas.push({
        meta_account_id: act, nome, modo: cc.modo, orcamento_mensal: orcMensal, gasto_ontem: gOntem.spend, gasto_7d: g7.spend, gasto_7d_ant: gp.spend, gasto_mes: gMes.spend,
        campanhas_ativas: ativas.length, resultados, sem_meta: resultados.some((r) => r.fonte === "historico") || !metas.some((m) => m.meta_account_id === act),
      });
    }

    // ---- executa ----
    const fila = propostas.filter((p) => !(p as J).fora_da_cota).sort((x, y) => x.prioridade - y.prioridade).slice(0, Number(R.max_acoes_por_rodada || 15));
    const feitas: J[] = [];
    for (const p of fila) {
      const { prioridade: _p, simular, ...acao } = p as J;
      delete acao.fora_da_cota;
      feitas.push(await aplicar(acao as Acao, simular, C.token, execId));
    }
    if (alertas.length) await sb("trafego_alertas?on_conflict=chave,dia", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(alertas) });

    const textos = montarTextos({ hoje, ontem, w7, resumoContas, feitas, alertas, simGeral: pedidoSimular ? "simulação pedida" : !C.execucaoAtiva ? "execução geral desligada" : !C.token ? "sem token de escrita da Meta" : null });
    const resumo = {
      contas: resumoContas.length, gasto_ontem: resumoContas.reduce((s, c) => s + c.gasto_ontem, 0), gasto_7d: resumoContas.reduce((s, c) => s + c.gasto_7d, 0),
      acoes: feitas.map((a) => ({ id: a.id, conta: a.conta_nome, tipo: a.tipo, objeto: a.objeto_nome, status: a.status, erro: a.erro })),
      alertas: alertas.map((a) => ({ conta: a.conta_nome, tipo: a.tipo, severidade: a.severidade, mensagem: a.mensagem })),
    };
    await patch(`trafego_execucoes?id=eq.${execId}`, { finished_at: new Date().toISOString(), resumo: { ...resumo, contas_detalhe: resumoContas }, texto_whatsapp: textos.whatsapp, texto_email: textos.html });
    return { ok: true, execucao_id: execId, modo: exec.modo, periodo: { janela: [w7, ontem] }, ...resumo, contas_detalhe: resumoContas, texto_whatsapp: textos.whatsapp, assunto_email: textos.assunto, html_email: textos.html, equipe_whatsapp: C.equipeWhats, equipe_email: C.equipeEmail };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await patch(`trafego_execucoes?id=eq.${execId}`, { finished_at: new Date().toISOString(), erro: msg }).catch(() => {});
    throw e;
  }
}

// ---------- textos ----------
function descreverAcao(a: J) {
  const quem = a.nivel === "ad" ? "anúncio" : a.nivel === "adset" ? "conjunto" : "campanha";
  const art = a.nivel === "campaign" ? "a" : "o";
  if (a.tipo === "pausar") return `pausar ${art} ${quem} "${curto(a.objeto_nome)}"`;
  if (a.tipo === "reativar") return `reativar ${art} ${quem} "${curto(a.objeto_nome)}"`;
  const de = brl(Number(a.antes?.daily_budget)), para = brl(Number(a.depois?.daily_budget));
  const doq = a.nivel === "adset" ? "do conjunto" : "da campanha";
  if (a.tipo === "reduzir_orcamento") return `reduzir o orçamento ${doq} "${curto(a.objeto_nome)}" de ${de} para ${para}/dia`;
  if (a.tipo === "aumentar_orcamento") return `aumentar o orçamento ${doq} "${curto(a.objeto_nome)}" de ${de} para ${para}/dia`;
  return `ajustar o orçamento ${doq} "${curto(a.objeto_nome)}" de ${de} para ${para}/dia`;
}
const verbo: Record<string, string> = { pausar: "Pausei", reativar: "Reativei", reduzir_orcamento: "Reduzi", aumentar_orcamento: "Aumentei", ajustar_orcamento: "Ajustei" };
function fraseFeita(a: J) {
  const d = descreverAcao(a);
  if (a.status === "executado") return verbo[a.tipo] + d.replace(/^\S+/, "");
  if (a.status === "simulado") return "Faria: " + d;
  if (a.status === "bloqueado") return `Não fiz (${a.erro}): ${d}`;
  return `Erro ao ${d}: ${a.erro}`;
}

function montarTextos(o: { hoje: string; ontem: string; w7: string; resumoContas: J[]; feitas: J[]; alertas: J[]; simGeral: string | null }) {
  const totOntem = o.resumoContas.reduce((s, c) => s + c.gasto_ontem, 0);
  const comGasto = o.resumoContas.filter((c) => c.gasto_ontem > 0).length;
  const sev = { critico: 0, atencao: 1, info: 2 } as Record<string, number>;
  const al = [...o.alertas].sort((a, b) => sev[a.severidade] - sev[b.severidade]);
  const L: string[] = [];
  L.push(`*Gestor de Tráfego | ${dm(o.hoje)}*`);
  L.push(`Ontem: ${brl(totOntem)} em ${comGasto} conta(s).`);
  if (o.simGeral) L.push(`Modo simulação (${o.simGeral}): nada foi alterado na Meta.`);
  L.push("");
  L.push(`*Ações* (${o.feitas.length})`);
  if (!o.feitas.length) L.push("Nenhuma ação hoje.");
  for (const a of o.feitas) L.push(`${a.conta_nome}: ${fraseFeita(a)}. Motivo: ${a.motivo}. [#${a.id}]`);
  L.push("");
  L.push(`*Alertas* (${al.length})`);
  if (!al.length) L.push("Nenhum alerta.");
  for (const a of al) L.push(`${a.severidade === "critico" ? "🔴" : a.severidade === "atencao" ? "🟡" : "⚪"} ${a.conta_nome}: ${a.mensagem}.`);
  L.push("");
  L.push(`*Contas* (${dm(o.w7)} a ${dm(o.ontem)})`);
  for (const c of [...o.resumoContas].sort((a, b) => b.gasto_7d - a.gasto_7d)) {
    if (c.gasto_7d <= 0) continue;
    const r = c.resultados[0];
    const res = r ? ` | ${fmt(r.res)} ${r.nome}${r.cpr !== null ? ` a ${brl(r.cpr)}` : ""}${r.alvo ? ` (${r.fonte === "meta" ? "meta" : "ref"} ${brl(r.alvo)})` : ""}` : "";
    L.push(`${c.nome}: ${brl(c.gasto_7d)}${res}`);
  }
  const parados = o.resumoContas.filter((c) => c.gasto_7d <= 0).map((c) => c.nome);
  if (parados.length) L.push(`Sem gasto na semana: ${parados.join(", ")}.`);
  L.push("");
  L.push("Para desfazer: \"desfaz #número\".");
  const whatsapp = L.join("\n");

  // email
  const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const td = "padding:8px 10px;font-size:13px;border-bottom:1px solid #e8e5de;vertical-align:top;";
  const th = "padding:8px 10px;font-size:11px;color:#707070;text-align:left;border-bottom:1px solid #e8e5de;";
  let h = `<div style="background:#f4f2ed;padding:24px 12px;font-family:Poppins,Arial,sans-serif;"><div style="max-width:760px;margin:0 auto;background:#fff;border:1px solid #e8e5de;padding:26px 22px;color:#1a1a1a;">`;
  h += `<div style="font-size:11px;letter-spacing:.12em;color:#b08a2e;font-weight:600;">AMPY DIGITAL · GESTOR DE TRÁFEGO</div>`;
  h += `<div style="font-size:21px;font-weight:600;margin:6px 0 2px;">Rodada de ${dm(o.hoje)}</div>`;
  h += `<div style="font-size:13px;color:#707070;">Ontem: ${brl(totOntem)} em ${comGasto} conta(s). Janela das regras: ${dm(o.w7)} a ${dm(o.ontem)}.</div>`;
  if (o.simGeral) h += `<div style="margin-top:12px;padding:8px 10px;border:1px solid #b08a2e;font-size:13px;">Modo simulação (${esc(o.simGeral)}): nada foi alterado na Meta. A lista mostra o que o gestor faria.</div>`;
  h += `<div style="font-size:15px;font-weight:600;margin:24px 0 8px;">Ações (${o.feitas.length})</div>`;
  if (!o.feitas.length) h += `<div style="font-size:13px;">Nenhuma ação.</div>`;
  else {
    h += `<table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;"><tr><th style="${th}">#</th><th style="${th}">Conta</th><th style="${th}">Ação</th><th style="${th}">Motivo</th><th style="${th}">Status</th></tr>`;
    for (const a of o.feitas) h += `<tr><td style="${td}">${a.id}</td><td style="${td}font-weight:600;">${esc(a.conta_nome)}</td><td style="${td}">${esc(descreverAcao(a))}</td><td style="${td}">${esc(a.motivo)}</td><td style="${td}">${esc(a.status)}${a.erro && a.status !== "simulado" ? `<br><span style="font-size:11px;color:#a8322d;">${esc(a.erro)}</span>` : ""}</td></tr>`;
    h += `</table>`;
  }
  h += `<div style="font-size:15px;font-weight:600;margin:24px 0 8px;">Alertas (${al.length})</div>`;
  if (!al.length) h += `<div style="font-size:13px;">Nenhum alerta.</div>`;
  for (const a of al) h += `<div style="font-size:13px;padding:6px 0;border-bottom:1px solid #e8e5de;"><span style="color:${a.severidade === "critico" ? "#a8322d" : a.severidade === "atencao" ? "#b08a2e" : "#707070"};font-weight:600;">${a.severidade === "critico" ? "Crítico" : a.severidade === "atencao" ? "Atenção" : "Info"}</span> · <b>${esc(a.conta_nome)}</b>: ${esc(a.mensagem)}.</div>`;
  h += `<div style="font-size:15px;font-weight:600;margin:24px 0 8px;">Contas (${dm(o.w7)} a ${dm(o.ontem)})</div>`;
  h += `<table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;"><tr><th style="${th}">Conta</th><th style="${th}text-align:right;">Ontem</th><th style="${th}text-align:right;">7 dias</th><th style="${th}">Resultados</th><th style="${th}text-align:right;">Custo</th><th style="${th}text-align:right;">Meta / ref.</th></tr>`;
  for (const c of [...o.resumoContas].sort((a, b) => b.gasto_7d - a.gasto_7d)) {
    const rs = c.resultados.length ? c.resultados : [null];
    rs.forEach((r: J | null, i: number) => {
      h += `<tr>${i === 0 ? `<td style="${td}font-weight:600;" rowspan="${rs.length}">${esc(c.nome)}${c.modo !== "executar" ? `<br><span style="font-size:11px;color:#707070;">${esc(c.modo)}</span>` : ""}</td><td style="${td}text-align:right;" rowspan="${rs.length}">${brl(c.gasto_ontem)}</td><td style="${td}text-align:right;" rowspan="${rs.length}">${brl(c.gasto_7d)}</td>` : ""}`;
      h += r ? `<td style="${td}">${fmt(r.res)} ${esc(r.nome)}</td><td style="${td}text-align:right;">${r.roas !== null ? `ROAS ${fmt(r.roas, 2)}` : brl(r.cpr)}</td><td style="${td}text-align:right;">${r.roas_alvo ? `ROAS ${fmt(r.roas_alvo, 2)}` : r.alvo ? `${brl(r.alvo)}<br><span style="font-size:11px;color:#707070;">${r.fonte === "meta" ? "meta" : "média 30d"}</span>` : "sem ref."}</td>` : `<td style="${td}" colspan="3"><span style="color:#707070;">sem resultado</span></td>`;
      h += `</tr>`;
    });
  }
  h += `</table>`;
  h += `<div style="font-size:11px;color:#707070;margin-top:22px;line-height:1.6;">Regras: anúncio sem resultado ou com custo acima de 2x a referência é pausado (nunca o último do conjunto); orçamento cai 20% quando o custo passa de 1,4x a referência e sobe 20% quando fica abaixo de 0,8x, só com orçamento mensal cadastrado. Referência = meta cadastrada ou custo médio dos últimos 30 dias. Para desfazer uma ação, responda no WhatsApp "desfaz #número".</div>`;
  h += `</div></div>`;
  const nAcoes = o.feitas.filter((a) => a.status === "executado").length;
  const nCrit = al.filter((a) => a.severidade === "critico").length;
  const assunto = `Gestor de Tráfego | ${dm(o.hoje)} | ${o.simGeral ? `${o.feitas.length} ação(ões) simulada(s)` : `${nAcoes} ação(ões)`}${nCrit ? ` | ${nCrit} crítico(s)` : ""}`;
  return { whatsapp, html: h, assunto };
}

// ---------- desfazer e manual ----------
async function desfazer(body: J) {
  const C = await carregarConfig();
  const [a] = await sb(`trafego_acoes?select=*&id=eq.${Number(body.acao_id)}`);
  if (!a) return { ok: false, error: "ação não encontrada" };
  if (a.status !== "executado") return { ok: false, error: `ação está como ${a.status}, só dá para desfazer ação executada` };
  if (a.desfeito_at) return { ok: false, error: "ação já foi desfeita" };
  const inversa: Acao = {
    meta_account_id: a.meta_account_id, conta_nome: a.conta_nome, nivel: a.nivel, objeto_id: a.objeto_id, objeto_nome: a.objeto_nome,
    tipo: a.tipo === "pausar" ? "reativar" : a.tipo === "reativar" ? "pausar" : "ajustar_orcamento",
    regra: "desfazer", motivo: `desfaz a ação #${a.id}`, antes: a.depois, depois: a.antes, origem: String(body.origem || "manual"), desfaz_acao_id: a.id,
  };
  const r = await aplicar(inversa, null, C.token, null);
  if (r.status === "executado") await patch(`trafego_acoes?id=eq.${a.id}`, { status: "desfeito", desfeito_at: new Date().toISOString() });
  return { ok: r.status === "executado", acao: r, texto: r.status === "executado" ? `Desfeito: ${fraseFeita(r)}.` : `Não consegui desfazer: ${r.erro}` };
}

async function manual(body: J) {
  const C = await carregarConfig();
  const nivel = String(body.nivel || "");
  if (!TABELA[nivel]) return { ok: false, error: "nivel deve ser campaign, adset ou ad" };
  const [tab, col] = TABELA[nivel];
  const [obj] = await sb(`${tab}?select=*&${col}=eq.${encodeURIComponent(String(body.objeto_id))}`);
  if (!obj) return { ok: false, error: "objeto não encontrado no banco (sincronize a conta)" };
  const [conta] = await sb(`meta_ad_accounts?select=meta_account_id,name&id=eq.${obj.ad_account_id}`);
  const tipo = String(body.tipo);
  let acao: Acao;
  const base = { meta_account_id: conta.meta_account_id, conta_nome: nomeConta(conta.name), nivel: nivel as Acao["nivel"], objeto_id: String(body.objeto_id), objeto_nome: obj.name, regra: "manual", motivo: String(body.motivo || "pedido da equipe"), origem: String(body.origem || "manual") };
  if (tipo === "pausar") acao = { ...base, tipo: "pausar", antes: { status: "ACTIVE" }, depois: { status: "PAUSED" } };
  else if (tipo === "reativar") acao = { ...base, tipo: "reativar", antes: { status: "PAUSED" }, depois: { status: "ACTIVE" } };
  else if (tipo === "orcamento") {
    const valor = Number(body.valor);
    if (!(valor > 0)) return { ok: false, error: "informe valor (orçamento diário em reais)" };
    if (nivel === "ad") return { ok: false, error: "orçamento é na campanha ou no conjunto" };
    acao = { ...base, tipo: "ajustar_orcamento", antes: { daily_budget: Number(obj.daily_budget || 0) }, depois: { daily_budget: valor } };
  } else return { ok: false, error: "tipo deve ser pausar, reativar ou orcamento" };
  const r = await aplicar(acao, C.execucaoAtiva ? null : "execução geral desligada", C.token, null);
  return { ok: r.status === "executado", acao: r, texto: `${fraseFeita(r)}. [#${r.id}]` };
}

async function salvarMeta(body: J) {
  const act = String(body.meta_account_id || "");
  const [conta] = await sb(`meta_ad_accounts?select=meta_account_id,name&meta_account_id=eq.${encodeURIComponent(act)}`);
  if (!conta) return { ok: false, error: "conta não encontrada" };
  const now = new Date().toISOString();
  const cc: J = { meta_account_id: act, updated_at: now };
  for (const k of ["modo", "orcamento_mensal", "objetivo_negocio", "observacoes"]) if (body[k] !== undefined && body[k] !== "") cc[k] = body[k];
  if (Object.keys(cc).length > 2) await sb("trafego_contas?on_conflict=meta_account_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(cc) });
  const mt: J = { meta_account_id: act, result_indicator: body.result_indicator || "*", updated_at: now };
  for (const k of ["cpr_alvo", "cpr_max", "roas_alvo", "nome_resultado"]) if (body[k] !== undefined && body[k] !== "") mt[k] = body[k];
  if (Object.keys(mt).length > 3) await sb("trafego_metas?on_conflict=meta_account_id,result_indicator", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(mt) });
  const [contaCfg] = await sb(`trafego_contas?select=*&meta_account_id=eq.${act}`);
  const metasConta = await sb(`trafego_metas?select=*&meta_account_id=eq.${act}`);
  return { ok: true, conta: nomeConta(conta.name), config: contaCfg, metas: metasConta };
}

async function historico(body: J) {
  const dias = Math.min(Math.max(Number(body.dias) || 7, 1), 90);
  const desde = new Date(Date.now() - dias * DAY).toISOString();
  const f = body.conta ? `&meta_account_id=eq.${encodeURIComponent(String(body.conta))}` : "";
  const acoes = await sb(`trafego_acoes?select=id,created_at,conta_nome,nivel,objeto_id,objeto_nome,tipo,motivo,antes,depois,status,erro,origem,desfeito_at&created_at=gte.${desde}${f}&order=created_at.desc&limit=100`);
  const alertas = await sb(`trafego_alertas?select=dia,conta_nome,tipo,severidade,mensagem&created_at=gte.${desde}${f}&order=created_at.desc&limit=100`);
  return { ok: true, dias, acoes, alertas };
}

async function statusGestor() {
  const C = await carregarConfig();
  const [ult] = await sb("trafego_execucoes?select=id,started_at,finished_at,origem,modo,erro&order=id.desc&limit=1");
  const contas = await sb("trafego_contas?select=meta_account_id,modo,orcamento_mensal");
  const metas = await sb("trafego_metas?select=meta_account_id,result_indicator,cpr_alvo,roas_alvo");
  return { ok: true, execucao_ativa: C.execucaoAtiva, token_escrita: !!C.token, regras: C.R, equipe_whatsapp: C.equipeWhats, equipe_email: C.equipeEmail, ultima_rodada: ult ?? null, contas, metas };
}

// ---------- entrada ----------
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  let expected: string | null = null;
  try { expected = await rpc("n8n_traffic_secret"); } catch { return json({ ok: false, error: "segredo indisponível" }, 500); }
  if (!expected || req.headers.get("x-api-key") !== expected) return json({ ok: false, error: "unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));
  try {
    switch (String(body.action || "")) {
      case "rodar": return json(await rodar(body));
      case "desfazer": return json(await desfazer(body));
      case "manual": return json(await manual(body));
      case "salvar_meta": return json(await salvarMeta(body));
      case "historico": return json(await historico(body));
      case "status": return json(await statusGestor());
      default: return json({ ok: false, error: "action: rodar, desfazer, manual, salvar_meta, historico ou status" }, 400);
    }
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

