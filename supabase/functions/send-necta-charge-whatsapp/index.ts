import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Reenvio de cobrança Necta (PIX/boleto/link) por WhatsApp Cloud API.
// Mesmo esqueleto de send-pix-whatsapp, generalizado para os 3 métodos:
// o template abre a janela de 24h, e uma mensagem de texto simples logo em
// seguida carrega o código/link em si (fora do limite de aprovação da Meta).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WA_TOKEN = Deno.env.get("WHATSAPP_CLOUD_TOKEN") ?? "";
const WA_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_CLOUD_PHONE_NUMBER_ID") ?? "";
const TEMPLATE = Deno.env.get("WHATSAPP_TEMPLATE_NECTA_CHARGE") ?? "cobranca_pagamento";
const TEMPLATE_LANG = Deno.env.get("WHATSAPP_TEMPLATE_NECTA_CHARGE_LANG") ?? "pt_BR";
const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}/${WA_PHONE_NUMBER_ID}`;

const METHOD_INTRO: Record<string, string> = {
  pix: "Confira o código PIX na mensagem a seguir.",
  bank_slip: "Confira a linha digitável do boleto na mensagem a seguir.",
  pix_cappta: "Confira o código de pagamento (bolepix) na mensagem a seguir.",
  link: "Acesse o link de pagamento na mensagem a seguir.",
};

function normalizePhone(phone: string): string {
  let n = phone.replace(/\D/g, "");
  if (n.length === 10 || n.length === 11) n = "55" + n;
  return n;
}

async function waPost(path: string, body: any) {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

async function sendTemplate(to: string, name: string, lang: string, params: string[]) {
  return waPost("/messages", {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name,
      language: { code: lang },
      components: [{ type: "body", parameters: params.map((t) => ({ type: "text", text: t })) }],
    },
  });
}

async function sendText(to: string, text: string) {
  return waPost("/messages", { messaging_product: "whatsapp", to, type: "text", text: { body: text, preview_url: false } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!WA_TOKEN || !WA_PHONE_NUMBER_ID) {
      return new Response(
        JSON.stringify({ error: "WhatsApp Cloud API não configurada." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { phone, companyName, description, amount, method, paymentInfo } = await req.json();
    if (!phone || !description || !method || !paymentInfo) {
      return new Response(
        JSON.stringify({ error: "phone, description, method e paymentInfo são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const intro = METHOD_INTRO[method];
    if (!intro) {
      return new Response(
        JSON.stringify({ error: `method inválido: ${method}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const to = normalizePhone(phone);
    const valorStr = amount
      ? `R$ ${Number(amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
      : "valor não informado";

    const tpl = await sendTemplate(to, TEMPLATE, TEMPLATE_LANG, [companyName || "Empresa", description, valorStr, intro]);
    if (!tpl.ok) {
      console.error("Template send failed:", JSON.stringify(tpl.data));
      return new Response(
        JSON.stringify({
          success: false,
          error: tpl.data?.error?.message || "Falha ao enviar template",
          hint: `Verifique se o template '${TEMPLATE}' (${TEMPLATE_LANG}) está aprovado na Meta com 4 variáveis posicionais no body: {{1}} empresa, {{2}} descrição, {{3}} valor, {{4}} texto fixo de instrução.`,
          details: tpl.data,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const txt = await sendText(to, String(paymentInfo));

    return new Response(
      JSON.stringify({ success: true, template: tpl.data, text: txt.data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-necta-charge-whatsapp error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
