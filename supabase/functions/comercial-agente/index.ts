import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// comercial-agente: backend do Alfredo, agente agendador da Ampy (n8n).
// Ações: salvar_lead, horarios, agendar, registrar_evento, transferir,
//        receber, lote, resposta, eco (WhatsApp via Evolution API).
// Autenticação: header x-api-key igual ao segredo "n8n_traffic_secret" do Vault.
// v11: pergunta obrigatória de quando quer começar (sem prazo vira morno) e assunto_equipe pronto no agendar.
// v10: site e formulário do site (Tally). Situação morno (tem perfil, mas sem previsão e sem investimento definido)
//      recebe o formulário e o site em vez da R1. O prompt ganha [[SITE]] e [[FORMULARIO]] (link com o session_id).
//      Ação formulario: recebe a resposta do Tally (via n8n), junta no lead certo e diz se a equipe deve ser avisada.
// v9: filtro de R1. salvar_lead devolve a decisão (pode_agendar, falta_info, fora_do_perfil) calculada no banco
//     (comercial_avaliar); lote devolve o prompt do Alfredo (comercial_config.prompt_alfredo) e a situação do lead.
//     Campos novos estagio (operando, abrindo, pessoa_fisica) e pedido_tipo (recorrente, avulso).
// v8: WhatsApp. receber grava a mensagem do lead e o telefone/origem (anúncio), lote junta mensagens picadas
//     e devolve o histórico, resposta grava o que o Alfredo mandou, eco detecta quando alguém da equipe
//     responde pelo celular e passa o lead para atendimento humano (o Alfredo para de responder).
// v7: primeiro entender o motivo do contato; frases ao lead sem dois-pontos.
// v6: perguntas mais naturais, nem todas obrigatórias (investimento opcional, urgência inferida, decisor depois de marcar).
// v5: pontuação do lead (0 a 100) e temperatura calculadas no banco (comercial_pontuar),
//     com as mesmas perguntas do formulário da landing page. Ninguém é barrado: todo lead agenda.
//     A pontuação vai só para a equipe (resumo_equipe); o evento do Google Agenda recebe descricao_evento, sem nota.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { Authorization: `Bearer ${KEY}`, apikey: KEY, "Content-Type": "application/json" };
const json = (body: unknown, status = 200) => Response.json(body, { status });

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers as Record<string, string> | undefined) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path.split("?")[0]} ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}
const rpc = (name: string, body: unknown = {}) => rest(`rpc/${name}`, { method: "POST", body: JSON.stringify(body) });

const FAT: Record<string, string> = { ate_20k: "até R$ 20 mil", "20k_50k": "R$ 20 a 50 mil", "50k_100k": "R$ 50 a 100 mil", acima_100k: "acima de R$ 100 mil" };
const URG: Record<string, string> = { imediato: "agora", "30_dias": "nos próximos 30 dias", "90_dias": "em 2 a 3 meses", sem_prazo: "ainda entendendo as possibilidades" };
const DEC: Record<string, string> = { sim: "é o decisor", nao: "não é o decisor", participa: "decisor participa da reunião" };
const MKT: Record<string, string> = { nunca: "nunca trabalhou com marketing", ja_trabalhou: "já trabalhou antes, hoje não", sozinho: "o próprio dono faz", pontual: "faz de forma pontual, sem constância", equipe_interna: "equipe interna", agencia_freela: "agência ou freelancer" };
const TRAF: Record<string, string> = { nunca: "nunca investiu", nao_sabe: "não sabe", ja_investiu: "já investiu antes", atualmente: "investe atualmente" };
const INV: Record<string, string> = { nao_definido: "ainda não definido", ate_1k: "até R$ 1.000", "1k_3k": "R$ 1.000 a R$ 3.000", "3k_5k": "R$ 3.000 a R$ 5.000", acima_5k: "acima de R$ 5.000" };

const EST: Record<string, string> = { operando: "empresa funcionando", abrindo: "empresa ainda vai abrir", pessoa_fisica: "não tem empresa (perfil pessoal)" };
const PED: Record<string, string> = { recorrente: "acompanhamento mensal", avulso: "serviço avulso" };

