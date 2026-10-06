// Layout v5: modelo "Modelo · Relatório de Tráfego v5" com chaves {{...}} (Slides 1yBhLkeYOB7HortFtJ7UcZHiA5_rETtv_7H6vZg72WxA).
// Páginas: capa, 01 resumo (6 indicadores), 02 estratégia do funil, 03 funil de vendas (vendas sempre, "?" sem venda validada),
//          04 campanhas, 05 comparativo (até 15 linhas), criativos por etapa (Base, Meio, Fundo, até 3 cada), comercial.
// Regras:
//  - Etapa da campanha 100% pelo nome: a primeira palavra de etapa encontrada decide. BASE/BAS/TOPO = Base; MEIO/MID = Meio; FUNDO/FUN/END = Fundo.
//    Sem palavra de etapa no nome: Meio (regra da dúvida), com aviso na revisão.
//  - Campanha com VAGAS no nome fica fora dos funis, do resumo, do comparativo e dos criativos; aparece só na tabela de campanhas.
//  - Resultado do funil (leads) usa só campanhas de Meio e Fundo: conversas, formulários e cadastros. Sem isso, checkouts; sem isso, visitas ao perfil.
//  - Funil de vendas usa o alcance de Meio e Fundo sem pessoas repetidas (consulta própria na Meta).
//  - Vendas só com vendas validadas (traffic_report_clients.sales_validated). Sem isso, o funil mostra "?" na etapa de vendas (preenchido em reunião)
//    e o comparativo e a página comercial saem.
//  - Nenhum indicador mistura objetivos: nada de CTR ou CPC de link somados entre objetivos.
//  - Campanhas excluídas (settings.exclude_campaigns) ficam fora de tudo, inclusive do investimento total.
type Json = Record<string, any>;
type Stage = "base" | "meio" | "fundo";
const STAGES: Stage[] = ["base", "meio", "fundo"];
const STAGE_NAME: Record<Stage, string> = { base: "Base", meio: "Meio", fundo: "Fundo" };
export const TEMPLATE_V5 = "1yBhLkeYOB7HortFtJ7UcZHiA5_rETtv_7H6vZg72WxA";

// ---------- objectIds do modelo ----------
const ID = {
  distSeg: { base: "p2_i33", meio: "p2_i34", fundo: "p2_i35" } as Record<Stage, string>,
  distLabel: { base: ["p2_i36", "p2_i37"], meio: ["p2_i38", "p2_i39"], fundo: ["p2_i40", "p2_i41"] } as Record<Stage, string[]>,
  pctFill: { base: "p3_i17", meio: "p3_i33", fundo: "p3_i49" } as Record<Stage, string>,
  campRows: [
    ["p5_i15", "p5_i16", "p5_i17", "p5_i18", "p5_i19", "p5_i20", "p5_i21", "p5_i22"],
    ["p5_i24", "p5_i25", "p5_i26", "p5_i27", "p5_i28", "p5_i29", "p5_i30", "p5_i31"],
    ["p5_i33", "p5_i34", "p5_i35", "p5_i36", "p5_i37", "p5_i38", "p5_i39", "p5_i40"],
    ["p5_i42", "p5_i43", "p5_i44", "p5_i45", "p5_i46", "p5_i47", "p5_i48", "p5_i49"],
    ["p5_i51", "p5_i52", "p5_i53", "p5_i54", "p5_i55", "p5_i56", "p5_i57", "p5_i58"],
    ["p5_i61", "p5_i62", "p5_i63", "p5_i64", "p5_i65", "p5_i66", "p5_i67", "p5_i68"],
  ],
  campLines: ["p5_i23", "p5_i32", "p5_i41", "p5_i50", "p5_i60", "p5_i59"],
  obs: { line: "p5_i69", label: "p5_i70", text: "p5_i71" },
  // Páginas de criativos: uma por etapa. Prefixo dos elementos e chave das variáveis.
  creativePage: { base: { page: "p7", pre: "p7", key: "cb" }, meio: { page: "p7meio", pre: "p7m", key: "cm" }, fundo: { page: "p7fundo", pre: "p7f", key: "cf" } } as Record<Stage, { page: string; pre: string; key: string }>,
  creativeCol: [
    { els: [7, 8, 9, 10, 11, 12, 13, 15], badge: [8, 9], x: 1143000 },
    { els: [17, 18, 19, 20, 21, 22, 23, 25], badge: [18, 19], x: 6604000 },
    { els: [27, 28, 29, 30, 31, 32, 33, 35], badge: [28, 29], x: 12065001 },
  ],
  pages: ["p2", "p3", "p4", "p5", "p6", "p7", "p7meio", "p7fundo", "p8"],
  kicker: { p2: "p2_i3", p3: "p3_i3", p4: "p4_i3", p5: "p5_i3", p6: "p6_i3", p7: "p7_i3", p7meio: "p7m_i3", p7fundo: "p7f_i3", p8: "p8_i3" } as Record<string, string>,
};
// Geometria (EMU). Base 3.000.000 x 3.000.000 em todas as formas.
const G = {
  distX0: 1143000, distW: 16001999, distY: 7350000, distSY: 500000 / 3e6,
  distLabelY: 7950000, distValueY: 7930950, distValueOffset: { base: 736104, meio: 736104, fundo: 891581 } as Record<Stage, number>,
  distLabelSX: { base: 0.232668, meio: 0.232668, fundo: 0.284493 } as Record<Stage, number>,
  distValueSX: { base: 0.660135, meio: 0.708286, fundo: 0.762784 } as Record<Stage, number>,
  pctTrackW: 2357438, pctX: 6810276, pctY: { base: 3721100, meio: 5130800, fundo: 6540500 } as Record<Stage, number>, pctSY: 0.01905,
  campLineY: [4197350, 5232400, 6267450, 7302500, 8337550, 9372600],
  creativeY: 2730500, creativeSize: 5080000,
  // Comparativo: linha i começa em compY0 + i * pitch; colunas com escala e x fixos.
  compY0: 3140000, compPitch: 440000, compTextDY: 80000,
  compCols: { l: [2.279875, 0.12065, 1143000], a: [1.139974, 0.12065, 7202339], t: [1.139937, 0.12065, 10463769], v: [1.139974, 0.12065, 13725079], ln: [5.334, 0.003175, 1143000] } as Record<string, number[]>,
};

