import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WA_TOKEN = Deno.env.get("WHATSAPP_CLOUD_TOKEN") ?? "";
const WA_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_CLOUD_PHONE_NUMBER_ID") ?? "";
const REMINDER_TEMPLATE = Deno.env.get("WHATSAPP_TEMPLATE_REMINDER") ?? "lembrete_vencimento";
const REMINDER_TEMPLATE_LANG = Deno.env.get("WHATSAPP_TEMPLATE_REMINDER_LANG") ?? "pt_BR";
const TASK_TEMPLATE = Deno.env.get("WHATSAPP_TEMPLATE_TASK") ?? "lembrete_tarefa";
const TASK_TEMPLATE_LANG = Deno.env.get("WHATSAPP_TEMPLATE_TASK_LANG") ?? "pt_BR";
const PIX_TEMPLATE = Deno.env.get("WHATSAPP_TEMPLATE_PIX") ?? "cobranca_pix";
const PIX_TEMPLATE_LANG = Deno.env.get("WHATSAPP_TEMPLATE_PIX_LANG") ?? "pt_BR";
const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}/${WA_PHONE_NUMBER_ID}`;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

function pad(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}
function buildMerchantAccountInfo(pixKey: string): string {
  return pad("26", pad("00", "br.gov.bcb.pix") + pad("01", pixKey));
}
function calculateCRC16(payload: string): string {
  const polynomial = 0x1021;
  let crc = 0xffff;
  const bytes = new TextEncoder().encode(payload);
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? (crc << 1) ^ polynomial : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
function generatePixPayload(p: { pixKey: string; merchantName: string; merchantCity: string; amount?: number; txId?: string }): string {
  let payload = "";
  payload += pad("00", "01");
  payload += pad("01", "12");
  payload += buildMerchantAccountInfo(p.pixKey);
  payload += pad("52", "0000");
  payload += pad("53", "986");
  if (p.amount && p.amount > 0) payload += pad("54", p.amount.toFixed(2));
  payload += pad("58", "BR");
  const name = p.merchantName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 25);
  payload += pad("59", name);
  const city = p.merchantCity.normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 15);
  payload += pad("60", city);
  payload += pad("62", pad("05", p.txId || "***"));
  payload += "6304";
  return payload + calculateCRC16(payload);
}

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
async function sendImageByUrl(to: string, url: string, caption: string) {
  return waPost("/messages", { messaging_product: "whatsapp", to, type: "image", image: { link: url, caption } });
}
async function sendText(to: string, text: string) {
  return waPost("/messages", { messaging_product: "whatsapp", to, type: "text", text: { body: text, preview_url: false } });
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

    // ===== Ação ad-hoc: enviar texto livre (ex: link de biometria) =====
    // Observação: a Cloud API só permite texto livre dentro da janela de 24h após
    // a última mensagem do cliente. Fora dessa janela, é necessário usar um template.
    if (req.method === "POST") {
      let body: any = null;
      try { body = await req.json(); } catch { /* sem body */ }
      if (body?.action === "send_text" && body?.to && body?.text) {
        const r = await sendText(normalizePhone(String(body.to)), String(body.text));
        return new Response(JSON.stringify({ ok: r.ok, status: r.status, data: r.data }), {
          status: r.ok ? 200 : 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }


    const today = new Date();
    const currentHour = today.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false });
    const todayStr = today.toISOString().split("T")[0];
    let sent = 0;
    const errors: any[] = [];

    const in3days = new Date(today);
    in3days.setDate(today.getDate() + 3);
    const in3daysStr = in3days.toISOString().split("T")[0];

    // ===== Tasks reminders =====
    const { data: completedStatuses } = await supabase.from("status_configs").select("id").ilike("name", "%conclu%");
    const excludeStatusIds = (completedStatuses ?? []).map((s: any) => s.id);

    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, name, end_date, responsible_id, status_id")
      .gte("end_date", todayStr)
      .lte("end_date", in3daysStr)
      .not("responsible_id", "is", null);

    const pendingTasks = (tasks ?? []).filter((t: any) => !excludeStatusIds.includes(t.status_id));
    const taskUserIds = [...new Set(pendingTasks.map((t: any) => t.responsible_id))];

    if (taskUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, whatsapp_phone")
        .in("user_id", taskUserIds);
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));

      for (const task of pendingTasks) {
        const profile: any = profileMap.get(task.responsible_id);
        if (!profile?.whatsapp_phone) continue;
        const endDate = new Date(task.end_date + "T00:00:00-03:00");
        const venc = endDate.toLocaleDateString("pt-BR");
        const r = await sendTemplate(normalizePhone(profile.whatsapp_phone), TASK_TEMPLATE, TASK_TEMPLATE_LANG, [
          profile.full_name || "Olá",
          task.name,
          venc,
        ]);
        if (r.ok) sent++;
        else errors.push({ kind: "task", to: profile.whatsapp_phone, err: r.data });
      }
    }

    // ===== Payables/Receivables =====
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name, pix_key, pix_key_type, pix_holder_name, pix_city, whatsapp_notify_enabled, whatsapp_notify_days_before, whatsapp_notify_time");

    for (const company of companies ?? []) {
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

      const csIds = [...new Set(prItems.filter((i: any) => i.client_supplier_id).map((i: any) => i.client_supplier_id))];
      const csMap = new Map<string, { name: string; phone: string }>();
      if (csIds.length > 0) {
        const { data: csData } = await supabase
          .from("clients_suppliers")
          .select("id, name, whatsapp_phone")
          .in("id", csIds);
        for (const cs of csData ?? []) {
          if ((cs as any).whatsapp_phone) csMap.set(cs.id, { name: (cs as any).name, phone: (cs as any).whatsapp_phone });
        }
      }

      const creatorIds = [...new Set(prItems.filter((i: any) => i.created_by).map((i: any) => i.created_by))];
      const creatorMap = new Map<string, { name: string; phone: string }>();
      if (creatorIds.length > 0) {
        const { data: cp } = await supabase
          .from("profiles")
          .select("user_id, full_name, whatsapp_phone")
          .in("user_id", creatorIds);
        for (const p of cp ?? []) {
          if ((p as any).whatsapp_phone)
            creatorMap.set((p as any).user_id, { name: (p as any).full_name || "Olá", phone: (p as any).whatsapp_phone });
        }
      }

      const hasPixConfig = (company as any).pix_key && (company as any).pix_holder_name;

      for (const item of prItems) {
        const dueDate = new Date(item.due_date + "T00:00:00-03:00");
        const venc = dueDate.toLocaleDateString("pt-BR");
        const valorNumStr = item.is_amount_pending
          ? "a definir"
          : Number(item.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
        const valorStr = item.is_amount_pending
          ? "A definir"
          : `R$ ${Number(item.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

        const sendReminder = async (recipientName: string, phone: string, includePix: boolean) => {
          const to = normalizePhone(phone);

          if (includePix && item.type === "receivable" && hasPixConfig && !item.is_amount_pending && item.amount && Number(item.amount) > 0) {
            // Cobrança PIX completa: template PIX + QR + copia-e-cola
            const pixPayload = generatePixPayload({
              pixKey: (company as any).pix_key,
              merchantName: (company as any).pix_holder_name || company.name,
              merchantCity: (company as any).pix_city || "SAO PAULO",
              amount: Number(item.amount),
              txId: item.id.substring(0, 25).replace(/-/g, ""),
            });
            const tpl = await sendTemplate(to, PIX_TEMPLATE, PIX_TEMPLATE_LANG, [company.name, item.description, valorStr]);
            if (!tpl.ok) {
              errors.push({ kind: "pix-template", to: phone, err: tpl.data });
              return;
            }
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(pixPayload)}`;
            await sendImageByUrl(to, qrUrl, `${company.name} — PIX\n${item.description}\nValor: ${valorStr}\nVenc: ${venc}`);
            await sendText(to, pixPayload);
            sent++;
          } else {
            // Lembrete simples
            const r = await sendTemplate(to, REMINDER_TEMPLATE, REMINDER_TEMPLATE_LANG, [
              recipientName,
              item.description,
              valorNumStr,
              venc,
            ]);
            if (r.ok) sent++;
            else errors.push({ kind: "reminder", to: phone, err: r.data });
          }
        };

        if (item.client_supplier_id && csMap.has(item.client_supplier_id)) {
          const cs = csMap.get(item.client_supplier_id)!;
          await sendReminder(cs.name, cs.phone, true);
        }
        if (item.created_by && creatorMap.has(item.created_by)) {
          const c = creatorMap.get(item.created_by)!;
          await sendReminder(c.name, c.phone, false);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, notificationsSent: sent, errors: errors.length ? errors : undefined }),
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
