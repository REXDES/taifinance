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
          hint: `Cadastre e aprove na Meta o template '${TEMPLATE}' (${TEMPLATE_LANG}), categoria Utilidade, sem cabeçalho e sem botões, com 4 variáveis no corpo: {{1}} empresa, {{2}} descrição, {{3}} valor, {{4}} instrução. O texto pronto está em docs/whatsapp-template-cobranca.md.`,
          details: tpl.data,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // O código/linha digitável/link vai como texto puro (sem prefixo e sem
    // preview) para o cliente poder copiar a mensagem inteira de uma vez.
    const code = String(paymentInfo).trim();
    const txt = await sendText(to, code);
    if (!txt.ok) {
      console.error("Code text send failed:", JSON.stringify(txt.data));
      return new Response(
        JSON.stringify({
          success: false,
          error:
            txt.data?.error?.message ||
            "O aviso foi enviado, mas o código de pagamento não pôde ser entregue.",
          hint:
            "A Meta só aceita mensagem de texto livre depois que o cliente responde, ou dentro da janela de 24h de conversa. Peça ao cliente para responder qualquer coisa no WhatsApp e reenvie, ou copie o código e envie manualmente.",
          details: txt.data,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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
