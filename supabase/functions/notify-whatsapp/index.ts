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
    const in3days = new Date(today);
    in3days.setDate(today.getDate() + 3);

    const todayStr = today.toISOString().split("T")[0];
    const in3daysStr = in3days.toISOString().split("T")[0];

    // Find status_configs named "Concluído" to exclude completed tasks
    const { data: completedStatuses } = await supabase
      .from("status_configs")
      .select("id")
      .ilike("name", "%conclu%");

    const excludeStatusIds = (completedStatuses ?? []).map((s: any) => s.id);

    // Fetch tasks with end_date between today and +3 days
    let query = supabase
      .from("tasks")
      .select(
        `
        id,
        name,
        end_date,
        responsible_id,
        status_id
      `
      )
      .gte("end_date", todayStr)
      .lte("end_date", in3daysStr)
      .not("responsible_id", "is", null);

    const { data: tasks, error } = await query;

    if (error) throw error;

    // Filter out completed tasks
    const pendingTasks = (tasks ?? []).filter(
      (t: any) => !excludeStatusIds.includes(t.status_id)
    );

    // Get unique responsible_ids and fetch their profiles
    const responsibleIds = [
      ...new Set(pendingTasks.map((t: any) => t.responsible_id)),
    ];

    if (responsibleIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, notificationsSent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, whatsapp_phone")
      .in("user_id", responsibleIds);

    const profileMap = new Map(
      (profiles ?? []).map((p: any) => [p.user_id, p])
    );

    let sent = 0;
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