const CAMPOS = ["nome", "empresa", "segmento", "cidade", "colaboradores", "faturamento_faixa", "investe_marketing", "marketing_hoje", "trafego_pago", "investimento_faixa", "dor", "decisor", "urgencia", "email", "telefone", "estagio", "pedido_tipo"];
const ENUMS: Record<string, string[]> = {
  faturamento_faixa: Object.keys(FAT),
  decisor: Object.keys(DEC),
  urgencia: Object.keys(URG),
  marketing_hoje: Object.keys(MKT),
  trafego_pago: Object.keys(TRAF),
  investimento_faixa: Object.keys(INV),
  estagio: Object.keys(EST),
  pedido_tipo: Object.keys(PED),
};

// Perguntas antes de oferecer horário, na ordem, com o jeito natural de perguntar (sem dois-pontos nas frases ao lead).
// Nem todas precisam de resposta: se o lead desviar, o agente segue.
const PERGUNTAS: [string, string][] = [
  ["nome", "o nome do lead (\"Com quem eu falo?\")"],
  ["dor", "o motivo do contato, antes de tudo (\"Me conta, o que te fez chamar a gente hoje?\")"],
  ["empresa", "a empresa, depois de explicar que vai fazer umas perguntinhas pro comercial já chegar sabendo do caso (\"Qual o nome da empresa e o que vocês fazem?\")"],
  ["estagio", "se a empresa já está funcionando (\"E a empresa já tá funcionando ou ainda tá pra abrir?\")"],
  ["marketing_hoje", "como o marketing acontece hoje, junto com anúncio (\"E hoje quem cuida do marketing aí, vocês mesmos, alguém do time ou uma agência? Chegam a rodar anúncio?\")"],
  ["colaboradores", "o tamanho do time, só se a conversa estiver fluindo (\"E vocês são em quantas pessoas aí, mais ou menos?\")"],
  ["investimento_faixa", "o investimento, sem pressão (\"Pra ele já chegar com uma ideia no tamanho certo, vocês já pensaram em quanto querem investir por mês em marketing, ou ainda tão vendo isso?\") Só cite as faixas se o lead pedir referência. Se ele responder que não sabe ou desviar, salve nao_definido"],
  ["urgencia", "quando pensam em começar, sempre antes de oferecer horário (\"E vocês pensam em começar quando, já agora ou mais pra frente?\"). Salve imediato, 30_dias, 90_dias ou sem_prazo (mais de 3 meses ou sem previsão)"],
  ["decisor", "quem decide (\"E a decisão de contratar marketing é contigo mesmo ou tem mais alguém junto, tipo sócio?\"). Se não for quem decide, pergunte se consegue trazer quem decide pra conversa antes de salvar"],
];

function situacaoTexto(l: any) {
  const a = l.avaliacao ?? {};
  const falta: string[] = Array.isArray(a.falta) ? a.falta : [];
  if (l.status === "agendado") return "lead já tem reunião marcada";
  if (l.status === "humano") return "lead está com atendimento humano, seja breve";
  if (a.decisao === "fora_do_perfil") return `fora_do_perfil (${a.motivo}). Não ofereça reunião, faça o ENCERRAMENTO`;
  if (a.decisao === "morno") {
    return l.formulario_enviado_em
      ? `morno (${a.motivo}). Formulário e site já enviados. Não ofereça reunião, responda curto e deixe a porta aberta`
      : `morno (${a.motivo}). Não ofereça reunião, mande o formulário e o site`;
  }
  if (a.decisao === "pode_agendar") return "pode_agendar. Consulte os horários e ofereça 2 opções";
  return `falta_info. Antes de oferecer horário, falta saber ${falta.join(", ") || "o básico da empresa"}`;
}

