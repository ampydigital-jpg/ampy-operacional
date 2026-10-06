import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// comercial-resumo: resumo semanal dos leads do Alfredo, chamado pelo n8n toda segunda.
// Corpo opcional: { since: "AAAA-MM-DD", until: "AAAA-MM-DD" }. Sem datas, usa a semana anterior (segunda a domingo).
// Autenticação: header x-api-key igual ao segredo "n8n_traffic_secret" do Vault (mesma credencial do n8n).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { Authorization: `Bearer ${KEY}`, apikey: KEY, "Content-Type": "application/json" };
const json = (body: unknown, status = 200) => Response.json(body, { status });
const isDate = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

async function rpc(name: string, body: unknown = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, { method: "POST", headers: H, body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${name} ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  let expected: string | null = null;
  try { expected = await rpc("n8n_traffic_secret"); } catch { return json({ ok: false, error: "segredo indisponível" }, 500); }
  if (!expected || req.headers.get("x-api-key") !== expected) return json({ ok: false, error: "unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  try {
    const resumo = await rpc("comercial_resumo_semana", {
      p_since: isDate(body.since) ? body.since : null,
      p_until: isDate(body.until) ? body.until : null,
    });
    return json({ ok: true, ...resumo });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

