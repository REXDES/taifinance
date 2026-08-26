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
  desconhecido: 'bg-muted text-muted-foreground border-border',
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
  const breakdown = a.score_breakdown || null;
  const hasAny =
    a.score_analise != null || a.limite_sugerido != null || a.max_parcelas != null ||
    a.parcela_maxima != null || a.nivel_de_confianca_label || a.sugestao_de_negocio_label ||
    a.descricao_rating || a.observacao_credito || breakdown;
  if (!hasAny) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <div className="text-sm font-semibold">Análise do bureau</div>
        <span className="text-[10px] text-muted-foreground">Interpretação dos campos enviados pelo provedor</span>
      </div>

      {breakdown && (breakdown.score != null || breakdown.score_analise != null || breakdown.score_rating != null || (breakdown.components?.length ?? 0) > 0) && (
        <div className="rounded border border-primary/30 bg-primary/5 p-2 space-y-2">
          <div className="text-[10px] uppercase text-muted-foreground">Composição do score (média ponderada)</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <Cell label="Score" value={breakdown.score != null ? String(breakdown.score) : '—'} />
            <Cell label="Score análise" value={breakdown.score_analise != null ? String(breakdown.score_analise) : '—'} />
            <Cell label="Score rating" value={breakdown.score_rating != null ? String(breakdown.score_rating) : '—'} />
            <div className="rounded border border-primary/40 bg-primary/10 px-2 py-1.5">
              <div className="text-[10px] text-muted-foreground uppercase">Score final (usado na régua)</div>
              <div className="font-bold text-primary text-base">{breakdown.media != null ? breakdown.media : '—'}</div>
            </div>
          </div>

          {(breakdown.components?.length ?? 0) > 0 && (
            <div className="space-y-1">
              {breakdown.components!.map((c) => (
                <div key={c.key} className="flex items-center gap-2 text-[11px]">
                  <div className="w-40 shrink-0 truncate" title={c.label}>{c.label}</div>
                  <div className="w-14 shrink-0 text-muted-foreground truncate" title={c.raw || ''}>{c.raw ?? '—'}</div>
                  <div className="flex-1 h-2 rounded bg-muted overflow-hidden">
                    <div className="h-full bg-primary/70" style={{ width: `${Math.max(0, Math.min(100, c.normalized))}%` }} />
                  </div>
                  <div className="w-10 text-right">{c.normalized}</div>
                  <div className="w-14 text-right text-muted-foreground">peso {c.effective_weight}%</div>
                </div>
              ))}
              {(breakdown.missing?.length ?? 0) > 0 && (
                <div className="text-[10px] text-muted-foreground pt-1">
                  Sem informação (peso redistribuído): {breakdown.missing!.join(', ')}
                </div>
              )}
            </div>
          )}

          {(breakdown.blocks?.length ?? 0) > 0 && (
            <div className="space-y-2 pt-1 border-t border-primary/20 mt-2">
              <div className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" /> Blocos da postura de análise
                {breakdown.analysis_stance && (
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground normal-case">
                    {breakdown.analysis_stance === 'atual' ? 'Foco atual' : breakdown.analysis_stance === 'pregressa' ? 'Foco pregressa' : breakdown.analysis_stance === 'balanceado' ? 'Balanceado' : 'Personalizado'} ({breakdown.stance_current_weight ?? 50}/{100 - (breakdown.stance_current_weight ?? 50)})
                  </span>
                )}
                {breakdown.adverse_history && (
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 normal-case">Histórico adverso</span>
                )}
                {breakdown.rating_confidence != null && (
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground normal-case">Confiança rating: {breakdown.rating_confidence}</span>
                )}
              </div>
              {breakdown.blocks!.map((blk) => {
                const isCurrent = blk.key === 'current';
                const tone = isCurrent ? 'bg-sky-500/70' : 'bg-violet-500/70';
                const bg = isCurrent ? 'bg-sky-500/10 border-sky-500/30' : 'bg-violet-500/10 border-violet-500/30';
                return (
                  <div key={blk.key} className={`rounded border ${bg} px-2 py-1.5`}>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium">{blk.label}</span>
                      <span className="text-muted-foreground">peso {blk.weight}% · contribuição {blk.contribution}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-2.5 rounded bg-muted overflow-hidden">
                        <div className={`h-full ${tone}`} style={{ width: `${Math.max(0, Math.min(100, blk.points))}%` }} />
                      </div>
                      <div className="w-8 text-right text-[11px] font-semibold">{blk.points}</div>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[10px] text-muted-foreground">
                      {(blk.components || []).map((c) => (
                        <span key={c.key} title={`${c.label}: ${c.raw ?? '—'} → ${c.normalized}/100 (peso ${c.effective_weight}%)`}>
                          {c.label.split(' ')[0]}: <span className="text-foreground/80">{c.normalized}</span> <span className="opacity-60">({c.effective_weight}%)</span>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {a.nivel_de_confianca_label && (
          <Badge variant="outline" className={CONFIANCA_TONE[a.nivel_de_confianca_bucket || ''] || ''}>
            Confiança: {a.nivel_de_confianca_label}
          </Badge>
        )}
        {a.sugestao_de_negocio_label && (
          <Badge variant="outline" className={SUGESTAO_TONE[a.sugestao_de_negocio_bucket || ''] || 'bg-muted'}>
            {a.sugestao_de_negocio_bucket && SUGESTAO_ICON[a.sugestao_de_negocio_bucket]}
            {a.sugestao_de_negocio_label}
          </Badge>
        )}
        {a.descricao_rating && (
          <Badge variant="outline" className="bg-muted/50">
            <TrendingUp className="w-3 h-3 mr-1" /> Rating: {a.descricao_rating}
          </Badge>
        )}
        {a.classificacao_score_letra && (
          <Badge variant="outline" className="bg-muted/50">Classificação: {a.classificacao_score_letra}</Badge>
        )}
        {a.faturas_em_atraso_letra && (
          <Badge variant="outline" className="bg-muted/50">Faturas em atraso: {a.faturas_em_atraso_letra}</Badge>
        )}
        {a.contratos_recentes_letra && (
          <Badge variant="outline" className="bg-muted/50">Contratos recentes: {a.contratos_recentes_letra}</Badge>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <Cell label="Score analítico" value={a.score_analise != null ? String(a.score_analise) : '—'} />
        <Cell label="Limite sugerido" value={fmtMoney(a.limite_sugerido)} />
        <Cell label="Parcelas máx." value={a.max_parcelas != null ? `${a.max_parcelas}x` : '—'} />
        <Cell label="Parcela máxima" value={fmtMoney(a.parcela_maxima)} />
      </div>

      {!compact && a.sugestao_de_negocio_raw && (
        <div className="rounded border-l-2 border-primary/40 bg-muted/30 px-3 py-2 text-xs">
          <div className="text-[10px] uppercase text-muted-foreground mb-0.5">Sugestão de negócio (texto original)</div>
          <div className="italic">"{a.sugestao_de_negocio_raw}"</div>
        </div>
      )}

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