function contextoLead(l: any) {
  if (!l) return "SITUAÇÃO DO LEAD\nprimeiro contato, ainda não sabemos nada.";
  const v = (x: unknown, alt = "?") => (x === null || x === undefined || x === "" ? alt : String(x));
  return [
    "SITUAÇÃO DO LEAD",
    `Situação, ${situacaoTexto(l)}`,
    `Nome, ${v(l.nome)}`,
    `Empresa, ${v(l.empresa)} (${v(l.segmento, "segmento ?")}), ${v(l.cidade, "cidade ?")}`,
    `Funcionando, ${EST[l.estagio] ?? "?"}`,
    `O que procura, ${v(l.dor)}${l.pedido_tipo ? ` (${PED[l.pedido_tipo]})` : ""}`,
    `Marketing hoje, ${MKT[l.marketing_hoje] ?? "?"}${l.investe_marketing ? ` (${l.investe_marketing})` : ""}`,
    `Anúncio, ${TRAF[l.trafego_pago] ?? "?"}`,
    `Pessoas, ${l.colaboradores ?? "?"}`,
    `Investimento, ${INV[l.investimento_faixa] ?? "?"}`,
    `Quem decide, ${DEC[l.decisor] ?? "?"}`,
    `Quando quer começar, ${URG[l.urgencia] ?? "?"}`,
    `Email, ${v(l.email)}`,
    `Formulário do site, ${formTxt(l)}`,
    `Veio de, ${l.origem === "anuncio" ? "anúncio" : v(l.origem)}`,
  ].join("\n");
}

function dataCurta(iso: unknown) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(new Date(String(iso)));
}

function formTxt(l: any) {
  if (l.formulario_respondido_em) return `respondido em ${dataCurta(l.formulario_respondido_em)}`;
  if (l.formulario_enviado_em) return `enviado em ${dataCurta(l.formulario_enviado_em)}, ainda não respondido`;
  return "não enviado";
}

// Formulário do site (Tally). Lê as respostas pelo texto da pergunta, então mudar a ordem no Tally não quebra nada.
const norm = (x: unknown) => String(x ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

type Resposta = { label: string; texto: string; tipo: string };

function tallyRespostas(fields: unknown): Resposta[] {
  const out: Resposta[] = [];
  for (const f of Array.isArray(fields) ? fields : []) {
    if (!f || f.value === null || f.value === undefined || typeof f.value === "boolean") continue;
    let texto = "";
    if (Array.isArray(f.value)) {
      const ops = Array.isArray(f.options) ? f.options : [];
      texto = f.value.map((id: unknown) => ops.find((o: any) => o && o.id === id)?.text ?? (typeof id === "string" ? id : "")).filter(Boolean).join("; ");
    } else if (typeof f.value !== "object") {
      texto = String(f.value);
    }
    texto = texto.trim();
    if (texto) out.push({ label: String(f.label ?? "").trim(), texto, tipo: String(f.type ?? "") });
  }
  return out;
}

function tallyDados(resp: Resposta[]) {
  const achar = (re: RegExp) => resp.find((r) => r.tipo !== "HIDDEN_FIELDS" && re.test(norm(r.label)))?.texto ?? "";
  const oculto = (nome: string) => resp.find((r) => r.tipo === "HIDDEN_FIELDS" && norm(r.label) === nome)?.texto ?? "";
  const tel = resp.find((r) => r.tipo === "INPUT_PHONE_NUMBER")?.texto || achar(/whatsapp|telefone|celular/);

  const pessoas = norm(achar(/quantas pessoas/));
  const colaboradores = /menos de/.test(pessoas) ? "4" : /6 a 10/.test(pessoas) ? "8" : /11 a 20/.test(pessoas) ? "15" : /acima de 20/.test(pessoas) ? "21" : "";

  const mkt = norm(achar(/como o marketing/));
  const marketing_hoje = /agencia/.test(mkt) ? "agencia_freela" : /equipe interna/.test(mkt) ? "equipe_interna" : /pontual/.test(mkt) ? "pontual"
    : /ja trabalhei/.test(mkt) ? "ja_trabalhou" : /nunca/.test(mkt) ? "nunca" : "";

  const traf = norm(achar(/trafego pago/));
  const trafego_pago = /atualmente/.test(traf) ? "atualmente" : /ja investi/.test(traf) ? "ja_investiu" : /nunca/.test(traf) ? "nunca" : /nao sei/.test(traf) ? "nao_sabe" : "";

  const inv = norm(achar(/investimento/));
  const investimento_faixa = /acima de/.test(inv) ? "acima_5k" : /3\.000 a/.test(inv) ? "3k_5k" : /1\.000 a/.test(inv) ? "1k_3k" : /ate r/.test(inv) ? "ate_1k"
    : /definido/.test(inv) ? "nao_definido" : "";

  const urg = norm(achar(/quando voce pretende|iniciar/));
  const urgencia = /30 dias|agora/.test(urg) ? "30_dias" : /2 a 3 meses/.test(urg) ? "90_dias" : /mais para frente|entendendo/.test(urg) ? "sem_prazo" : "";

  const melhorar = achar(/precisa melhorar/).replace(/preciso /gi, "");
  const desafio = achar(/principal desafio/);
  const dor = [desafio, melhorar ? `Marcou no formulário, ${melhorar}` : ""].filter(Boolean).join(". ").slice(0, 1000);

  const hint = oculto("pagina_origem").replace(/[^\w]+$/, "");
  return {
    dados: {
      nome: achar(/seu nome/),
      empresa: achar(/nome da sua empresa/),
      segmento: achar(/segmento/),
      telefone: tel.replace(/\D/g, ""),
      colaboradores,
      marketing_hoje,
      trafego_pago,
      investimento_faixa,
      urgencia,
      dor,
      campanha: oculto("utm_campaign"),
    },
    hint: /^(wa|teste|form)_/.test(hint) ? hint : "",
  };
}

function agoraTexto() {
  const f = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  return f.format(new Date()).replace(/\b(\d{1,2}):(\d{2})\b/, "$1h$2");
}

function clean(o: Record<string, unknown>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o ?? {})) {
    if (v === null || v === undefined) continue;
    let s = String(v).trim();
    if (!s || ["null", "undefined", "-", "n/a"].includes(s.toLowerCase())) continue;
    if (ENUMS[k] && !ENUMS[k].includes(s)) continue;
    if (k === "colaboradores") {
      const n = s.match(/\d+/);
      if (!n) continue;
      s = String(parseInt(n[0], 10));
    }
    out[k] = s;
  }
  return out;
}

