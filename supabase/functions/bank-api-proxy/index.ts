import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UNIDA_BASE_URL = "https://api.unida.baas.lat/account-api/v1";

// Simple in-memory token cache
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getUnidaToken(clientId: string, clientSecret: string): Promise<string> {
  const cacheKey = `${clientId}`;
  const cached = tokenCache.get(cacheKey);
  
  // Use cached token if still valid (with 2 min buffer)
  if (cached && cached.expiresAt > Date.now() + 120_000) {
    return cached.token;
  }

  const res = await fetch(`${UNIDA_BASE_URL}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Unida auth failed [${res.status}]: ${body}`);
  }

  const data = await res.json();
  const token = data.accessToken || data.access_token || data.token;
  if (!token) throw new Error("No token in Unida auth response");

  // Cache for 28 minutes (token lasts 30 min)
  tokenCache.set(cacheKey, { token, expiresAt: Date.now() + 28 * 60 * 1000 });
  return token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate user auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the calling user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await userClient.auth.getUser();
    if (claimsError || !claimsData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, connectionId, filters } = body;

    if (!action) {
      return new Response(JSON.stringify({ error: "Missing action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For "test" action, credentials come directly (not yet saved)
    if (action === "test") {
      const { clientId, clientSecret } = body;
      if (!clientId || !clientSecret) {
        return new Response(JSON.stringify({ error: "Missing clientId or clientSecret" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const token = await getUnidaToken(clientId, clientSecret);
      const balanceRes = await fetch(`${UNIDA_BASE_URL}/balance`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!balanceRes.ok) {
        const errBody = await balanceRes.text();
        throw new Error(`Balance fetch failed [${balanceRes.status}]: ${errBody}`);
      }

      const balanceData = await balanceRes.json();
      return new Response(JSON.stringify({ success: true, balance: balanceData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For other actions, fetch credentials from DB using service role
    if (!connectionId) {
      return new Response(JSON.stringify({ error: "Missing connectionId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: conn, error: connError } = await adminClient
      .from("bank_connections")
      .select("client_id, client_secret, company_id")
      .eq("id", connectionId)
      .single();

    if (connError || !conn) {
      return new Response(JSON.stringify({ error: "Connection not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user has access to this company
    const { data: hasAccess } = await userClient.rpc("has_company_access", {
      _user_id: claimsData.user.id,
      _company_id: conn.company_id,
    });

    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = await getUnidaToken(conn.client_id, conn.client_secret);

    if (action === "balance") {
      const res = await fetch(`${UNIDA_BASE_URL}/balance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Balance failed [${res.status}]: ${errBody}`);
      }
      const data = await res.json();

      // Update last_sync_at
      await adminClient
        .from("bank_connections")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", connectionId);

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "extract") {
      const params = new URLSearchParams();
      if (filters?.startDate) params.set("startDate", filters.startDate);
      if (filters?.endDate) params.set("endDate", filters.endDate);
      if (filters?.type) params.set("type", filters.type);
      if (filters?.status) params.set("status", filters.status);
      if (filters?.page) params.set("page", String(filters.page));
      if (filters?.limit) params.set("limit", String(filters.limit));

      const url = `${UNIDA_BASE_URL}/extract${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Extract failed [${res.status}]: ${errBody}`);
      }
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("bank-api-proxy error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
