import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type MetaPage<T> = { data?: T[]; paging?: { next?: string }; error?: { message?: string; type?: string; code?: number } };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const META_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN");
const META_API_VERSION = Deno.env.get("META_API_VERSION") || "v26.0";

async function metaGet<T>(pathOrUrl: string): Promise<T> {
  const url = pathOrUrl.startsWith("http")
    ? new URL(pathOrUrl)
    : new URL(`https://graph.facebook.com/${META_API_VERSION}/${pathOrUrl.replace(/^\//, "")}`);
  if (!url.searchParams.has("access_token")) url.searchParams.set("access_token", META_ACCESS_TOKEN || "");
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || data?.error) throw new Error(data?.error?.message || `Meta API HTTP ${res.status}`);
  return data as T;
}

async function supabaseUpsert(table: string, rows: unknown[], onConflict: string) {
  if (!rows.length) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`Supabase upsert ${table} failed: ${res.status} ${await res.text()}`);
}

async function canDiscover(req: Request): Promise<boolean> {
  const authorization = req.headers.get("authorization") || "";
  if (authorization === `Bearer ${SERVICE_ROLE_KEY}`) return true;
  if (!authorization.startsWith("Bearer ")) return false;
  const auth = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { authorization, apikey: SERVICE_ROLE_KEY },
  });
  if (!auth.ok) return false;
  const user = await auth.json();
  if (typeof user.id !== "string") return false;
  const id = encodeURIComponent(user.id);
  const headers = { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY };
  const [profile, member] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}&is_active=eq.true&select=id&limit=1`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/team_members?profile_id=eq.${id}&is_active=eq.true&access_type=eq.total&select=id&limit=1`, { headers }),
  ]);
  return profile.ok && member.ok && (await profile.json()).length === 1 && (await member.json()).length === 1;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  try {
    if (!await canDiscover(req)) return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
  } catch {
    return Response.json({ ok: false, error: "authorization unavailable" }, { status: 503 });
  }
  if (!META_ACCESS_TOKEN) {
    return Response.json({ ok: false, error: "META_ACCESS_TOKEN is not configured" }, { status: 503 });
  }

  const startedAt = new Date().toISOString();
  let discovered = 0;
  try {
    let next: string | undefined = `me/adaccounts?fields=id,account_id,name,currency,timezone_name,account_status&limit=100`;
    while (next) {
      const page = await metaGet<MetaPage<any>>(next);
      const rows = (page.data || []).map((a: any) => ({
        meta_account_id: a.id,
        account_id: a.account_id || null,
        name: a.name || null,
        currency: a.currency || null,
        timezone_name: a.timezone_name || null,
        account_status: a.account_status ?? null,
        updated_at: new Date().toISOString(),
      }));
      await supabaseUpsert("meta_ad_accounts", rows, "meta_account_id");
      discovered += rows.length;
      next = page.paging?.next;
    }

    await fetch(`${SUPABASE_URL}/rest/v1/meta_sync_runs`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "apikey": SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "discover",
        status: "success",
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        rows_upserted: discovered,
        details: { api_version: META_API_VERSION }
      }),
    });

    return Response.json({ ok: true, discovered, api_version: META_API_VERSION });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/meta_sync_runs`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
          "apikey": SERVICE_ROLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "discover",
          status: "error",
          started_at: startedAt,
          finished_at: new Date().toISOString(),
          error_message: message,
          details: { api_version: META_API_VERSION }
        }),
      });
    } catch {}
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
