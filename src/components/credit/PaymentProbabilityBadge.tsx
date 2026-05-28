import { Badge } from '@/components/ui/badge';
import { PAYMENT_BUCKET_LABEL, PAYMENT_BUCKET_HINT, toPaymentProbability } from '@/hooks/useCreditModule';

interface Props {
  /** Valor cru de probabilidade de INADIMPLÊNCIA vindo do bureau (1..100, % de risco). */
  probabilidadeInadimplencia?: number | null;
  textoBucket?: string | null;
  compact?: boolean;
}

function colorClassForBucket(bucket: string | null | undefined) {
  switch (bucket) {
    case 'muito_alta': return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
    case 'alta':      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20';
    case 'media':     return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
    case 'baixa':     return 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30';
    case 'muito_baixa': return 'bg-destructive/15 text-destructive border-destructive/30';
    default: return 'bg-muted text-muted-foreground border-border';
  }
}

// Quanto MAIOR a inadimplência (risco), PIOR — vermelho.
function colorClassForRisk(risk: number | null) {
  if (risk == null) return 'bg-muted text-muted-foreground border-border';
  if (risk <= 10) return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
  if (risk <= 25) return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20';
  if (risk <= 50) return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
  if (risk <= 75) return 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30';
  return 'bg-destructive/15 text-destructive border-destructive/30';
}

export function PaymentProbabilityBadge({ probabilidadeInadimplencia, textoBucket, compact }: Props) {
  const risk = (probabilidadeInadimplencia == null || !Number.isFinite(Number(probabilidadeInadimplencia)))
    ? null
    : Math.max(0, Math.min(100, Math.round(Number(probabilidadeInadimplencia))));
  const payment = toPaymentProbability(probabilidadeInadimplencia);
  const bucketLabel = textoBucket ? PAYMENT_BUCKET_LABEL[textoBucket] : null;
  const bucketHint = textoBucket ? PAYMENT_BUCKET_HINT[textoBucket] : null;

  if (risk == null && !bucketLabel) return null;

  if (compact) {
    return (
      <div className="inline-flex items-center gap-1">
        {risk != null && (
          <Badge variant="outline" className={`${colorClassForRisk(risk)} text-[10px] px-1.5 py-0`}
            title={`Risco de inadimplência: ${risk}% (probabilidade de pagamento ${payment}%)`}>
            Risco {risk}%
          </Badge>
        )}
        {bucketLabel && (
          <Badge variant="outline" className={`${colorClassForBucket(textoBucket)} text-[10px] px-1.5 py-0`}
            title={`Texto do score: ${bucketLabel} probabilidade de pagamento (${bucketHint})`}>
            {bucketLabel}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2">
      {risk != null && (
        <Badge variant="outline" className={colorClassForRisk(risk)}
          title={`Escala 1% (melhor) a 100% (pior)`}>
          Risco inadimplência: <span className="ml-1 font-bold">{risk}%</span>
          {payment != null && <span className="ml-2 text-[10px] opacity-80">(pagam {payment}%)</span>}
        </Badge>
      )}
      {bucketLabel && (
        <Badge variant="outline" className={colorClassForBucket(textoBucket)}
          title={`Texto interpretativo do score (${bucketHint})`}>
          Texto: {bucketLabel}
        </Badge>
      )}
    </div>
  );
}
