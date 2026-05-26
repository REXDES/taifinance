import { Badge } from '@/components/ui/badge';
import type { BureauAnalysis } from '@/hooks/useCreditModule';
import { Sparkles, TrendingUp, ShieldCheck, ShieldAlert, ShieldX, Info } from 'lucide-react';

const CONFIANCA_TONE: Record<string, string> = {
  muito_baixo: 'bg-destructive/15 text-destructive border-destructive/30',
  baixo: 'bg-destructive/10 text-destructive border-destructive/20',
  medio: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  alto: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  muito_alto: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
};
const SUGESTAO_ICON: Record<string, JSX.Element> = {
  recomendar: <ShieldCheck className="w-3 h-3 mr-1" />,
  recomendar_com_cautela: <ShieldAlert className="w-3 h-3 mr-1" />,
  nao_recomendar: <ShieldX className="w-3 h-3 mr-1" />,
};
const SUGESTAO_TONE: Record<string, string> = {
  recomendar: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  recomendar_com_cautela: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  nao_recomendar: 'bg-destructive/15 text-destructive border-destructive/30',
};

function fmtMoney(v: number | null) {
  if (v == null) return '—';
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

interface Props {
  analysis: BureauAnalysis | null | undefined;
  compact?: boolean;
}

export function BureauAnalysisCard({ analysis, compact }: Props) {
  if (!analysis) return null;
  const a = analysis;
  const hasAny =
    a.score_analise != null || a.limite_sugerido != null || a.max_parcelas != null ||
    a.parcela_maxima != null || a.nivel_de_confianca_label || a.sugestao_de_negocio_label ||
    a.descricao_rating || a.observacao_credito;
  if (!hasAny) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <div className="text-sm font-semibold">Análise do bureau</div>
        <span className="text-[10px] text-muted-foreground">Interpretação dos campos enviados pelo provedor</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {a.nivel_de_confianca_label && (
          <Badge variant="outline" className={CONFIANCA_TONE[a.nivel_de_confianca_bucket || ''] || ''}>
            Confiança: {a.nivel_de_confianca_label}
          </Badge>
        )}
        {a.sugestao_de_negocio_label && (
          <Badge variant="outline" className={SUGESTAO_TONE[a.sugestao_de_negocio_bucket || ''] || ''}>
            {a.sugestao_de_negocio_bucket && SUGESTAO_ICON[a.sugestao_de_negocio_bucket]}
            {a.sugestao_de_negocio_label}
          </Badge>
        )}
        {a.descricao_rating && (
          <Badge variant="outline" className="bg-muted/50">
            <TrendingUp className="w-3 h-3 mr-1" /> Rating: {a.descricao_rating}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <Cell label="Score analítico" value={a.score_analise != null ? String(a.score_analise) : '—'} />
        <Cell label="Limite sugerido" value={fmtMoney(a.limite_sugerido)} />
        <Cell label="Parcelas máx." value={a.max_parcelas != null ? `${a.max_parcelas}x` : '—'} />
        <Cell label="Parcela máxima" value={fmtMoney(a.parcela_maxima)} />
      </div>

      {!compact && a.observacao_credito && (
        <div className="rounded border-l-2 border-primary/60 bg-primary/5 px-3 py-2 text-xs">
          <div className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground mb-0.5">
            <Info className="w-3 h-3" /> Observação do bureau
          </div>
          <div>{a.observacao_credito}</div>
        </div>
      )}
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-muted/30 px-2 py-1.5">
      <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
      <div className="font-semibold break-words">{value}</div>
    </div>
  );
}
