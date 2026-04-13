import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EVOLUTION_API_URL =
  "https://evolution-api-production-a169.up.railway.app";
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") ?? "";
const EVOLUTION_INSTANCE = "taifinance";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

// ===== PIX Payload Generator (server-side copy) =====

function pad(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

function buildMerchantAccountInfo(pixKey: string): string {
  const gui = pad('00', 'br.gov.bcb.pix');
  const key = pad('01', pixKey);
  return pad('26', gui + key);
}

function calculateCRC16(payload: string): string {
  const polynomial = 0x1021;
  let crc = 0xFFFF;
  const bytes = new TextEncoder().encode(payload);
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ polynomial;
      } else {
        crc = crc << 1;
      }
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function generatePixPayload(params: {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amount?: number;
  txId?: string;
}): string {
  const { pixKey, merchantName, merchantCity, amount, txId } = params;
  let payload = '';
  payload += pad('00', '01');
  payload += pad('01', '12');
  payload += buildMerchantAccountInfo(pixKey);
  payload += pad('52', '0000');
  payload += pad('53', '986');
  if (amount && amount > 0) {
    payload += pad('54', amount.toFixed(2));
  }
  payload += pad('58', 'BR');
  const name = merchantName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').substring(0, 25);
  payload += pad('59', name);
  const city = merchantCity.normalize('NFD').replace(/[\u0300-\u036f]/g, '').substring(0, 15);
  payload += pad('60', city);
  const txIdValue = txId || '***';
  payload += pad('62', pad('05', txIdValue));
  payload += '6304';
  return payload + calculateCRC16(payload);
}

// ===== WhatsApp Sending =====

async function sendWhatsApp(phone: string, message: string) {
  const number = phone.replace(/\D/g, "");
  const response = await fetch(
    `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY,
      },
      body: JSON.stringify({ number, textMessage: { text: message } }),
    }
  );
  return response.json();
}

async function sendWhatsAppImage(phone: string, base64: string, caption: string) {
  const number = phone.replace(/\D/g, "");
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
  return response.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const today = new Date();
    const currentHour = today.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false });
    const todayStr = today.toISOString().split("T")[0];
    let sent = 0;

    // ========== 1. TASK NOTIFICATIONS ==========
    const in3days = new Date(today);
    in3days.setDate(today.getDate() + 3);
    const in3daysStr = in3days.toISOString().split("T")[0];

    const { data: completedStatuses } = await supabase
      .from("status_configs")
      .select("id")
      .ilike("name", "%conclu%");

    const excludeStatusIds = (completedStatuses ?? []).map((s: any) => s.id);

    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select("id, name, end_date, responsible_id, status_id")
      .gte("end_date", todayStr)
      .lte("end_date", in3daysStr)
      .not("responsible_id", "is", null);

    if (tasksError) throw tasksError;

    const pendingTasks = (tasks ?? []).filter(
      (t: any) => !excludeStatusIds.includes(t.status_id)
    );

    const taskUserIds = [...new Set(pendingTasks.map((t: any) => t.responsible_id))];

    if (taskUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, whatsapp_phone")
        .in("user_id", taskUserIds);

      const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));

      for (const task of pendingTasks) {
        const profile = profileMap.get(task.responsible_id);
        if (!profile?.whatsapp_phone) continue;

        const endDate = new Date(task.end_date + "T00:00:00-03:00");
        const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        let urgencia = "";
        if (diffDays <= 0) urgencia = "⚠️ *VENCE HOJE*";
        else if (diffDays === 1) urgencia = "⏰ *Vence amanhã*";
        else urgencia = `📅 Vence em ${diffDays} dias`;

        const msg =
          `🔔 *TAI Finance — Lembrete de Tarefa*\n\n` +
          `${urgencia}\n\n` +
          `📋 *Tarefa:* ${task.name}\n` +
          `📆 *Data limite:* ${endDate.toLocaleDateString("pt-BR")}\n\n` +
          `Acesse o TAI Finance para mais detalhes.`;

        await sendWhatsApp(profile.whatsapp_phone, msg);
        sent++;
      }
    }

    // ========== 2. PAYABLES/RECEIVABLES NOTIFICATIONS ==========

    const { data: companies } = await supabase
      .from("companies")
      .select("id, name, pix_key, pix_key_type, pix_holder_name, pix_city, whatsapp_notify_enabled, whatsapp_notify_days_before, whatsapp_notify_time");

    for (const company of (companies ?? [])) {
      if (!(company as any).whatsapp_notify_enabled) continue;

      const notifyDays: number[] = (company as any).whatsapp_notify_days_before || [0];
      const notifyTime: string = (company as any).whatsapp_notify_time || "08:00";

      const [configH] = notifyTime.split(":").map(Number);
      const [currentH] = currentHour.split(":").map(Number);
      if (Math.abs(configH - currentH) > 0) continue;

      const targetDates: string[] = notifyDays.map((days: number) => {
        const d = new Date(today);
        d.setDate(d.getDate() + days);
        return d.toISOString().split("T")[0];
      });

      if (targetDates.length === 0) continue;

      const { data: prItems } = await supabase
        .from("payables_receivables")
        .select("id, description, amount, type, due_date, status, client_supplier_id, is_amount_pending, created_by")
        .eq("company_id", company.id)
        .eq("status", "pending")
        .in("due_date", targetDates);

      if (!prItems || prItems.length === 0) continue;

      // Get client/supplier WhatsApp phones
      const csIds = [...new Set(
        (prItems ?? []).filter((item: any) => item.client_supplier_id).map((item: any) => item.client_supplier_id)
      )];

      let csPhoneMap = new Map<string, string>();
      if (csIds.length > 0) {
        const { data: csData } = await supabase
          .from("clients_suppliers")
          .select("id, name, whatsapp_phone")
          .in("id", csIds);

        for (const cs of (csData ?? [])) {
          if ((cs as any).whatsapp_phone) {
            csPhoneMap.set(cs.id, (cs as any).whatsapp_phone);
          }
        }
      }

      // Creator profiles for fallback
      const creatorIds = [...new Set(
        (prItems ?? []).filter((item: any) => item.created_by).map((item: any) => item.created_by)
      )];

      let creatorPhoneMap = new Map<string, string>();
      if (creatorIds.length > 0) {
        const { data: creatorProfiles } = await supabase
          .from("profiles")
          .select("user_id, whatsapp_phone")
          .in("user_id", creatorIds);

        for (const p of (creatorProfiles ?? [])) {
          if (p.whatsapp_phone) {
            creatorPhoneMap.set(p.user_id, p.whatsapp_phone);
          }
        }
      }

      // Check if company has PIX configured
      const hasPixConfig = (company as any).pix_key && (company as any).pix_holder_name;

      for (const item of prItems) {
        const dueDate = new Date(item.due_date + "T00:00:00-03:00");
        const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        let urgencia = "";
        if (diffDays <= 0) urgencia = "⚠️ *VENCE HOJE*";
        else if (diffDays === 1) urgencia = "⏰ *Vence amanhã*";
        else urgencia = `📅 Vence em ${diffDays} dias`;

        const tipoLabel = item.type === "payable" ? "Conta a Pagar" : "Conta a Receber";
        const tipoEmoji = item.type === "payable" ? "💸" : "💰";
        const valorStr = item.is_amount_pending
          ? "A definir"
          : `R$ ${Number(item.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

        const msg =
          `🔔 *${company.name} — ${tipoLabel}*\n\n` +
          `${urgencia}\n\n` +
          `${tipoEmoji} *Descrição:* ${item.description}\n` +
          `💵 *Valor:* ${valorStr}\n` +
          `📆 *Vencimento:* ${dueDate.toLocaleDateString("pt-BR")}\n\n` +
          `Acesse o TAI Finance para mais detalhes.`;

        // Generate PIX QR code for receivables with amount defined and PIX configured
        let pixPayload: string | null = null;
        let qrBase64: string | null = null;

        if (
          item.type === "receivable" &&
          hasPixConfig &&
          !item.is_amount_pending &&
          item.amount &&
          Number(item.amount) > 0
        ) {
          try {
            pixPayload = generatePixPayload({
              pixKey: (company as any).pix_key,
              merchantName: (company as any).pix_holder_name || company.name,
              merchantCity: (company as any).pix_city || "SAO PAULO",
              amount: Number(item.amount),
              txId: item.id.substring(0, 25).replace(/-/g, ""),
            });
            qrBase64 = await QRCode.toDataURL(pixPayload, { width: 400, margin: 2 });
          } catch (e) {
            console.error("Error generating PIX QR:", e);
          }
        }

        // Helper to send notification (text + optional QR)
        const sendNotification = async (phone: string) => {
          if (pixPayload && qrBase64) {
            // Send QR code image with caption
            const caption =
              `${tipoEmoji} *${company.name} — Cobrança PIX*\n\n` +
              `${urgencia}\n\n` +
              `📋 *Descrição:* ${item.description}\n` +
              `💵 *Valor:* ${valorStr}\n` +
              `📆 *Vencimento:* ${dueDate.toLocaleDateString("pt-BR")}\n\n` +
              `📱 Escaneie o QR Code ou copie o código abaixo:`;

            await sendWhatsAppImage(phone, qrBase64!, caption);

            // Send pix copia e cola as text
            const pixText =
              `📱 *Pix Copia e Cola:*\n\n${pixPayload}\n\n` +
              `Copie o código acima e cole no seu app do banco para efetuar o pagamento. 🏦`;
            await sendWhatsApp(phone, pixText);
          } else {
            await sendWhatsApp(phone, msg);
          }
          sent++;
        };

        // Send to client/supplier
        if (item.client_supplier_id && csPhoneMap.has(item.client_supplier_id)) {
          await sendNotification(csPhoneMap.get(item.client_supplier_id)!);
        }

        // Send to creator (without PIX QR, just notification)
        if (item.created_by && creatorPhoneMap.has(item.created_by)) {
          await sendWhatsApp(creatorPhoneMap.get(item.created_by)!, msg);
          sent++;
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, notificationsSent: sent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error in notify-whatsapp:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
