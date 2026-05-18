import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WA_TOKEN = Deno.env.get("WHATSAPP_CLOUD_TOKEN") ?? "";
const WA_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_CLOUD_PHONE_NUMBER_ID") ?? "";
const PIX_TEMPLATE = Deno.env.get("WHATSAPP_TEMPLATE_PIX") ?? "pix_pagamento_cobranca";
const PIX_TEMPLATE_LANG = Deno.env.get("WHATSAPP_TEMPLATE_PIX_LANG") ?? "pt_BR";
const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}/${WA_PHONE_NUMBER_ID}`;

function normalizePhone(phone: string): string {
  let n = phone.replace(/\D/g, "");
  if (n.length === 10 || n.length === 11) n = "55" + n;
  return n;
}

async function waPost(path: string, body: any) {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

async function sendTemplate(
  to: string,
  name: string,
  lang: string,
  bodyParams: string[]
) {
  return waPost("/messages", {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name,
      language: { code: lang },
      components: [
        {
          type: "body",
          parameters: bodyParams.map((v) => ({ type: "text", text: v })),
        },
      ],
    },
  });
}

async function sendImageByUrl(to: string, imageUrl: string, caption: string) {
  return waPost("/messages", {
    messaging_product: "whatsapp",
    to,
    type: "image",
    image: { link: imageUrl, caption },
  });
}

async function sendText(to: string, text: string) {
  return waPost("/messages", {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text, preview_url: false },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!WA_TOKEN || !WA_PHONE_NUMBER_ID) {
      return new Response(
        JSON.stringify({ error: "WhatsApp Cloud API não configurada." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { phone, pixCode, description, amount, companyName } = await req.json();
    if (!phone || !pixCode || !description) {
      return new Response(
        JSON.stringify({ error: "phone, pixCode and description are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const to = normalizePhone(phone);
    const valorStr = amount
      ? Number(amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })
      : "0,00";

    // 1) Template (abre janela de conversa) — 4 variáveis posicionais
    const tpl = await sendTemplate(to, PIX_TEMPLATE, PIX_TEMPLATE_LANG, [
      companyName || "Empresa",
      description,
      valorStr,
      pixCode,
    ]);
    if (!tpl.ok) {
      console.error("Template send failed:", JSON.stringify(tpl.data));
      return new Response(
        JSON.stringify({
          success: false,
          error: tpl.data?.error?.message || "Falha ao enviar template",
          hint: `Verifique se o template '${PIX_TEMPLATE}' (${PIX_TEMPLATE_LANG}) está aprovado na Meta com 4 variáveis posicionais no body: {{1}} empresa, {{2}} descrição, {{3}} valor, {{4}} código PIX.`,
          details: tpl.data,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2) Mensagem de texto isolada com o código PIX (facilita o "copiar" no WhatsApp)
    const txt = await sendText(to, pixCode);

    return new Response(
      JSON.stringify({ success: true, template: tpl.data, text: txt.data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-pix-whatsapp error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