// ---------- resultados ----------
const LEAD_LABELS = ["Conversas iniciadas", "Leads", "Cadastros"];
const CHECKOUT = "Finalizações de compra iniciadas";
const VISIT = "Visitas ao perfil";
const UNIT: Record<string, [string, string]> = {
  "Conversas iniciadas": ["conversas", "conversa"], "Leads": ["leads", "lead"], "Cadastros": ["cadastros", "cadastro"],
  [CHECKOUT]: ["checkouts", "checkout"], "Compras": ["compras", "compra"], [VISIT]: ["visitas ao perfil", "visita ao perfil"],
  "Cliques no link": ["cliques", "clique"], "Visualizações da página de destino": ["visitas ao site", "visita ao site"],
  "Visualizações de vídeo": ["visualizações", "visualização"], "Engajamentos": ["engajamentos", "engajamento"],
  "Adições ao carrinho": ["adições ao carrinho", "adição ao carrinho"], "Alcance": ["pessoas alcançadas", "pessoa alcançada"],
};
const COST_UNIT: Record<string, string> = { [VISIT]: "visita", "Visualizações da página de destino": "visita", "Alcance": "mil pessoas" };
const ORDER = [...LEAD_LABELS, "Compras", CHECKOUT, "Adições ao carrinho", "Visualizações da página de destino", VISIT, "Cliques no link", "Engajamentos", "Visualizações de vídeo", "Alcance"];
const OBJ_BY_RESULT: Record<string, string> = {
  "Conversas iniciadas": "Mensagens", "Leads": "Formulário", "Cadastros": "Formulário", [VISIT]: "Perfil", [CHECKOUT]: "Site", "Compras": "Site",
  "Adições ao carrinho": "Site", "Visualizações da página de destino": "Site", "Cliques no link": "Tráfego", "Engajamentos": "Engajamento", "Visualizações de vídeo": "Vídeo",
};
const OBJECTIVE: Record<string, string> = {
  OUTCOME_ENGAGEMENT: "Engajamento", OUTCOME_SALES: "Vendas", OUTCOME_LEADS: "Formulário", OUTCOME_TRAFFIC: "Tráfego",
  OUTCOME_AWARENESS: "Alcance", LINK_CLICKS: "Tráfego", MESSAGES: "Mensagens", POST_ENGAGEMENT: "Engajamento", REACH: "Alcance", VIDEO_VIEWS: "Vídeo",
};
const FORMAT: Record<string, string> = { VIDEO: "Vídeo", PHOTO: "Imagem", SHARE: "Imagem", STATUS: "Post", OFFER: "Oferta", MULTI_SHARE: "Carrossel", LINK: "Link" };
type FunnelType = "leads" | "checkouts" | "visitas";
const FUN_LABEL: Record<FunnelType, string> = { leads: "LEADS", checkouts: "CHECKOUTS", visitas: "VISITAS" };
const TYPE: Record<FunnelType, { kpi: string; cost: string; row: string; rowCost: string; unit: string; unit1: string; tx: string; tx2: string; labels: string[] }> = {
  leads: { kpi: "LEADS", cost: "CUSTO POR LEAD", row: "Leads", rowCost: "Custo por lead", unit: "leads", unit1: "lead", tx: "do alcance virou lead", tx2: "dos leads virou venda", labels: LEAD_LABELS },
  checkouts: { kpi: "CHECKOUTS", cost: "CUSTO POR CHECKOUT", row: "Checkouts", rowCost: "Custo por checkout", unit: "checkouts", unit1: "checkout", tx: "do alcance iniciou checkout", tx2: "dos checkouts virou venda", labels: [CHECKOUT] },
  visitas: { kpi: "VISITAS AO PERFIL", cost: "CUSTO POR VISITA", row: "Visitas ao perfil", rowCost: "Custo por visita", unit: "visitas", unit1: "visita", tx: "do alcance visitou o perfil", tx2: "das visitas virou venda", labels: [VISIT] },
};

