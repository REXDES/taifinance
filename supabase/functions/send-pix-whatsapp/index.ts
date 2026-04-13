import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EVOLUTION_API_URL =
  "https://evolution-api-production-a169.up.railway.app";
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") ?? "";
const EVOLUTION_INSTANCE = "taifinance";
const PIX_COPY_BASE_URL = "https://taifinance.lovable.app/pix/copiar";

function buildPixCopyLink(pixCode: string): string {
  return `${PIX_COPY_BASE_URL}?code=${encodeURIComponent(pixCode)}`;
}

async function generateQrCodeBase64(data: string): Promise<string> {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(data)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`QR API error: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  let binary = '';
  for (const byte of uint8Array) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

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
  const response = await fetch(
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
  const result = await response.json();
  console.log("sendMedia response:", JSON.stringify(result));
  return result;
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
    const copyLink = buildPixCopyLink(pixCode);
    const valorStr = amount
      ? `R$ ${Number(amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
      : "Valor não informado";

    console.log("Generating QR code for PIX payload...");
    const qrBase64 = await generateQrCodeBase64(pixCode);
    console.log("QR code generated, base64 length:", qrBase64.length);

    const caption =
      `💰 *${companyName || "Empresa"} — Cobrança PIX*\n\n` +
      `📋 *Descrição:* ${description}\n` +
      `💵 *Valor:* ${valorStr}\n\n` +
      `📱 Escaneie o QR Code acima ou use o link de cópia enviado na próxima mensagem.`;

    console.log("Sending QR code image via WhatsApp...");
    const imageResult = await sendImageMessage(number, qrBase64, caption);

    const textMsg =
      `📱 *Pix Copia e Cola:*\n\n${pixCode}\n\n` +
      `🔗 *Copiar no celular:*\n${copyLink}\n\n` +
      `Toque no link acima para abrir a página e copiar automaticamente.`;

    const textResponse = await sendTextMessage(number, textMsg);
    const textData = await textResponse.json();

    return new Response(
      JSON.stringify({ success: true, image: imageResult, text: textData }),
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
