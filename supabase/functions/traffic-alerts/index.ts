import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// traffic-alerts: usado pelo n8n (Tráfego | Alertas das contas, Fechamento mensal, Agente Meta Ads).
// { "action": "sync", "days": 11, "meta_account_ids": [...]? } atualiza as contas selecionadas pelo meta-sync (4 por vez).
// { "action": "alertas", "ref": "AAAA-MM-DD"? } devolve public.traffic_alertas (padrão: ontem no horário de Brasília).
// { "action": "clientes" } lista os clientes com relatório ligado (id, nome, pasta, conta) e a pasta de rascunhos.
// Autenticação: header x-api-key igual ao segredo "n8n_traffic_secret" do Vault.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { Authorization: `Bearer ${KEY}`, apikey: KEY, "Content-Type": "application/json" };

const json = (body: unknown, status = 200) => Response.json(body, { status });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers as Record<string, string> | undefined) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path.split("?")[0]} ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}
const rpc = (name: string, body: unknown = {}) => rest(`rpc/${name}`, { method: "POST", body: JSON.stringify(body) });

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

type Conta = { meta_account_id: string; name: string | null };

async function sync(days: number, ids: string[] | null) {
  const secret = await rpc("meta_sync_secret");
  let contas: Conta[] = await rest("meta_ad_accounts?select=meta_account_id,name&is_selected=eq.true&order=name");
  if (ids?.length) contas = contas.filter((c) => ids.includes(c.meta_account_id));
  const out: { meta_account_id: string; name: string | null; ok: boolean; error: string | null }[] = new Array(contas.length);
  let next = 0;
  const worker = async () => {
    while (next < contas.length) {
      const i = next++;
      const c = contas[i];
      try {
        const { res, data } = await callFn("meta-sync", secret, { mode: "sync", meta_account_id: c.meta_account_id, days });
        const r = data?.results?.[0];
        out[i] = { meta_account_id: c.meta_account_id, name: c.name, ok: !!r?.ok, error: r?.ok ? null : (r?.error ?? data?.error ?? `HTTP ${res.status}`) };
      } catch (e) {
        out[i] = { meta_account_id: c.meta_account_id, name: c.name, ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, contas.length) }, worker));
  return out;
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
  try {
    if (body.action === "sync") {
      const days = Math.min(Math.max(Number(body.days) || 11, 2), 30);
      const ids = Array.isArray(body.meta_account_ids) ? body.meta_account_ids.map(String) : null;
      const results = await sync(days, ids);
      const falhas = results.filter((r) => !r.ok);
      return json({ ok: falhas.length === 0, contas: results.length, falhas });
    }
    if (body.action === "clientes") {
      const clientes = await rest("traffic_report_clients?select=id,display_name,report_enabled,drive_weekly_folder_id,ad_account_id,meta_ad_accounts(meta_account_id,name)&report_enabled=eq.true&order=display_name");
      const settings: { key: string; value: unknown }[] = await rest("traffic_report_settings?select=key,value");
      const cfg = Object.fromEntries(settings.map((s) => [s.key, s.value]));
      return json({
        ok: true,
        drafts_folder_id: cfg.drafts_folder_id ?? null,
        review_email: cfg.review_email ?? "ampydigital@gmail.com",
        clientes: clientes.map((c: any) => ({
          report_client_id: c.id, display_name: c.display_name, folder_id: c.drive_weekly_folder_id,
          meta_account_id: c.meta_ad_accounts?.meta_account_id ?? null, conta: c.meta_ad_accounts?.name ?? null,
        })),
      });
    }
    if (body.action === "alertas") {
      const ref = typeof body.ref === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.ref) ? body.ref : null;
      const data = await rpc("traffic_alertas", { p_ref: ref });
      return json({ ok: true, ...data });
    }
    return json({ ok: false, error: "action deve ser sync, alertas ou clientes" }, 400);
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

