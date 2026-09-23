// Registro central dos envios de WhatsApp, usado pelo relatório de envios.
// Nunca deve quebrar o envio: qualquer falha ao gravar o log é apenas logada.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface WhatsappLogEntry {
  company_id?: string | null;
  /** charge | pix | reminder | task | text | test */
  kind: string;
  template_name?: string | null;
  recipient_name?: string | null;
  recipient_phone: string;
  description?: string | null;
  amount?: number | null;
  method?: string | null;
  success: boolean;
  error_message?: string | null;
  provider_message_id?: string | null;
  response?: unknown;
  created_by?: string | null;
}

let client: ReturnType<typeof createClient> | null = null;
function admin() {
  if (!client) {
    client = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
  }
  return client;
}

export function messageIdFrom(data: unknown): string | null {
  const id = (data as any)?.messages?.[0]?.id;
  return typeof id === "string" ? id : null;
}

export async function logWhatsapp(entry: WhatsappLogEntry): Promise<void> {
  try {
    const { error } = await admin().from("whatsapp_message_logs").insert({
      ...entry,
      response: entry.response ?? null,
    });
    if (error) console.error("whatsapp log insert failed:", error.message);
  } catch (err) {
    console.error("whatsapp log error:", String(err));
  }
}