// ---------- formatação pt-BR ----------
function num(n: number, d = 0) {
  const [i, f] = Math.abs(n).toFixed(d).split(".");
  return (n < 0 ? "−" : "") + i.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (f ? "," + f : "");
}
const has = (n: unknown) => n !== null && n !== undefined && n !== "" && !Number.isNaN(Number(n)) && Number.isFinite(Number(n));
const brl = (n: unknown) => (has(n) ? "R$ " + num(Number(n), 2) : "sem dados");
const int = (n: unknown) => (has(n) ? num(Number(n), 0) : "sem dados");
const pct = (n: unknown, d = 1) => (has(n) ? num(Number(n), d) + "%" : "sem dados");
const signed = (n: unknown) => (has(n) ? (Number(n) > 0 ? "+" : "") + num(Number(n), 0) : "sem dados");
const dm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const dmy = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
const range = (a: string, b: string) => `${dm(a)} a ${dm(b)}`;
const div = (a: number, b: number) => (b > 0 ? a / b : null);
function variation(cur: unknown, prev: unknown) {
  if (!has(cur) || !has(prev) || Number(prev) === 0) return "";
  const v = ((Number(cur) - Number(prev)) / Number(prev)) * 100;
  if (Math.abs(v) < 0.5) return "0%";
  return (v > 0 ? "+" : "−") + num(Math.abs(v), 0) + "%";
}
function slug(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
function clean(name: string, max: number) {
  let t = String(name || "").replace(/\[|\]/g, "").replace(/\(|\)/g, " ").replace(/\s+-\s+/g, " · ").replace(/\s*\|\s*/g, " / ").replace(/\s+/g, " ").trim();
  if (t.length > max) t = t.slice(0, max - 1).trimEnd() + "…";
  return t;
}
const withoutStage = (name: string) => String(name || "").replace(/^\s*\[[^\]]*\]\s*(-\s*)?/, "");
const lastPart = (name: string) => {
  const parts = [...String(name || "").matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
  return parts.length ? parts[parts.length - 1] : withoutStage(name);
};

const words = (name: string) => String(name || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().split(/[^A-Z]+/).filter(Boolean);
export function isVagas(name: string): boolean {
  return words(name).some((w) => w === "VAGAS" || w === "VAGA");
}
// Etapa escrita no nome (primeira encontrada) ou null quando o nome não diz.
export function explicitStage(name: string): Stage | null {
  for (const w of words(name)) {
    if (["BASE", "BAS", "TOPO"].includes(w)) return "base";
    if (["MEIO", "MID"].includes(w)) return "meio";
    if (["FUNDO", "FUN", "END"].includes(w)) return "fundo";
  }
  return null;
}
// Na dúvida, Meio.
export function stageOf(name: string): Stage {
  return explicitStage(name) ?? "meio";
}

type Camp = { id: string; name: string; stage: Stage | null; vagas: boolean; guessed: boolean; spend: number; impressions: number; results: { label: string; count: number; cost: number | null }[]; objective: string };
function camps(report: Json, excluded: string[]): Camp[] {
  return (report?.campaigns ?? [])
    .filter((c: Json) => !excluded.includes(String(c.name)) && Number(c.spend) > 0)
    .map((c: Json) => ({
      id: String(c.campaign_id), name: String(c.name), vagas: isVagas(c.name), stage: isVagas(c.name) ? null : stageOf(c.name),
      guessed: !isVagas(c.name) && explicitStage(c.name) === null, spend: Number(c.spend), impressions: Number(c.impressions ?? 0),
      results: (c.results ?? []).map((r: Json) => ({ label: String(r.label), count: Number(r.count ?? 0), cost: has(r.cost) ? Number(r.cost) : null })).filter((r: Json) => r.count > 0),
      objective: String(c.objective ?? ""),
    }))
    .sort((a: Camp, b: Camp) => b.spend - a.spend);
}
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
function counts(cs: Camp[]) {
  const m: Record<string, number> = {};
  for (const c of cs) for (const r of c.results) m[r.label] = (m[r.label] ?? 0) + r.count;
  return m;
}
const rank = (l: string) => (ORDER.indexOf(l) + 99) % 99;
const typeCount = (cs: Camp[], t: FunnelType) => { const m = counts(cs); return sum(TYPE[t].labels.map((l) => m[l] ?? 0)); };
function resultText(m: Record<string, number>, max = 2) {
  const labels = Object.keys(m).filter((l) => m[l] > 0).sort((a, b) => rank(a) - rank(b) || m[b] - m[a]);
  return labels.slice(0, max).map((l) => `${int(m[l])} ${m[l] === 1 ? (UNIT[l]?.[1] ?? l.toLowerCase()) : (UNIT[l]?.[0] ?? l.toLowerCase())}`).join(" · ");
}
function costText(spend: number, m: Record<string, number>) {
  const leadLabels = LEAD_LABELS.filter((l) => (m[l] ?? 0) > 0);
  if (leadLabels.length) {
    const n = sum(leadLabels.map((l) => m[l]));
    const unit = leadLabels.length === 1 ? (UNIT[leadLabels[0]][1]) : "lead";
    return `${brl(spend / n)} por ${unit}`;
  }
  const first = Object.keys(m).filter((l) => m[l] > 0).sort((a, b) => rank(a) - rank(b))[0];
  if (!first) return "";
  return `${brl(spend / m[first])} por ${COST_UNIT[first] ?? UNIT[first]?.[1] ?? "resultado"}`;
}

export function buildReportV5(report: Json, prevReport: Json, extra: Json, body: Json, cfg: Json) {
  const c = report.client ?? {};
  const cur = report.current ?? {};
  const prevT = report.previous_totals ?? null;
  const period = report.period; const previous = report.previous;
  const texts = body.texts ?? {};
  const review = cfg.review_mode === true || body.review === true;
  const cfgExcluded = (cfg.exclude_campaigns ?? {})[c.report_client_id];
  const excluded: string[] = (Array.isArray(body.exclude_campaigns) ? body.exclude_campaigns : Array.isArray(cfgExcluded) ? cfgExcluded : []).map(String);
  const warnings: string[] = [];
  const requests: Json[] = [];
  const images: Json[] = [];
  const filled: Record<string, string> = {};
  const deleted = new Set<string>();
  const label = String(body.report_label ?? cfg.report_label ?? "semanal").toLowerCase();

  const put = (key: string, value: string) => {
    filled[key] = value;
    requests.push({ replaceAllText: { containsText: { text: `{{${key}}}`, matchCase: true }, replaceText: value } });
  };
  const swap = (page: string, from: string, to: string) => {
    if (from !== to) requests.push({ replaceAllText: { containsText: { text: from, matchCase: true }, replaceText: to, pageObjectIds: [page] } });
  };
  const del = (id: string) => { if (!deleted.has(id)) { deleted.add(id); requests.push({ deleteObject: { objectId: id } }); } };
  const move = (id: string, sx: number, sy: number, x: number, y: number) =>
    requests.push({ updatePageElementTransform: { objectId: id, applyMode: "ABSOLUTE", transform: { scaleX: sx, scaleY: sy, shearX: 0, shearY: 0, translateX: Math.round(x), translateY: Math.round(y), unit: "EMU" } } });

  if (excluded.length) warnings.push(`campanhas excluídas: ${excluded.join(", ")}`);

  // ---------- campanhas e etapas ----------
  const allNow = camps(report, excluded);
  const now = allNow.filter((x) => !x.vagas);
  const vagasNow = allNow.filter((x) => x.vagas);
  const before = camps(prevReport, excluded).filter((x) => !x.vagas);
  const comparable = sum(before.map((x) => x.spend)) > 0;
  const guessed = now.filter((x) => x.guessed);
  if (guessed.length) warnings.push(`campanhas sem etapa no nome, consideradas Meio: ${guessed.map((x) => x.name).join(", ")}`);
  if (vagasNow.length) warnings.push(`campanhas de vagas fora dos funis: ${vagasNow.map((x) => x.name).join(", ")}`);
  const byStage = (cs: Camp[], s: Stage) => cs.filter((x) => x.stage === s);
  const totalNow = sum(now.map((x) => x.spend));
  const totalBefore = sum(before.map((x) => x.spend));
  if (!(totalNow > 0)) warnings.push("sem investimento no período");

  // Escopo do funil: Meio e Fundo. Sem campanha nessas etapas, usa todas e tira a página do funil de vendas.
  const scopeNow = now.filter((x) => x.stage === "meio" || x.stage === "fundo");
  const scopeBefore = before.filter((x) => x.stage === "meio" || x.stage === "fundo");
  const hasScope = sum(scopeNow.map((x) => x.spend)) > 0;
  const sNow = hasScope ? scopeNow : now;
  const sBefore = hasScope ? scopeBefore : before;
  if (!hasScope) warnings.push("sem campanhas de meio e fundo: página do funil de vendas removida e resumo usa todas as campanhas");
  const ft: FunnelType = typeCount(sNow, "leads") > 0 ? "leads" : typeCount(sNow, "checkouts") > 0 ? "checkouts" : typeCount(sNow, "visitas") > 0 ? "visitas" : "leads";
  const T = TYPE[ft];
  const leadsNow = typeCount(sNow, ft), leadsBefore = typeCount(sBefore, ft);
  const spendScopeNow = sum(sNow.map((x) => x.spend)), spendScopeBefore = sum(sBefore.map((x) => x.spend));
  const cplNow = div(spendScopeNow, leadsNow), cplBefore = div(spendScopeBefore, leadsBefore);
  const sales = c.sales_validated === true && Number(cur.purchases ?? 0) > 0;

  // Textos automáticos (body.auto_texts): só números do período, sem recomendação. Texto informado no body tem prioridade.
  const auto = body.auto_texts === true;
  const noPer = label === "mensal" ? "no mês" : label === "quinzenal" ? "na quinzena" : "na semana";
  const antPer = label === "mensal" ? "Mês anterior" : label === "quinzenal" ? "Quinzena anterior" : "Semana anterior";
  const corta = (s: string, max = 160) => (s.length <= max ? s : s.slice(0, max - 1).replace(/[\s,.;:]+$/, "") + ".");
  const autoLeitura = () => {
    let t = `Investimento de ${brl(totalNow)} ${noPer}`;
    t += leadsNow > 0 ? `, ${int(leadsNow)} ${leadsNow === 1 ? T.unit1 : T.unit} a ${brl(cplNow)} cada.` : `, sem ${T.unit} no funil.`;
    if (comparable && leadsBefore > 0) t += ` ${antPer}: ${int(leadsBefore)} a ${brl(cplBefore)}.`;
    return corta(t);
  };
  const autoObs = () => {
    if (!now.length || !(totalNow > 0)) return "";
    const top = now[0];
    let t = `${clean(top.name, 40)} ficou com ${pct((top.spend / totalNow) * 100, 0)} da verba.`;
    const comRes = sNow.map((x) => ({ x, n: typeCount([x], ft) })).filter((o) => o.n > 0).sort((a, b) => b.n - a.n);
    if (comRes.length) {
      const b = comRes[0];
      const custo = brl(b.x.spend / b.n);
      t += b.x.id === top.id ? ` Também trouxe mais ${T.unit} (${int(b.n)} a ${custo}).` : ` ${clean(b.x.name, 40)} trouxe mais ${T.unit} (${int(b.n)} a ${custo}).`;
    }
    return corta(t);
  };

  // Rótulos fixos do modelo quando o resultado do funil não é lead
  if (ft !== "leads") {
    for (const p of ["p2", "p4"]) { swap(p, "CUSTO POR LEAD", T.cost); swap(p, "LEADS", p === "p4" ? FUN_LABEL[ft] : T.kpi); }
    swap("p4", "do alcance virou lead", T.tx);
    swap("p6", "Custo por lead", T.rowCost); swap("p6", "Leads", T.row);
  }

  // ---------- capa ----------
  put("periodo_tipo", label === "quinzenal" ? "quinzenais." : label === "mensal" ? "mensais." : "semanais.");
  put("cliente", c.display_name ?? "");
  put("gestor", c.manager_name ?? cfg.default_manager_name ?? "Ampy Digital");
  put("periodo_atual", range(period.since, period.until));
  put("periodo_ant", comparable ? range(previous.since, previous.until) : "sem período anterior");

  // ---------- números da conta (sem vagas e sem excluídas) ----------
  // Alcance e impressões consultados na Meta para o grupo de campanhas do funil (sem repetir pessoas).
  const ra = extra.reachAll ?? null, rp = extra.reachAllPrev ?? null;
  const alcA = ra?.reach || cur.reach, alcB = rp?.reach || prevT?.reach;
  const impA = ra?.impressions || cur.impressions, impB = rp?.impressions || prevT?.impressions;
  const frA = ra?.reach ? ra.impressions / ra.reach : cur.frequency, frB = rp?.reach ? rp.impressions / rp.reach : prevT?.frequency;
  const cpmA = has(impA) && Number(impA) > 0 ? (totalNow / Number(impA)) * 1000 : null;
  const cpmB = has(impB) && Number(impB) > 0 ? (totalBefore / Number(impB)) * 1000 : null;
  if (excluded.length && !(ra?.reach)) warnings.push("alcance e frequência da conta ainda incluem as campanhas excluídas");
  // Seguidores: novos seguidores do Instagram no período (Meta, conta do Instagram ligada ao anúncio).
  const fl = extra.followers ?? null;
  const segA = has(fl?.current) ? Number(fl.current) : null, segB = has(fl?.previous) ? Number(fl.previous) : null;
  if (segA === null) warnings.push(`novos seguidores indisponíveis${fl?.error ? ` (${fl.error})` : ""}`);
  // Engajamento: soma das ações das campanhas do funil.
  const eng = extra.engagement ?? {};
  const engA = eng.current ?? null, engB = eng.previous ?? null;
  const visA = typeCount(now, "visitas"), visB = typeCount(before, "visitas");

  // ---------- 01 resumo ----------
  const ant = (v: unknown, fmt: (n: unknown) => string, show = comparable) => (show && has(v) ? `Ant. ${fmt(v)}` : "Ant. sem dados");
  const vr = (a: unknown, b: unknown, show = comparable) => (show ? variation(a, b) : "");
  const card = (key: string, a: unknown, b: unknown, fmt: (n: unknown) => string, show = comparable) => {
    put(key, fmt(a)); put(`${key}_ant`, ant(b, fmt, show && has(b))); put(`${key}_var`, vr(a, b, show && has(b)));
  };
  card("investimento", totalNow, totalBefore, brl);
  card("leads", leadsNow, leadsBefore, int, comparable && leadsBefore > 0);
  card("cpl", cplNow, cplBefore, brl, comparable && cplBefore !== null);
  card("alcance_total", alcA, alcB, int);
  card("seguidores", segA, segB, signed, segB !== null);
  card("cpm", cpmA, cpmB, brl);
  const stageSpend = (s: Stage) => sum(byStage(now, s).map((x) => x.spend));
  const share = (s: Stage) => (totalNow > 0 ? (stageSpend(s) / totalNow) * 100 : 0);
  for (const s of STAGES) put(`dist_${s}`, pct(share(s)));
  const reading = String(texts.leitura ?? "").trim() || (auto ? autoLeitura() : "");
  if (!reading) warnings.push("leitura rápida não informada");
  put("leitura_rapida", reading || "Leitura do período pendente.");
  // Barra de distribuição proporcional; rótulos acompanham o início de cada parte sem encostar no anterior.
  let x = G.distX0, prevEnd = 0;
  for (const s of STAGES) {
    const w = (share(s) / 100) * G.distW;
    const seg = ID.distSeg[s];
    const [lab, val] = ID.distLabel[s];
    if (w < 20000) { del(seg); del(lab); del(val); continue; }
    move(seg, w / 3e6, G.distSY, x, G.distY);
    const lx = Math.max(x, prevEnd + 250000);
    move(lab, G.distLabelSX[s], 0.112183, lx, G.distLabelY);
    move(val, G.distValueSX[s], 0.12065, lx + G.distValueOffset[s], G.distValueY);
    prevEnd = lx + G.distValueOffset[s] + 750000;
    x += w;
  }

  // ---------- 02 estratégia do funil ----------
  const adsBy: Record<string, number> = extra.adsByCampaign ?? {};
  for (const s of STAGES) {
    const cs = byStage(now, s);
    const sp = sum(cs.map((x) => x.spend));
    const m = counts(cs);
    if (!cs.length) {
      put(`${s}_invest`, "R$ 0,00"); put(`${s}_pct`, "0%"); put(`${s}_res`, "sem campanha no período"); put(`${s}_custo`, "");
      put(`${s}_qtd`, "0"); put(`${s}_camp1`, ""); put(`${s}_camp2`, ""); put(`${s}_mais`, ""); put(`${s}_anuncios`, "0");
      del(ID.pctFill[s]);
      continue;
    }
    put(`${s}_invest`, brl(sp)); put(`${s}_pct`, pct(share(s)));
    const rt = resultText(m).length > 24 ? resultText(m, 1) : resultText(m);
    put(`${s}_res`, rt || "sem resultado"); put(`${s}_custo`, costText(sp, m));
    put(`${s}_qtd`, String(cs.length));
    const names = cs.map((x) => clean(lastPart(x.name), 26));
    put(`${s}_camp1`, names.slice(0, 2).join(" · ") + (names.length > 2 ? ` +${names.length - 2}` : ""));
    put(`${s}_camp2`, ""); put(`${s}_mais`, "");
    const ads = sum(cs.map((x) => adsBy[x.id] ?? 0));
    put(`${s}_anuncios`, ads ? String(ads) : "sem dados");
    const fw = Math.max((share(s) / 100) * G.pctTrackW, 30000);
    move(ID.pctFill[s], fw / 3e6, G.pctSY, G.pctX, G.pctY[s]);
  }

  // ---------- 03 funil de vendas ----------
  if (!hasScope) del("p4");
  else {
    const rc = extra.reach ?? null;
    const imp = rc?.impressions ?? sum(sNow.map((x) => x.impressions));
    const alc = rc?.reach ?? null;
    if (!alc) warnings.push("alcance de meio e fundo indisponível na Meta");
    put("fun_imp", int(imp));
    put("fun_alc", alc ? int(alc) : "sem dados");
    put("fun_freq", alc ? num(imp / alc, 2) : "sem dados");
    put("fun_cpm", alc ? brl((spendScopeNow / alc) * 1000) : "sem dados");
    put("fun_tx_lead", alc ? pct((leadsNow / alc) * 100, 2) : "sem dados");
    put("fun_leads", int(leadsNow));
    put("fun_cpl", brl(cplNow));
    if (sales) {
      const vNow = Number(cur.purchases);
      swap("p4", "dos leads virou venda", T.tx2);
      put("fun_tx_venda", pct(div(vNow * 100, leadsNow), 2)); put("fun_vendas", int(vNow)); put("fun_cpv", brl(div(spendScopeNow, vNow)));
    } else {
      // Vendas do período vêm do cliente, na reunião.
      swap("p4", "dos leads virou venda", `${T.tx2} · informar na reunião`);
      put("fun_tx_venda", "?"); put("fun_vendas", "?"); put("fun_cpv", "?");
    }
  }

  // ---------- 04 campanhas ----------
  const tableCamps = [...now, ...vagasNow];
  const rows = tableCamps.slice(0, 6);
  if (tableCamps.length > 6) warnings.push(`${tableCamps.length} campanhas com investimento; relatório mostra as 6 maiores`);
  ID.campRows.forEach((ids, i) => {
    const k = i + 1;
    const cp = rows[i];
    if (!cp) { ids.forEach(del); del(ID.campLines[i]); for (const f of ["nome", "etapa", "obj", "inv", "pct", "res", "custo"]) filled[`camp${k}_${f}`] = ""; return; }
    const m = counts([cp]);
    const first = cp.results[0];
    put(`camp${k}_nome`, clean(withoutStage(cp.name), 30));
    put(`camp${k}_etapa`, cp.vagas ? "Vagas" : cp.stage ? STAGE_NAME[cp.stage] : "Meio");
    put(`camp${k}_obj`, (first && OBJ_BY_RESULT[first.label]) || OBJECTIVE[cp.objective] || "Outro");
    put(`camp${k}_inv`, brl(cp.spend));
    put(`camp${k}_pct`, cp.vagas ? "fora do funil" : pct(totalNow > 0 ? (cp.spend / totalNow) * 100 : null));
    put(`camp${k}_res`, resultText(m) || "sem resultado");
    put(`camp${k}_custo`, first && first.cost !== null ? brl(first.cost) : "sem dados");
  });
  const n = rows.length;
  const lastLineY = G.campLineY[Math.max(n, 1) - 1];
  if (n >= 6) { del(ID.obs.line); move(ID.obs.label, 0.9779, 0.112183, 1143000, lastLineY + 200000); move(ID.obs.text, 4.316667, 0.213333, 4191000, lastLineY + 200000); }
  else { move(ID.obs.line, 5.334, 0.00635, 1143000, lastLineY + 300000); move(ID.obs.label, 0.9779, 0.112183, 1143000, lastLineY + 550000); move(ID.obs.text, 4.316667, 0.213333, 4191000, lastLineY + 550000); }
  const note = String(texts.observacao ?? "").trim() || (auto ? autoObs() : "");
  if (!note) warnings.push("observação das campanhas não informada");
  put("observacao", note || "Observação pendente.");

  // ---------- 05 comparativo ----------
  // Linhas na ordem do modelo; linha sem dado nos dois períodos sai e as seguintes sobem.
  type Row = { key: string; a: unknown; b: unknown; fmt: (n: unknown) => string; show: boolean; keep: boolean };
  const nz = (v: unknown) => has(v) && Number(v) !== 0;
  const freqFmt = (v: unknown) => (has(v) ? num(Number(v), 2) : "sem dados");
  const stB = (s: Stage) => sum(byStage(before, s).map((x) => x.spend));
  const compRows: Row[] = [
    { key: "invest", a: totalNow, b: totalBefore, fmt: brl, show: comparable, keep: true },
    ...STAGES.map((s) => ({ key: s, a: stageSpend(s), b: stB(s), fmt: brl, show: comparable, keep: true })),
    { key: "alcance", a: alcA, b: alcB, fmt: int, show: comparable, keep: true },
    { key: "freq", a: frA, b: frB, fmt: freqFmt, show: comparable, keep: true },
    { key: "cpm", a: cpmA, b: cpmB, fmt: brl, show: comparable, keep: true },
    { key: "leads", a: leadsNow, b: leadsBefore, fmt: int, show: comparable && leadsBefore > 0, keep: true },
    { key: "cpl", a: cplNow, b: cplBefore, fmt: brl, show: comparable && cplBefore !== null, keep: true },
    { key: "seguidores", a: segA, b: segB, fmt: signed, show: segB !== null, keep: segA !== null },
    { key: "visitas", a: visA, b: visB, fmt: int, show: comparable && visB > 0, keep: ft !== "visitas" && (visA > 0 || visB > 0) },
    { key: "interacoes", a: engA?.interacoes, b: engB?.interacoes, fmt: int, show: comparable && nz(engB?.interacoes), keep: nz(engA?.interacoes) || nz(engB?.interacoes) },
    { key: "video", a: engA?.video, b: engB?.video, fmt: int, show: comparable && nz(engB?.video), keep: nz(engA?.video) || nz(engB?.video) },
  ];
  if (sales) {
    const vNow = Number(cur.purchases), vBefore = Number(prevT?.purchases ?? 0);
    compRows.push({ key: "vendas", a: vNow, b: vBefore, fmt: int, show: comparable && vBefore > 0, keep: true });
    compRows.push({ key: "cpv", a: div(totalNow, vNow), b: div(totalBefore, vBefore), fmt: brl, show: comparable && vBefore > 0, keep: true });
  }
  const allKeys = ["invest", "base", "meio", "fundo", "alcance", "freq", "cpm", "leads", "cpl", "seguidores", "visitas", "interacoes", "video", "vendas", "cpv"];
  const shown = compRows.filter((r) => r.keep);
  // Espaçamento cresce quando há menos linhas (até 520.000 EMU por linha), sem passar do fim da página.
  const pitch = Math.min(520000, Math.floor(6600000 / Math.max(shown.length, 1)));
  for (const k of allKeys) {
    const r = shown.find((s) => s.key === k);
    if (!r) { for (const col of ["l", "a", "t", "v", "ln"]) del(`p6_${k}_${col}`); for (const f of ["ant", "atual", "var"]) filled[`comp_${k}_${f}`] = ""; continue; }
    const i = shown.indexOf(r);
    put(`comp_${k}_ant`, r.show && has(r.b) ? r.fmt(r.b) : "sem dados"); put(`comp_${k}_atual`, r.fmt(r.a)); put(`comp_${k}_var`, r.show ? variation(r.a, r.b) : "");
    for (const col of ["l", "a", "t", "v"]) { const [sx, sy, px] = G.compCols[col]; move(`p6_${k}_${col}`, sx, sy, px, G.compY0 + G.compTextDY + i * pitch); }
    const [lsx, lsy, lpx] = G.compCols.ln; move(`p6_${k}_ln`, lsx, lsy, lpx, G.compY0 + (i + 1) * pitch);
  }

  // ---------- criativos: até 3 por etapa ----------
  // Cada etapa usa o próprio resultado principal (Meio e Fundo: o resultado do funil quando houver).
  const stageById: Record<string, Stage | null> = Object.fromEntries(now.map((x) => [x.id, x.stage]));
  const adsAll = [...(report.ads ?? [])].filter((ad: Json) => stageById[String(ad.campaign_id)] !== undefined && ad.thumbnail_url && Number(ad.result_count) > 0);
  let creativePages = 0;
  for (const s of STAGES) {
    const P = ID.creativePage[s];
    const pool = adsAll.filter((ad: Json) => stageById[String(ad.campaign_id)] === s);
    const labelCount: Record<string, number> = {};
    for (const ad of pool) labelCount[String(ad.result_label)] = (labelCount[String(ad.result_label)] ?? 0) + Number(ad.result_count);
    const preferred = s !== "base" ? T.labels.filter((l) => labelCount[l]) : [];
    const main = preferred.length ? preferred : Object.keys(labelCount).sort((a, b) => rank(a) - rank(b) || labelCount[b] - labelCount[a]).slice(0, 1);
    const picks = pool
      .filter((ad: Json) => main.includes(String(ad.result_label)))
      .sort((a: Json, b: Json) => Number(b.result_count) - Number(a.result_count) || Number(a.cost ?? 1e9) - Number(b.cost ?? 1e9))
      .filter((ad: Json, i: number, arr: Json[]) => arr.findIndex((o: Json) => String(o.ad_name).trim().toLowerCase() === String(ad.ad_name).trim().toLowerCase()) === i)
      .slice(0, 3);
    if (!picks.length) {
      del(P.page);
      for (let k = 1; k <= 3; k++) for (const f of ["etapa", "titulo", "qtd", "custo"]) filled[`${P.key}${k}_${f}`] = "";
      continue;
    }
    creativePages++;
    ID.creativeCol.forEach((col, i) => {
      const k = i + 1;
      const ad = picks[i];
      if (!ad) { col.els.forEach((e) => del(`${P.pre}_i${e}`)); for (const f of ["etapa", "titulo", "qtd", "custo"]) filled[`${P.key}${k}_${f}`] = ""; return; }
      const lab = String(ad.result_label);
      const u = UNIT[lab] ?? [lab.toLowerCase(), lab.toLowerCase()];
      put(`${P.key}${k}_etapa`, FORMAT[ad.object_type] ?? "Anúncio");
      put(`${P.key}${k}_titulo`, clean(ad.ad_name, 30));
      put(`${P.key}${k}_qtd`, `${int(ad.result_count)} ${Number(ad.result_count) === 1 ? u[1] : u[0]}`);
      put(`${P.key}${k}_custo`, has(ad.cost) ? `${brl(ad.cost)} por ${COST_UNIT[lab] ?? u[1]}` : "");
      images.push({
        ad_id: ad.ad_id,
        requests: [
          { createImage: { objectId: `cr_${s}_${k}_${Date.now().toString(36)}`, url: ad.thumbnail_url, elementProperties: { pageObjectId: P.page, size: { width: { magnitude: G.creativeSize, unit: "EMU" }, height: { magnitude: G.creativeSize, unit: "EMU" } }, transform: { scaleX: 1, scaleY: 1, translateX: col.x, translateY: G.creativeY, unit: "EMU" } } } },
          { updatePageElementsZOrder: { pageElementObjectIds: col.badge.map((e) => `${P.pre}_i${e}`), operation: "BRING_TO_FRONT" } },
        ],
      });
    });
  }
  if (!creativePages) warnings.push("sem criativo com volume suficiente: páginas de criativos removidas");

  // ---------- comercial ----------
  if (!sales) del("p8");
  else {
    const v = Number(cur.purchases), vb = Number(prevT?.purchases ?? 0);
    const fat = Number(cur.purchase_value ?? 0), fatb = Number(prevT?.purchase_value ?? 0);
    const cmp = comparable && vb > 0;
    const cc = (key: string, a: unknown, b: unknown, fmt: (n: unknown) => string) => { put(key, fmt(a)); put(`${key}_ant`, ant(b, fmt, cmp)); put(`${key}_var`, vr(a, b, cmp)); };
    cc("com_vendas", v, vb, int); cc("com_fat", fat, fatb, brl); cc("com_ticket", div(fat, v), div(fatb, vb), brl);
    cc("com_cpv", div(totalNow, v), div(totalBefore, vb), brl);
    cc("com_roas", cur.roas, prevT?.roas, (n) => (has(n) ? num(Number(n), 1) + "×" : "sem dados"));
    const rcom = String(texts.comercial ?? "").trim();
    if (!rcom) warnings.push("leitura comercial não informada");
    put("leitura_comercial", rcom || "Leitura comercial pendente.");
  }

  // ---------- numeração das seções conforme as páginas que ficaram ----------
  let sec = 0;
  for (const p of ID.pages) {
    if (deleted.has(p)) continue;
    sec++;
    const t = String(sec).padStart(2, "0");
    const id = ID.kicker[p];
    requests.push({ insertText: { objectId: id, insertionIndex: 0, text: t } });
    requests.push({ deleteText: { objectId: id, textRange: { type: "FROM_START_INDEX", startIndex: t.length } } });
  }

  // ---------- metadados ----------
  const name = c.display_name ?? "Cliente";
  const labelFile = slug(label.charAt(0).toUpperCase() + label.slice(1));
  const fileBase = `Relatorio_${labelFile}_${slug(name)}_${dmy(period.since).replace(/\//g, "-")}_a_${dmy(period.until).replace(/\//g, "-")}`;
  const subjectBase = `Relatório ${label} | ${name} | ${dmy(period.since)} a ${dmy(period.until)}`;
  const recipients: string[] = c.recipients ?? [];
  if (!recipients.length) warnings.push("cliente sem email cadastrado");
  if (!c.weekly_folder_id) warnings.push("cliente sem pasta de relatórios");
  const to = review ? String(cfg.review_email ?? "ampydigital@gmail.com") : recipients.join(", ");
  const greeting = c.contact_name ? `Olá, ${String(c.contact_name).split(" ")[0]}, tudo bem?` : "Olá, tudo bem?";
  const htmlClient =
    `<p>${greeting}</p>` +
    `<p>Segue em anexo o relatório ${label} de tráfego pago da ${name}, referente ao período de ${dmy(period.since)} a ${dmy(period.until)}.</p>` +
    `<p>Qualquer dúvida sobre os números, é só responder este email.</p>` +
    `<p>${c.manager_name ?? "Equipe"}<br>Ampy Digital</p>`;
  const htmlReview =
    `<p style="padding:8px 10px;background:#fff6e0;border:1px solid #e0c070;font-size:12px">Revisão interna. Destinatário final: ${recipients.join(", ") || "sem email cadastrado"}. Avisos: ${warnings.join("; ") || "nenhum"}.</p>` + htmlClient;

  return {
    meta: {
      report_client_id: c.report_client_id, client_id: c.client_id, ad_account_id: c.meta_account_id, display_name: name,
      period, previous, comparable, review_mode: review, report_label: label, layout: "v5",
      template_id: cfg.weekly_v5_template_id ?? TEMPLATE_V5, drafts_folder_id: cfg.drafts_folder_id ?? null,
      weekly_folder_id: c.weekly_folder_id ?? null,
      slides_name: fileBase, file_name: `${fileBase}.pdf`,
      subject: review ? `[REVISÃO] ${subjectBase}` : subjectBase,
      to, recipients, cc: (c.cc ?? []).join(", "),
      html: review ? htmlReview : htmlClient,
      funnel_type: ft, leads: leadsNow, cpl: cplNow, total_spend: totalNow, sales_page: sales,
      reach_total: alcA ?? null, cpm: cpmA, followers: segA, engagement: engA,
      stages: Object.fromEntries(STAGES.map((s) => [s, { spend: stageSpend(s), share: share(s), campaigns: byStage(now, s).length }])),
      creatives: images.map((a: Json) => a.ad_id), last_synced_at: cur?.synced_at ?? c.last_synced_at ?? null,
    },
    warnings,
    filled,
    requests,
    images,
  };
}