function ocupados(v: unknown) {
  let arr: unknown = v;
  if (typeof arr === "string") { try { arr = JSON.parse(arr); } catch { arr = []; } }
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((o: any) => o && o.inicio && o.fim && !Number.isNaN(Date.parse(o.inicio)) && !Number.isNaN(Date.parse(o.fim)))
    .map((o: any) => ({ inicio: new Date(o.inicio).toISOString(), fim: new Date(o.fim).toISOString() }));
}

function colabTxt(n: unknown) {
  if (n === null || n === undefined) return "não informado";
  const v = Number(n);
  if (v === 0) return "nenhum (só o dono)";
  return v === 1 ? "1 colaborador" : `${v} colaboradores`;
}

const NOME_ITEM: Record<string, string> = {
  porte: "porte", marketing_hoje: "como faz marketing", trafego_pago: "tráfego pago",
  investimento_faixa: "investimento mensal", urgencia: "quando quer começar", decisor: "decisor",
};

function linhasLead(l: any) {
  const linhas = [
    `Empresa: ${l.empresa ?? "não informado"} (${l.segmento ?? "segmento não informado"}), ${l.cidade ?? "cidade não informada"}`,
    `Contato: ${l.nome ?? "sem nome"}, ${l.telefone ?? "sem telefone"}, ${l.email ?? "sem email"}`,
    `Pessoas na empresa: ${colabTxt(l.colaboradores)}`,
    `Precisa melhorar: ${l.dor ?? "não informado"}`,
    `Marketing hoje: ${MKT[l.marketing_hoje] ?? "não informado"}${l.investe_marketing ? ` (${l.investe_marketing})` : ""}`,
    `Tráfego pago: ${TRAF[l.trafego_pago] ?? "não informado"}`,
    `Investimento mensal que imagina: ${INV[l.investimento_faixa] ?? "não informado"}`,
    `Quer começar: ${URG[l.urgencia] ?? "não informado"}`,
    `Decisor: ${DEC[l.decisor] ?? "não informado"}`,
    `Empresa funcionando: ${EST[l.estagio] ?? "não informado"}`,
    `Procura: ${PED[l.pedido_tipo] ?? "não informado"}`,
  ];
  if (l.faturamento_faixa) linhas.push(`Faturamento (informado pelo lead): ${FAT[l.faturamento_faixa]}`);
  linhas.push(`Origem: ${l.origem ?? "não informada"}${l.campanha ? `, anúncio "${l.campanha}"` : ""}${l.ad_id ? ` (ad_id ${l.ad_id})` : ""}`);
  return linhas;
}

