import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WA_TOKEN = Deno.env.get("WHATSAPP_CLOUD_TOKEN") ?? "";
const WA_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_CLOUD_PHONE_NUMBER_ID") ?? "";
const PIX_TEMPLATE = Deno.env.get("WHATSAPP_TEMPLATE_PIX") ?? "cobranca_pix";
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
  namedParams: Record<string, string>
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
          parameters: Object.entries(namedParams).map(([k, v]) => ({
            type: "text",
            parameter_name: k,
            text: v,
          })),
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
    if (!phone || !pixCode) {
      return new Response(
        JSON.stringify({ error: "Phone and pixCode are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const to = normalizePhone(phone);
    const valorStr = amount
      ? `R$ ${Number(amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
      : "Valor não informado";

    // 1) Template (abre janela de conversa)
    const tpl = await sendTemplate(to, PIX_TEMPLATE, PIX_TEMPLATE_LANG, [
      companyName || "Empresa",
      description || "Cobrança",
      valorStr,
    ]);
    if (!tpl.ok) {
      console.error("Template send failed:", JSON.stringify(tpl.data));
      return new Response(
        JSON.stringify({
          success: false,
          error: tpl.data?.error?.message || "Falha ao enviar template",
          hint: `Verifique se o template '${PIX_TEMPLATE}' (${PIX_TEMPLATE_LANG}) está aprovado na Meta com 3 variáveis no body: empresa, descrição, valor.`,
          details: tpl.data,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2) QR Code via URL pública (Meta baixa direto)
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(pixCode)}`;
    const imgCaption =
      `${companyName || "Empresa"} — Cobrança PIX\nDescrição: ${description}\nValor: ${valorStr}\n\nEscaneie o QR Code ou copie o código PIX abaixo.`;
    const img = await sendImageByUrl(to, qrUrl, imgCaption);

    // 3) Código copia-e-cola
    const txt = await sendText(to, pixCode);

    return new Response(
      JSON.stringify({ success: true, template: tpl.data, image: img.data, text: txt.data }),
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
