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
      body: JSON.stringify({
        number,
        textMessage: { text: message },
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

    // ========== 1. TASK NOTIFICATIONS (unchanged) ==========
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

    const taskUserIds = [
      ...new Set(pendingTasks.map((t: any) => t.responsible_id)),
    ];

    // Fetch profiles for task notifications
    if (taskUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, whatsapp_phone")
        .in("user_id", taskUserIds);

      const profileMap = new Map(
        (profiles ?? []).map((p: any) => [p.user_id, p])
      );

      for (const task of pendingTasks) {
        const profile = profileMap.get(task.responsible_id);
        if (!profile?.whatsapp_phone) continue;

        const endDate = new Date(task.end_date + "T00:00:00-03:00");
        const diffDays = Math.ceil(
          (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

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

    // ========== 2. PAYABLES/RECEIVABLES NOTIFICATIONS (company-based) ==========
    
    // Fetch companies with notifications enabled
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name, whatsapp_notify_enabled, whatsapp_notify_days_before, whatsapp_notify_time");

    for (const company of (companies ?? [])) {
      if (!(company as any).whatsapp_notify_enabled) continue;

      const notifyDays: number[] = (company as any).whatsapp_notify_days_before || [0];
      const notifyTime: string = (company as any).whatsapp_notify_time || "08:00";

      // Check if current hour matches configured time (within 1 hour window)
      const [configH] = notifyTime.split(":").map(Number);
      const [currentH] = currentHour.split(":").map(Number);
      if (Math.abs(configH - currentH) > 0) continue;

      // Calculate target due dates based on configured days
      const targetDates: string[] = notifyDays.map((days: number) => {
        const d = new Date(today);
        d.setDate(d.getDate() + days);
        return d.toISOString().split("T")[0];
      });

      if (targetDates.length === 0) continue;

      // Fetch pending payables/receivables for these due dates
      const { data: prItems } = await supabase
        .from("payables_receivables")
        .select("id, description, amount, type, due_date, status, client_supplier_id, is_amount_pending, created_by")
        .eq("company_id", company.id)
        .eq("status", "pending")
        .in("due_date", targetDates);

      if (!prItems || prItems.length === 0) continue;

      // Get client/supplier WhatsApp phones
      const csIds = [...new Set(
        (prItems ?? [])
          .filter((item: any) => item.client_supplier_id)
          .map((item: any) => item.client_supplier_id)
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

      // Also get creator profiles for fallback
      const creatorIds = [...new Set(
        (prItems ?? [])
          .filter((item: any) => item.created_by)
          .map((item: any) => item.created_by)
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

      for (const item of prItems) {
        const dueDate = new Date(item.due_date + "T00:00:00-03:00");
        const diffDays = Math.ceil(
          (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

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

        // Send to client/supplier if they have WhatsApp
        if (item.client_supplier_id && csPhoneMap.has(item.client_supplier_id)) {
          await sendWhatsApp(csPhoneMap.get(item.client_supplier_id)!, msg);
          sent++;
        }

        // Also send to creator
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
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
