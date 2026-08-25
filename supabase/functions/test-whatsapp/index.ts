import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WA_TOKEN = Deno.env.get("WHATSAPP_CLOUD_TOKEN") ?? "";
const WA_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_CLOUD_PHONE_NUMBER_ID") ?? "";
const GRAPH_VERSION = "v21.0";

function normalizePhone(phone: string): string {
  let n = phone.replace(/\D/g, "");
  // Brazilian numbers should start with 55
  if (n.length === 10 || n.length === 11) n = "55" + n;
  return n;
}

async function sendTemplate(to: string, templateName: string, languageCode = "pt_BR", components?: any[]) {
  const body: any = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
    },
  };
  if (components && components.length > 0) body.template.components = components;

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${WA_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WA_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!WA_TOKEN || !WA_PHONE_NUMBER_ID) {
      return new Response(
        JSON.stringify({ error: "WhatsApp Cloud API não configurada (token/phone_number_id ausentes)." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { phone } = await req.json();
    if (!phone) {
      return new Response(
        JSON.stringify({ error: "Phone number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const to = normalizePhone(phone);
    // Meta's pre-approved test template, language en_US
    const result = await sendTemplate(to, "hello_world", "en_US");

    if (!result.ok) {
      console.error("WhatsApp test failed:", JSON.stringify(result.data));
      return new Response(
        JSON.stringify({ success: false, error: result.data?.error?.message || "Falha ao enviar", details: result.data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: result.data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("test-whatsapp error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
