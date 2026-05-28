import { Badge } from '@/components/ui/badge';
import { PAYMENT_BUCKET_LABEL, PAYMENT_BUCKET_HINT, toPaymentProbability } from '@/hooks/useCreditModule';

interface Props {
  probabilidadeInadimplencia?: number | null; // raw 1..9 (1=pior, 9=melhor)
  textoBucket?: string | null;                // muito_baixa..muito_alta (probabilidade de pagamento)
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

function colorClassForNumber(payment: number | null) {
  if (payment == null) return 'bg-muted text-muted-foreground border-border';
  if (payment >= 8) return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
  if (payment >= 6) return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20';
  if (payment >= 4) return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
  if (payment >= 2) return 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30';
  return 'bg-destructive/15 text-destructive border-destructive/30';
}

export function PaymentProbabilityBadge({ probabilidadeInadimplencia, textoBucket, compact }: Props) {
  const payment = toPaymentProbability(probabilidadeInadimplencia);
  const bucketLabel = textoBucket ? PAYMENT_BUCKET_LABEL[textoBucket] : null;
  const bucketHint = textoBucket ? PAYMENT_BUCKET_HINT[textoBucket] : null;

  if (payment == null && !bucketLabel) return null;

  if (compact) {
    return (
      <div className="inline-flex items-center gap-1">
        {payment != null && (
          <Badge variant="outline" className={`${colorClassForNumber(payment)} text-[10px] px-1.5 py-0`}
            title={`Probabilidade de pagamento: ${payment}/9`}>
            Pag. {payment}/9
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
      {payment != null && (
        <Badge variant="outline" className={colorClassForNumber(payment)}
          title={`Escala 1 (pior) a 9 (melhor)`}>
          Prob. pagamento: <span className="ml-1 font-bold">{payment}/9</span>
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
