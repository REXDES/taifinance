import { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, MinusCircle, ShieldCheck, Clock, Loader2 } from 'lucide-react';
import type { CreditRules, BureauAnalysis, LetraAE } from '@/hooks/useCreditModule';
import { CONFIANCA_OPTIONS, SUGESTAO_OPTIONS, LETRA_LABEL } from '@/hooks/useCreditModule';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

type Status = 'pass' | 'fail' | 'na';
type Row = {
  criterion: string;
  label: string;
  actual: string;
  limit: string;
  status: Status;
  note?: string;
};

const LETRA_RANK: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5 };

/** Interpreta uma letra A-E de um raw como "AA", "BC", "C1"; retorna a letra e se foi interpretada. */
function interpretLetra(raw: any): { letter: string | null; interpreted: boolean; raw: string } {
  const s = String(raw ?? '').trim().toUpperCase();
  if (!s) return { letter: null, interpreted: false, raw: '' };
  const m = s.match(/[A-E]/);
  if (!m) return { letter: null, interpreted: false, raw: s };
  return { letter: m[0], interpreted: s !== m[0], raw: s };
}

const CONFIANCA_LABEL = Object.fromEntries(CONFIANCA_OPTIONS.map((o) => [o.value, o.label]));
const SUGESTAO_LABEL = Object.fromEntries(SUGESTAO_OPTIONS.map((o) => [o.value, o.label]));

