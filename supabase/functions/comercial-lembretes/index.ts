import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// comercial-lembretes: lembretes de reunião do Alfredo (24h e 2h antes), chamados pelo n8n a cada 15 minutos.
// Ações: pendentes (lista o que enviar agora, com o texto pronto) e marcar (registra que o lembrete foi enviado).
// Autenticação: header x-api-key igual ao segredo "n8n_traffic_secret" do Vault (mesma credencial do n8n).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { Authorization: `Bearer ${KEY}`, apikey: KEY, "Content-Type": "application/json" };
const json = (body: unknown, status = 200) => Response.json(body, { status });

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
  const action = String(body.action ?? "");
  try {
    if (action === "pendentes") {
      const lista = await rpc("comercial_lembretes_pendentes");
      return json({ ok: true, total: Array.isArray(lista) ? lista.length : 0, lembretes: lista ?? [] });
    }
    if (action === "marcar") {
      if (!body.reuniao_id || !["24h", "2h"].includes(String(body.tipo))) return json({ ok: false, error: "reuniao_id e tipo (24h ou 2h) obrigatórios" }, 400);
      return json(await rpc("comercial_lembrete_marcar", { p_reuniao: String(body.reuniao_id), p_tipo: String(body.tipo) }));
    }
    return json({ ok: false, error: "ação inválida: use pendentes ou marcar" }, 400);
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

