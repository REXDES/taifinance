import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import QRCode from "https://esm.sh/qrcode@1.5.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EVOLUTION_API_URL =
  "https://evolution-api-production-a169.up.railway.app";
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") ?? "";
const EVOLUTION_INSTANCE = "taifinance";

async function sendTextMessage(number: string, text: string) {
  return fetch(
    `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY,
      },
      body: JSON.stringify({ number, textMessage: { text } }),
    }
  );
}

async function sendImageMessage(number: string, base64: string, caption: string) {
  return fetch(
    `${EVOLUTION_API_URL}/message/sendMedia/${EVOLUTION_INSTANCE}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number,
        mediaMessage: {
          mediatype: "image",
          caption,
          media: base64,
          fileName: "pix-qrcode.png",
        },
      }),
    }
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, pixCode, description, amount, companyName } = await req.json();

    if (!phone || !pixCode) {
      return new Response(
        JSON.stringify({ error: "Phone and pixCode are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const number = phone.replace(/\D/g, "");
    const valorStr = amount
      ? `R$ ${Number(amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
      : "Valor não informado";

    // Generate QR Code as base64 PNG
    const qrBase64 = await QRCode.toDataURL(pixCode, { width: 400, margin: 2 });
    // Remove "data:image/png;base64," prefix
    const base64Data = qrBase64.replace(/^data:image\/png;base64,/, "");

    const caption =
      `💰 *${companyName || "Empresa"} — Cobrança PIX*\n\n` +
      `📋 *Descrição:* ${description}\n` +
      `💵 *Valor:* ${valorStr}\n\n` +
      `📱 Escaneie o QR Code acima ou copie o código abaixo:`;

    // Send QR code image first
    await sendImageMessage(number, qrBase64, caption);

    // Then send the copy-paste code as text
    const textMsg =
      `📱 *Pix Copia e Cola:*\n\n${pixCode}\n\n` +
      `Copie o código acima e cole no seu app do banco para efetuar o pagamento. 🏦`;

    const response = await sendTextMessage(number, textMsg);
    const data = await response.json();

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error in send-pix-whatsapp:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