function toInt(v: any): number {
  const n = parseInt(String(v ?? '').replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}
function toNum(v: any): number | null {
  if (v == null) return null;
  const s = String(v).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

interface OverrideRow {
  id: string;
  criterion: string;
  status: 'pending' | 'approved' | 'rejected';
  request_reason: string | null;
  decision_notes: string | null;
}

export function EngineChecklist({
  summary,
  bureau,
  rules,
  tipoDocumento,
  applicationId,
  companyId,
  userId,
  canApprove,
  onChanged,
}: {
  summary: Record<string, any>;
  bureau: BureauAnalysis | null | undefined;
  rules: CreditRules | null;
  tipoDocumento: 'CPF' | 'CNPJ';
  applicationId?: string;
  companyId?: string;
  userId?: string | null;
  canApprove?: boolean;
  onChanged?: () => void;
}) {
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [dialog, setDialog] = useState<null | { row: Row; mode: 'request' | 'decide'; existing?: OverrideRow }>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const refetch = useCallback(async () => {
    if (!applicationId) return;
    const { data } = await (supabase as any)
      .from('credit_overridden_criteria')
      .select('id, criterion, status, request_reason, decision_notes')
      .eq('application_id', applicationId);
    setOverrides((data || []) as OverrideRow[]);
  }, [applicationId]);

  useEffect(() => { refetch(); }, [refetch]);

  if (!rules) return null;

  const rows: Row[] = [];

  // Quantitative knockouts
  const protestos = toInt(summary.quantidade_protestos);
  rows.push({
    criterion: 'protestos',
    label: 'Protestos',
    actual: String(protestos),
    limit: `máx ${rules.max_protestos}`,
    status: protestos > rules.max_protestos ? 'fail' : 'pass',
  });
  const pend = toInt(summary.quantidade_pendencias_financeiras);
  rows.push({
    criterion: 'pendencias_financeiras',
    label: 'Pendências financeiras',
    actual: String(pend),
    limit: `máx ${rules.max_pendencias_financeiras}`,
    status: pend > rules.max_pendencias_financeiras ? 'fail' : 'pass',
  });
  const ccf = toInt(summary.quantidade_ccf_bacen) + toInt(summary.quantidade_ccf_varejo);
  rows.push({
    criterion: 'ccf',
    label: 'Cheques sem fundo (CCF)',
    actual: String(ccf),
    limit: `máx ${rules.max_ccf_total}`,
    status: ccf > rules.max_ccf_total ? 'fail' : 'pass',
  });
  const alertas = toInt(summary.quantidade_alertas_restricoes);
  rows.push({
    criterion: 'alertas_restricoes',
    label: 'Alertas de restrição',
    actual: String(alertas),
    limit: `máx ${rules.max_alertas_restricoes}`,
    status: alertas > rules.max_alertas_restricoes ? 'fail' : 'pass',
  });

  if (rules.bolsa_familia_block) {
    const dep = toInt(summary.qtd_dependentes_bolsa_familia);
    rows.push({
      criterion: 'bolsa_familia',
      label: 'Bolsa Família (dependentes)',
      actual: String(dep),
      limit: `máx ${rules.max_dependentes_bolsa_familia ?? 0}`,
      status: dep > (rules.max_dependentes_bolsa_familia ?? 0) ? 'fail' : 'pass',
    });
  }

  const probRaw = toNum(summary.probabilidade_inadimplencia);
  const prob = probRaw != null ? Math.max(0, Math.min(100, Math.round(probRaw))) : null;
  const maxRisk = rules.max_probabilidade_inadimplencia ?? 100;
  rows.push({
    criterion: 'probabilidade_inadimplencia',
    label: 'Risco de inadimplência',
    actual: prob != null ? `${prob}%` : '—',
    limit: `máx ${maxRisk}%`,
    status: prob == null ? 'na' : prob > maxRisk ? 'fail' : 'pass',
    note: prob != null ? `${100 - prob}% pagam` : undefined,
  });

  const scoreAnal = toNum(summary.score_analise);
  if ((rules.min_score_analise ?? 0) > 0) {
    const analiseMode = rules.score_analise_mode === 'bloquear' ? 'bloquear' : 'pontuar';
    const below = scoreAnal != null && scoreAnal < (rules.min_score_analise ?? 0);
    rows.push({
      criterion: 'score_analise',
      label: 'Score analítico (bureau)',
      actual: scoreAnal != null ? String(scoreAnal) : '—',
      limit: `mín ${rules.min_score_analise} (${analiseMode === 'bloquear' ? 'bloqueia' : 'pontua'})`,
      status: analiseMode === 'bloquear'
        ? (scoreAnal == null ? 'na' : below ? 'fail' : 'pass')
        : (scoreAnal == null ? 'na' : below ? 'na' : 'pass'),
      note: analiseMode === 'pontuar' && below
        ? 'Abaixo do mínimo — pontua no score, não bloqueia (pode ir a análise manual)'
        : undefined,
    });
  }

  const confBucket = bureau?.nivel_de_confianca_bucket || null;
  const confRaw = (bureau as any)?.nivel_de_confianca_raw || null;
  const blockConf = rules.min_nivel_confianca_levels || [];
  if (blockConf.length > 0) {
    let actual: string;
    if (confBucket) {
      const label = CONFIANCA_LABEL[confBucket] || confBucket;
      const isInterpreted = confRaw && String(confRaw).trim().toLowerCase() !== label.toLowerCase();
      actual = isInterpreted ? `Interpretado como ${label} (original: ${confRaw})` : label;
    } else if (confRaw) {
      actual = `Não associado (original: ${confRaw})`;
    } else {
      actual = '—';
    }
    rows.push({
      criterion: 'nivel_de_confianca',
      label: 'Nível de confiança',
      actual,
      limit: `bloqueia: ${blockConf.map((b) => CONFIANCA_LABEL[b] || b).join(', ')}`,
      status: !confBucket ? 'na' : blockConf.includes(confBucket) ? 'fail' : 'pass',
    });
  }

  const sugBucket = bureau?.sugestao_de_negocio_bucket || null;
  const sugRaw = bureau?.sugestao_de_negocio_raw || null;
  const blockSug = Array.from(new Set([
    ...(rules.sugestao_negocio_block_levels || []),
    ...(rules.sugestao_negocio_block_buckets || []),
  ]));
  let sugActual: string;
  if (sugBucket) {
    const label = SUGESTAO_LABEL[sugBucket] || sugBucket;
    const isInterpreted = sugRaw && String(sugRaw).trim().toLowerCase() !== label.toLowerCase();
    sugActual = isInterpreted ? `Interpretado como ${label} (original: ${sugRaw})` : label;
  } else if (sugRaw) {
    sugActual = `Não associado (original: ${sugRaw})`;
  } else {
    sugActual = '—';
  }
  rows.push({
    criterion: 'sugestao_negocio',
    label: 'Sugestão de negócio',
    actual: sugActual,
    limit: blockSug.length ? `bloqueia: ${blockSug.map((b) => SUGESTAO_LABEL[b] || b).join(', ')}` : '—',
    status: !sugBucket || blockSug.length === 0 ? 'na' : blockSug.includes(sugBucket) ? 'fail' : 'pass',
  });

  const evalLetra = (criterion: string, label: string, rawValue: string | null | undefined, maxLetra: LetraAE | undefined, kind: 'classificacao' | 'faturas' | 'contratos') => {
    if (!maxLetra) return;
    const { letter, interpreted, raw } = interpretLetra(rawValue);
    const r = letter ? LETRA_RANK[letter] : undefined;
    const max = LETRA_RANK[maxLetra];
    const maxLabel = LETRA_LABEL[maxLetra]?.[kind] || maxLetra;
    let actual: string;
    if (letter) {
      const baseLabel = LETRA_LABEL[letter]?.[kind] || letter;
      actual = interpreted ? `Interpretado como ${baseLabel} (original: ${raw})` : baseLabel;
    } else if (raw) {
      actual = `Não associado (original: ${raw})`;
    } else {
      actual = '—';
    }
    rows.push({
      criterion,
      label,
      actual,
      limit: `máx ${maxLabel}`,
      status: !r ? 'na' : r > max ? 'fail' : 'pass',
    });
  };
  evalLetra('classificacao_score', 'Classificação do score', (bureau as any)?.classificacao_score_raw || bureau?.classificacao_score_letra || summary.classificacao_score, rules.max_classificacao_score, 'classificacao');
  evalLetra('faturas_em_atraso', 'Faturas em atraso', bureau?.faturas_em_atraso_raw || bureau?.faturas_em_atraso_letra || summary.faturas_em_atraso, rules.max_faturas_em_atraso, 'faturas');
  evalLetra('contratos_recentes', 'Contratos recentes', bureau?.contratos_recentes_raw || bureau?.contratos_recentes_letra || summary.contratos_recentes, rules.max_contratos_recentes, 'contratos');

  // Faixa de score (régua score_bands) — knockout final quando a média cai em faixa "rejected"
  const scoreMedia = bureau?.score_breakdown?.media ?? bureau?.score_breakdown?.score ?? toNum(summary.score) ?? null;
  const bands = rules.score_bands || [];
  const matchingBand = scoreMedia != null
    ? bands.find((b) => scoreMedia >= b.min_score && scoreMedia <= b.max_score)
    : null;
  const minApprovable = bands
    .filter((b) => b.decision !== 'rejected')
    .sort((a, b) => a.min_score - b.min_score)[0];
  const bandStatus: Status = scoreMedia == null
    ? 'na'
    : (!matchingBand || matchingBand.decision === 'rejected') ? 'fail' : 'pass';
  rows.push({
    criterion: 'score_band',
    label: 'Faixa de score (régua)',
    actual: scoreMedia != null ? `${scoreMedia} pts` : '—',
    limit: minApprovable ? `mín ${minApprovable.min_score} pts` : 'sem faixa aprovável',
    status: bandStatus,
    note: matchingBand ? `faixa ${matchingBand.min_score}-${matchingBand.max_score} → ${matchingBand.decision}` : undefined,
  });

  const overrideByCriterion: Record<string, OverrideRow> = {};
  for (const o of overrides) overrideByCriterion[o.criterion] = o;

  const fails = rows.filter((r) => r.status === 'fail').length;
  const passes = rows.filter((r) => r.status === 'pass').length;
  const approvedOverrides = overrides.filter((o) => o.status === 'approved').length;

  const openRequest = (row: Row) => {
    const existing = overrideByCriterion[row.criterion];
    setDialog({ row, mode: existing && existing.status === 'pending' ? 'decide' : 'request', existing });
    setReason('');
  };

  const submitRequest = async () => {
    if (!dialog || !applicationId || !companyId || !userId) return;
    if (!reason.trim()) { toast.error('Informe a justificativa'); return; }
    setBusy(true);
    const payload = {
      company_id: companyId,
      application_id: applicationId,
      criterion: dialog.row.criterion,
      criterion_label: dialog.row.label,
      actual_value: dialog.row.actual,
      limit_value: dialog.row.limit,
      request_reason: reason.trim(),
      status: 'pending',
      requested_by: userId,
    };
    const { error } = await (supabase as any).from('credit_overridden_criteria').insert(payload);
    setBusy(false);
    if (error) { toast.error('Erro ao solicitar alçada: ' + error.message); return; }
    toast.success('Alçada solicitada. Aguardando aprovação.');
    setDialog(null);
    await refetch();
    onChanged?.();
  };

  const decide = async (status: 'approved' | 'rejected') => {
    if (!dialog?.existing || !userId) return;
    setBusy(true);
    const { error } = await (supabase as any)
      .from('credit_overridden_criteria')
      .update({
        status,
        decided_by: userId,
        decided_at: new Date().toISOString(),
        decision_notes: reason.trim() || null,
      })
      .eq('id', dialog.existing.id);
    setBusy(false);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success(status === 'approved' ? 'Critério liberado. Reavalie a proposta.' : 'Solicitação rejeitada.');
    setDialog(null);
    await refetch();
    onChanged?.();
  };

  const revoke = async (id: string) => {
    setBusy(true);
    const { error } = await (supabase as any).from('credit_overridden_criteria').delete().eq('id', id);
    setBusy(false);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Liberação revogada.');
    await refetch();
    onChanged?.();
  };

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="text-sm font-semibold">Análise completa</div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" /> {passes} ok
          </span>
          <span className="flex items-center gap-1 text-destructive">
            <XCircle className="w-3.5 h-3.5" /> {fails} falha(s)
          </span>
          {approvedOverrides > 0 && (
            <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300">
              <ShieldCheck className="w-3.5 h-3.5" /> {approvedOverrides} alçada(s)
            </span>
          )}
        </div>
      </div>
      <ul className="divide-y">
        {rows.map((r) => {
          const ov = overrideByCriterion[r.criterion];
          const isOverridden = ov?.status === 'approved';
          const isPending = ov?.status === 'pending';
          const effectiveStatus: Status = isOverridden && r.status === 'fail' ? 'pass' : r.status;
          return (
            <li key={r.criterion} className="flex items-start gap-3 px-3 py-2 text-xs">
              <div className="mt-0.5">
                {effectiveStatus === 'pass' && !isOverridden && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                {effectiveStatus === 'pass' && isOverridden && <ShieldCheck className="w-4 h-4 text-amber-600" />}
                {effectiveStatus === 'fail' && <XCircle className="w-4 h-4 text-destructive" />}
                {effectiveStatus === 'na' && <MinusCircle className="w-4 h-4 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground flex items-center gap-2 flex-wrap">
                  {r.label}
                  {isOverridden && (
                    <span className="text-[10px] uppercase font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/40 rounded px-1.5 py-0.5">
                      Alçada aprovada
                    </span>
                  )}
                  {isPending && (
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground bg-muted rounded px-1.5 py-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Alçada pendente
                    </span>
                  )}
                </div>
                <div className="text-muted-foreground">
                  Atual: <span className="text-foreground">{r.actual}</span>
                  {r.note ? <span className="ml-2">({r.note})</span> : null}
                </div>
                {ov?.request_reason && (
                  <div className="text-muted-foreground mt-0.5 italic">Justificativa: {ov.request_reason}</div>
                )}
              </div>
              <div className="text-right text-muted-foreground whitespace-nowrap flex flex-col items-end gap-1">
                <span>{r.limit}</span>
                {applicationId && r.status === 'fail' && !isOverridden && !isPending && (
                  <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => openRequest(r)}>
                    Solicitar alçada
                  </Button>
                )}
                {isPending && canApprove && (
                  <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => openRequest(r)}>
                    Aprovar/Rejeitar
                  </Button>
                )}
                {isOverridden && canApprove && (
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] text-destructive hover:text-destructive" onClick={() => revoke(ov.id)} disabled={busy}>
                    Revogar
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === 'decide' ? 'Decidir alçada' : 'Solicitar alçada'}
            </DialogTitle>
            <DialogDescription>
              Critério: <strong>{dialog?.row.label}</strong> — atual {dialog?.row.actual}, {dialog?.row.limit}.
              {dialog?.mode === 'decide'
                ? ' Aprovando, este critério será ignorado nesta proposta na próxima reavaliação.'
                : ' Um gerente/supervisor poderá liberar este critério apenas para esta proposta.'}
            </DialogDescription>
          </DialogHeader>
          {dialog?.existing?.request_reason && (
            <div className="text-xs bg-muted rounded p-2">
              <div className="font-semibold mb-1">Justificativa solicitada:</div>
              {dialog.existing.request_reason}
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-xs">
              {dialog?.mode === 'decide' ? 'Observação da decisão (opcional)' : 'Justificativa *'}
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder={dialog?.mode === 'decide' ? 'Ex.: cliente apresentou comprovantes...' : 'Explique por que este critério deve ser liberado nesta proposta'}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialog(null)} disabled={busy}>Cancelar</Button>
            {dialog?.mode === 'decide' ? (
              <>
                <Button variant="destructive" onClick={() => decide('rejected')} disabled={busy}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Rejeitar'}
                </Button>
                <Button onClick={() => decide('approved')} disabled={busy}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aprovar alçada'}
                </Button>
              </>
            ) : (
              <Button onClick={submitRequest} disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar solicitação'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
