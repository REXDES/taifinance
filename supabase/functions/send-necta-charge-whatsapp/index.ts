import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logWhatsapp, messageIdFrom } from "../_shared/whatsappLog.ts";

// Envio de cobrança Necta (PIX/boleto/bolepix/link) por WhatsApp Cloud API.
// Um único template de utilidade carrega TODO o conteúdo, inclusive o código
// ou link de pagamento. Isso evita depender da janela de 24h da Meta, que
// bloqueava a segunda mensagem (texto livre) com o código.

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

// {{4}} — forma de pagamento apresentada ao cliente.
const METHOD_LABEL: Record<string, string> = {
  pix: "PIX",
  bank_slip: "Boleto",
  pix_cappta: "Bolepix (boleto com PIX)",
  link: "Link de pagamento",
};

function normalizePhone(phone: string): string {
  let n = phone.replace(/\D/g, "");
  if (n.length === 10 || n.length === 11) n = "55" + n;
  return n;
}

/**
 * A Meta recusa parâmetros de template com quebras de linha, tabulações ou
 * sequências de 5+ espaços. O código PIX/linha digitável já vem em uma linha,
 * mas normalizamos por segurança.
 */
function sanitizeParam(value: string): string {
  return String(value).replace(/\s+/g, " ").trim();
}

async function waPost(path: string, body: unknown) {
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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!WA_TOKEN || !WA_PHONE_NUMBER_ID) {
      return json({ error: "WhatsApp Cloud API não configurada." }, 500);
    }

    const { phone, companyName, description, amount, method, paymentInfo, companyId, payerName } =
      await req.json();
    if (!phone || !description || !method || !paymentInfo) {
      return json({ error: "phone, description, method e paymentInfo são obrigatórios" }, 400);
    }

    const methodLabel = METHOD_LABEL[method];
    if (!methodLabel) return json({ error: `method inválido: ${method}` }, 400);

    const logBase = {
      company_id: companyId ?? null,
      kind: "charge",
      template_name: TEMPLATE,
      recipient_name: payerName ?? null,
      recipient_phone: String(phone),
      description: description ?? null,
      amount: amount != null ? Number(amount) : null,
      method,
    };

    const to = normalizePhone(phone);
    if (to.length < 12) {
      await logWhatsapp({
        ...logBase,
        success: false,
        error_message: "Número de WhatsApp inválido.",
      });
      return json({
        success: false,
        error: "Número de WhatsApp inválido.",
        hint: "Informe o telefone do pagador com DDD (ex.: 11999998888).",
      });
    }

    const valorStr = amount
      ? `R$ ${Number(amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
      : "valor não informado";

    const params = [
      sanitizeParam(companyName || "Empresa"),
      sanitizeParam(description),
      sanitizeParam(valorStr),
      sanitizeParam(methodLabel),
      sanitizeParam(String(paymentInfo)),
    ];

    const tpl = await sendTemplate(to, TEMPLATE, TEMPLATE_LANG, params);
    if (!tpl.ok) {
      console.error("Template send failed:", JSON.stringify(tpl.data));
      const metaMessage: string = tpl.data?.error?.message ?? "Falha ao enviar a mensagem";
      const templateProblem = /template/i.test(metaMessage) || tpl.data?.error?.code === 132000 ||
        tpl.data?.error?.code === 132001;
      await logWhatsapp({ ...logBase, success: false, error_message: metaMessage, response: tpl.data });
      return json({
        success: false,
        error: metaMessage,
        hint: templateProblem
          ? `Edite na Meta o template '${TEMPLATE}' (${TEMPLATE_LANG}) para ter 5 variáveis no corpo: {{1}} empresa, {{2}} descrição, {{3}} valor, {{4}} forma de pagamento e {{5}} código ou link. O texto pronto está em docs/whatsapp-template-cobranca.md. O envio volta a funcionar assim que a Meta aprovar a alteração.`
          : "Confira o número do pagador e tente novamente. Se persistir, copie o código e envie manualmente.",
        details: tpl.data,
      });
    }

    await logWhatsapp({
      ...logBase,
      success: true,
      provider_message_id: messageIdFrom(tpl.data),
      response: tpl.data,
    });
    return json({ success: true, template: tpl.data });
  } catch (err) {
    console.error("send-necta-charge-whatsapp error:", err);
    return json({ error: String(err) }, 500);
  }
});
