/**
 * Taxa da plataforma (Pagando) na antecipação, para prévia na tela.
 * Mesma regra de public.ra_quote (migração 0020), que é quem vale: só há taxa
 * com conta de destino configurada; arredondada em centavos.
 */
export function platformFee(
  settings: {
    platform_fee_percent?: number | string | null;
    platform_fee_fixed?: number | string | null;
    platform_fee_recipient_type?: string | null;
    platform_fee_recipient_id?: string | null;
  } | null | undefined,
  face: number,
): number {
  if (!settings) return 0;
  const pct = Number(settings.platform_fee_percent || 0);
  const fixed = Number(settings.platform_fee_fixed || 0);
  const hasRecipient = settings.platform_fee_recipient_type === 'MARKETPLACE' || !!settings.platform_fee_recipient_id;
  if (!hasRecipient || (pct <= 0 && fixed <= 0)) return 0;
  return Math.round((face * pct / 100 + fixed) * 100) / 100;
}
