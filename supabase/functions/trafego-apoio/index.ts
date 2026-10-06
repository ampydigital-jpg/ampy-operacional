import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// trafego-apoio: consultas rápidas para o gestor de tráfego no WhatsApp.
// Autenticação: header x-api-key igual ao segredo "n8n_traffic_secret" do Vault.
//   e_equipe   { telefone }        o número está em trafego_config.equipe_whatsapp? (aceita com ou sem o 9)
//   estrutura  { conta?, busca? }  sem conta: lista as contas. Com conta (nome ou act_): campanhas, conjuntos e anúncios
//                                  ativos com IDs e orçamento; com busca: filtra pelo nome em qualquer status.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { Authorization: `Bearer ${KEY}`, apikey: KEY, "Content-Type": "application/json" };
const json = (body: unknown, status = 200) => Response.json(body, { status });
type J = Record<string, any>;

async function sb(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers as Record<string, string> | undefined) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path.split("?")[0]} ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}
const rpc = (name: string) => sb(`rpc/${name}`, { method: "POST", body: "{}" });
const nomeConta = (s: string | null) => String(s || "").replace(/^\s*CA\s*-?\s*/i, "").trim();
const norm = (s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function chaveFone(t: unknown) {
  let d = String(t || "").replace(/\D/g, "");
  if (d.startsWith("55")) d = d.slice(2);
  return d.length >= 10 ? d.slice(0, 2) + d.slice(-8) : d;
}

async function eEquipe(body: J) {
  const [row] = await sb("trafego_config?select=value&key=eq.equipe_whatsapp");
  const k = chaveFone(body.telefone);
  return { ok: true, equipe: !!k && ((row?.value ?? []) as string[]).some((n) => chaveFone(n) === k) };
}

async function estrutura(body: J) {
  const contas: J[] = await sb("meta_ad_accounts?select=id,meta_account_id,name&is_selected=eq.true&order=name");
  const lista = contas.map((c) => ({ meta_account_id: c.meta_account_id, nome: nomeConta(c.name) }));
  if (!body.conta) return { ok: true, contas: lista };
  const q = norm(String(body.conta));
  const c = contas.find((x) => x.meta_account_id === body.conta) || contas.find((x) => norm(nomeConta(x.name)).includes(q));
  if (!c) return { ok: false, error: "conta não encontrada", contas: lista };
  const f = body.busca ? `&name=ilike.*${encodeURIComponent(String(body.busca))}*` : "&effective_status=eq.ACTIVE";
  const campanhas = await sb(`meta_campaigns?select=meta_campaign_id,name,effective_status,daily_budget,lifetime_budget&ad_account_id=eq.${c.id}${f}&limit=50`);
  const conjuntos = await sb(`meta_adsets?select=meta_adset_id,meta_campaign_id,name,effective_status,daily_budget&ad_account_id=eq.${c.id}${f}&limit=80`);
  const anuncios = await sb(`meta_ads?select=meta_ad_id,meta_adset_id,meta_campaign_id,name,effective_status&ad_account_id=eq.${c.id}${f}&limit=120`);
  return { ok: true, conta: { meta_account_id: c.meta_account_id, nome: nomeConta(c.name) }, campanhas, conjuntos, anuncios };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  let expected: string | null = null;
  try { expected = await rpc("n8n_traffic_secret"); } catch { return json({ ok: false, error: "segredo indisponível" }, 500); }
  if (!expected || req.headers.get("x-api-key") !== expected) return json({ ok: false, error: "unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === "e_equipe") return json(await eEquipe(body));
    if (body.action === "estrutura") return json(await estrutura(body));
    return json({ ok: false, error: "action: e_equipe ou estrutura" }, 400);
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