// "terça, 06/10 às 9h" no fuso de Brasília.
function rotuloHorario(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const p = Object.fromEntries(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d).map((x) => [x.type, x.value]));
  const dia = String(p.weekday ?? "").replace("-feira", "");
  return `${dia}, ${p.day}/${p.month} às ${Number(p.hour)}h${p.minute && p.minute !== "00" ? p.minute : ""}`;
}

function linhaScore(l: any) {
  const d = l.score_detalhe ?? {};
  const falt: string[] = Array.isArray(d.faltando) ? d.faltando.map((k: string) => NOME_ITEM[k] ?? k) : [];
  const temp = String(l.temperatura ?? "sem dados").toUpperCase();
  return `Pontuação: ${l.score ?? 0}/100, ${temp}${falt.length ? ` (sem resposta: ${falt.join(", ")})` : ""}`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  let expected: string | null = null;
  try { expected = await rpc("n8n_traffic_secret"); } catch { return json({ ok: false, error: "segredo indisponível" }, 500); }
  if (!expected || req.headers.get("x-api-key") !== expected) return json({ ok: false, error: "unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");
  const session = String(body.session_id ?? "").trim();

  try {
    if (action === "horarios") {
      const busy = ocupados(body.ocupados);
      const slots = await rpc("comercial_horarios_livres", { p_limite: Number(body.limite ?? 6), p_ocupados: busy });
      return json({
        ok: true,
        horarios: slots,
        google_agenda_consultada: body.google_ok === true,
        instrucao: "Ofereça 2 opções de dias diferentes usando o rótulo. Para agendar, envie o campo inicio exatamente como veio.",
      });
    }

    if (action === "registrar_evento") {
      if (!body.reuniao_id) return json({ ok: false, error: "reuniao_id obrigatório" }, 400);
      await rest(`comercial_reunioes?id=eq.${encodeURIComponent(String(body.reuniao_id))}`, {
        method: "PATCH",
        body: JSON.stringify({ google_event_id: body.google_event_id || null, meet_link: body.meet_link || null }),
      });
      return json({ ok: true });
    }

    // Formulário do site (Tally, repassado pelo n8n). Junta no lead certo e diz se a equipe deve ser avisada.
    if (action === "formulario") {
      const t = body.tally ?? {};
      const d = t.data ?? {};
      const cfgForm = await rest(`comercial_config?key=eq.formulario_id&select=value`);
      const formId = Array.isArray(cfgForm) && cfgForm[0] ? String(cfgForm[0].value) : "";
      if (t.eventType !== "FORM_RESPONSE" || (formId && d.formId !== formId)) {
        return json({ ok: false, avisar: false, error: "formulário não reconhecido" }, 400);
      }
      const resp = tallyRespostas(d.fields);
      const { dados, hint } = tallyDados(resp);
      const r = await rpc("comercial_formulario", {
        p_response_id: String(d.responseId ?? d.submissionId ?? t.eventId ?? ""),
        p_dados: clean(dados),
        p_session_hint: hint || null,
        p_payload: t,
      });
      if (!r || !r.ok || r.duplicado) return json({ ...(r ?? {}), avisar: false });
      const l = r.lead ?? {};
      const av = l.avaliacao ?? {};
      const falta: string[] = Array.isArray(av.falta) ? av.falta : [];
      const soConfirmar = falta.length > 0 && falta.every((f) => ["se a empresa já está funcionando", "quem decide"].includes(f));
      let tipo = "";
      if (!["agendado", "humano"].includes(l.status)) {
        if (av.decisao === "pode_agendar") tipo = "PRONTO PARA R1";
        else if (av.decisao === "falta_info" && soConfirmar) tipo = "POTENCIAL R1";
      }
      const acao = tipo === "PRONTO PARA R1"
        ? "Chamar no WhatsApp e marcar a R1."
        : `Chamar no WhatsApp, confirmar ${falta.join(" e ")} e marcar a R1.`;
      const corpo = [
        `O lead preencheu o formulário do site. ${acao}`,
        r.lead_novo ? "Ainda não conversou com o Alfredo." : "Já tinha conversado com o Alfredo pelo WhatsApp.",
        "",
        linhaScore(l),
        ...linhasLead(l),
        "",
        "Respostas do formulário",
        ...resp.filter((x) => x.tipo !== "CALCULATED_FIELDS").map((x) => `${x.label} ${x.texto}`),
      ].join("\n");
      return json({
        ok: true,
        avisar: tipo !== "",
        situacao: av.decisao ?? null,
        lead_novo: r.lead_novo === true,
        session_id: l.session_id,
        telefone: String(l.telefone ?? "").replace(/\D/g, ""),
        assunto: `Formulário do site | ${tipo || av.decisao || "lead"} | ${String(l.temperatura ?? "").toUpperCase()} ${l.score ?? 0} | ${l.empresa ?? l.nome ?? "Lead"}`,
        corpo,
      });
    }

    if (!session) return json({ ok: false, error: "session_id obrigatório" }, 400);

    // WhatsApp: mensagem do lead chegou. Garante o lead (telefone, canal, origem do anúncio) e grava a mensagem.
    if (action === "receber") {
      const dados = clean({
        telefone: body.telefone,
        canal: "whatsapp",
        origem: body.origem,
        ad_id: body.ad_id,
        ctwa_clid: body.ctwa_clid,
        campanha: body.campanha,
      });
      await rpc("comercial_salvar_lead", { p_session: session, p_dados: dados });
      const r = await rpc("comercial_registrar_mensagem", {
        p_session: session, p_direcao: "lead", p_texto: String(body.texto ?? ""), p_wa_id: body.wa_id ? String(body.wa_id) : null,
      });
      return json(r);
    }

    // WhatsApp: depois da espera, junta as mensagens picadas e devolve o histórico. Só a última mensagem processa.
    if (action === "lote") {
      const r = await rpc("comercial_lote", { p_session: session, p_ultimo: Number(body.mensagem_id ?? 0) });
      if (!r || !r.processar) return json(r);
      const [leads, cfg] = await Promise.all([
        rest(`comercial_leads?session_id=eq.${encodeURIComponent(session)}&select=*`),
        rest(`comercial_config?key=in.(prompt_alfredo,instagram,site,formulario_url)&select=key,value`),
      ]);
      const conf: Record<string, unknown> = Object.fromEntries((cfg ?? []).map((c: any) => [c.key, c.value]));
      const formulario = `${String(conf.formulario_url ?? "https://tally.so/r/pb1kAJ")}?origem=whatsapp_alfredo&pagina_origem=${encodeURIComponent(session)}`;
      const prompt = String(conf.prompt_alfredo ?? "")
        .replaceAll("[[AGORA]]", agoraTexto())
        .replaceAll("[[INSTAGRAM]]", String(conf.instagram ?? "@ampy.digital"))
        .replaceAll("[[SITE]]", String(conf.site ?? "https://ampydigital.com.br"))
        .replaceAll("[[FORMULARIO]]", formulario);
      return json({ ...r, prompt, contexto: contextoLead(Array.isArray(leads) ? leads[0] : null) });
    }

    // WhatsApp: grava a resposta que o Alfredo enviou (wa_id serve para reconhecer o eco).
    if (action === "resposta") {
      const r = await rpc("comercial_registrar_mensagem", {
        p_session: session, p_direcao: "alfredo", p_texto: String(body.texto ?? ""), p_wa_id: body.wa_id ? String(body.wa_id) : null,
      });
      if (String(body.texto ?? "").includes("tally.so/")) {
        await rest(`comercial_leads?session_id=eq.${encodeURIComponent(session)}&formulario_enviado_em=is.null`, {
          method: "PATCH",
          body: JSON.stringify({ formulario_enviado_em: new Date().toISOString() }),
        });
      }
      return json(r);
    }

    // WhatsApp: mensagem enviada pelo número da Ampy. Se não foi o Alfredo, a equipe assumiu.
    if (action === "eco") {
      const r = await rpc("comercial_eco", {
        p_session: session, p_texto: String(body.texto ?? ""), p_wa_id: body.wa_id ? String(body.wa_id) : null,
      });
      return json(r);
    }

    if (action === "salvar_lead") {
      const dados = clean(body.dados ?? {});
      const novos = Object.keys(dados).filter((k) => CAMPOS.includes(k));
      const lead = await rpc("comercial_salvar_lead", { p_session: session, p_dados: dados });
      const pendentes = PERGUNTAS.filter(([k]) => lead[k] === null || lead[k] === undefined);
      const av = lead.avaliacao ?? {};
      let proximo: string;
      if (av.decisao === "fora_do_perfil" && !["agendado", "humano"].includes(lead.status)) {
        proximo = av.acabou_de_ficar_fora
          ? `lead fora do perfil (${av.motivo}). Não ofereça reunião nem horário. Faça o ENCERRAMENTO com educação e chame avisar_equipe uma vez, com assunto "Lead fora do perfil | ${lead.empresa ?? lead.nome ?? "lead"}" e o motivo no corpo`
          : `lead fora do perfil (${av.motivo}) e a equipe já foi avisada. Responda curto e educado, sem oferecer reunião`;
      } else if (lead.status === "agendado") {
        if (!lead.decisor) proximo = "reunião já marcada: pergunte de leve se mais alguém decide junto (\"Vai participar mais alguém que decide isso com você, tipo sócio?\"). Se não quiser responder, encerre bem";
        else if (!lead.urgencia) proximo = "reunião já marcada: se a conversa estiver fluindo, pergunte de leve quando pensam em começar; se não, encerre bem";
        else proximo = "lead já tem reunião marcada; se quiser mudar, consultar horários e reagendar";
      } else if (lead.status === "humano") {
        proximo = "lead está com atendimento humano; responder de forma breve e dizer que o responsável comercial continua por aqui";
      } else if (av.decisao === "morno") {
        proximo = lead.formulario_enviado_em
          ? `morno (${av.motivo}): formulário e site já enviados. Não ofereça reunião, responda curto e deixe a porta aberta`
          : `morno (${av.motivo}): não ofereça reunião nem horário. Mande o formulário e o site, como em SITE E FORMULÁRIO`;
      } else if (av.decisao === "pode_agendar") {
        proximo = "pode_agendar: consultar horários e oferecer 2 opções";
      } else {
        const obrig: string[] = Array.isArray(av.falta) ? av.falta : [];
        proximo = `falta_info: antes de oferecer horário falta saber ${obrig.join(", ") || "o básico"}. Ordem das perguntas que faltam: ${pendentes.map(([, t], i) => `(${i + 1}) ${t}`).join("; ")}. Pergunte só a primeira que o lead ainda não respondeu nem desviou. Tamanho do time é opcional. Se ele pedir reunião, faça só as perguntas obrigatórias que faltam, rapidinho`;
      }
      return json({
        ok: true,
        salvos: novos,
        aviso: novos.length ? undefined : "nenhum campo foi salvo: chame de novo preenchendo o campo que o lead informou",
        status: lead.status,
        situacao: av.decisao ?? null,
        motivo_fora: av.motivo ?? null,
        acabou_de_ficar_fora: av.acabou_de_ficar_fora === true,
        faltando: pendentes.map(([k]) => k),
        proximo,
        uso_interno: "pontuação, temperatura e situação são internas: nunca mencione ao lead",
      });
    }

    if (action === "agendar") {
      if (!body.inicio) return json({ ok: false, error: "inicio obrigatório" }, 400);
      const r = await rpc("comercial_agendar", { p_session: session, p_inicio: body.inicio, p_formato: body.formato || "online", p_email: body.email || null });
      if (!r.ok) return json(r);
      const l = r.lead ?? {};
      const base = linhasLead(l);
      const titulo = `R1 | ${l.empresa ?? l.nome ?? "Lead"} | Ampy Digital`;
      return json({
        ...r,
        assunto_equipe: `Nova R1 | ${String(l.temperatura ?? "sem nota").toUpperCase()} ${l.score ?? 0} | ${l.empresa ?? l.nome ?? "Lead"} | ${rotuloHorario(String(body.inicio))}`,
        resumo_equipe: [linhaScore(l), ...base].join("\n"),
        descricao_evento: [`Reunião de diagnóstico com a Ampy Digital (45 min, Google Meet).`, "", ...base].join("\n"),
        titulo_evento: titulo,
        temperatura: l.temperatura ?? null,
        score: l.score ?? null,
      });
    }

    if (action === "transferir") {
      await rpc("comercial_salvar_lead", { p_session: session, p_dados: {} });
      await rest(`comercial_leads?session_id=eq.${encodeURIComponent(session)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "humano", resumo: String(body.motivo ?? "pediu atendimento humano").slice(0, 1000) }),
      });
      return json({ ok: true });
    }

    return json({ ok: false, error: "ação inválida: use salvar_lead, horarios, agendar, registrar_evento, transferir, receber, lote, resposta, eco ou formulario" }, 400);
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

