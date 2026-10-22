/**
 * Regra do usuário: preço de venda = compra × (1 + margem%) + compra × recuperação%.
 * Portanto lance máximo = preço de tabela ÷ (1 + margem% + recuperação%).
 */
export function maxBid(referencePrice: number, marginPct: number, recoveryPct: number): number {
  const f = 1 + marginPct / 100 + recoveryPct / 100;
  return f > 0 ? +(referencePrice / f).toFixed(2) : 0;
}

export function requiredSalePrice(purchase: number, marginPct: number, recoveryPct: number): number {
  return +(purchase * (1 + marginPct / 100) + purchase * (recoveryPct / 100)).toFixed(2);
}

/** Na venda real, a recuperação é o custo lançado (peças + manutenções). */
export function suggestedSalePrice(purchase: number, recoveryCosts: number, marginPct: number): number {
  return +(purchase * (1 + marginPct / 100) + recoveryCosts).toFixed(2);
}

export function realMarginPct(salePrice: number, totalCost: number): number {
  return totalCost > 0 ? +(((salePrice - totalCost) / totalCost) * 100).toFixed(2) : 0;
}

export type BidVerdict = 'opportunity' | 'limit' | 'out';
/** Até 95% do máximo = oportunidade; até 100% = no limite. */
export function verdict(bid: number, max: number): BidVerdict {
  if (bid <= max * 0.95) return 'opportunity';
  if (bid <= max) return 'limit';
  return 'out';
}

export function median(values: number[]): number {
  const v = values.filter((n) => n > 0).sort((a, b) => a - b);
  if (!v.length) return 0;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : +((v[m - 1] + v[m]) / 2).toFixed(2);
}
