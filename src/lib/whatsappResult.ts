export function whatsappAccepted(data: any): boolean {
  return (data?.ok === true || data?.success === true)
    && typeof data?.data?.messages?.[0]?.id === 'string'
    && data.data.messages[0].id.length > 0;
}

export async function whatsappFailure(data: any, error: any): Promise<string> {
  let details = data;
  if (error?.context instanceof Response) {
    try { details = await error.context.clone().json(); } catch { /* use existing details */ }
  }
  const providerError = details?.data?.error ?? details?.details?.error;
  if (providerError?.code === 131047) {
    return 'A janela de 24 horas do WhatsApp expirou. O cliente precisa responder ao número remetente ou o envio deve usar um modelo aprovado pela Meta.';
  }
  return providerError?.message || details?.error || error?.message || 'O WhatsApp não confirmou a aceitação da mensagem.';
}