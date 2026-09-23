import { supabase } from '@/integrations/supabase/client';

export interface WhatsappClientLog {
  companyId: string | null;
  /** charge | pix | reminder | task | text */
  kind: string;
  recipientName?: string | null;
  recipientPhone: string;
  description?: string | null;
  amount?: number | null;
  method?: string | null;
  success: boolean;
  errorMessage?: string | null;
}

/**
 * Registra tentativas de envio feitas pela interface quando a função de envio
 * nem chega a responder (erro de rede, função indisponível, validação local).
 * Envios que chegam à função são registrados pelo próprio servidor.
 */
export async function logWhatsappAttempt(entry: WhatsappClientLog): Promise<void> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    await (supabase as any).from('whatsapp_message_logs').insert({
      company_id: entry.companyId,
      kind: entry.kind,
      recipient_name: entry.recipientName ?? null,
      recipient_phone: entry.recipientPhone,
      description: entry.description ?? null,
      amount: entry.amount ?? null,
      method: entry.method ?? null,
      success: entry.success,
      error_message: entry.errorMessage ?? null,
      created_by: userData?.user?.id ?? null,
    });
  } catch (err) {
    console.error('Falha ao registrar envio de WhatsApp:', err);
  }
}
