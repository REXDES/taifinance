import { useState, useEffect, useCallback } from 'react';
import { useCreditApplications, consultCredit, useCreditRules, type ConsultResult, type CreditApplication } from '@/hooks/useCreditModule';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Search, ShieldCheck, ShieldAlert, ShieldX, ArrowRight, Eye, AlertTriangle, Gavel, RefreshCw, Clock, CheckCircle2, XCircle, FileSearch, Download } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  extractOccurrences,
  buildOccurrenceKey,
  pickTitulo,
  pickDescricao,
  PRIORITY_FIELDS,
  type OccurrenceRecord,
} from '@/lib/creditOccurrences';
import { JourneyStepper } from './JourneyStepper';
import { HorizontalTimeline } from './HorizontalTimeline';
import { QualificationStep } from './steps/QualificationStep';
import { BiometryStep } from './steps/BiometryStep';
import { SimulationStep } from './steps/SimulationStep';
import { ContractStep } from './steps/ContractStep';
import { BoletosStep } from './steps/BoletosStep';
import { PaymentProbabilityBadge } from './PaymentProbabilityBadge';
import { BureauAnalysisCard } from './BureauAnalysisCard';
import { EngineChecklist } from './EngineChecklist';

interface Props { companyId: string }

// Etapas na ordem da jornada — simulação vem antes de qualificação/biometria
// (cliente pode não aceitar as condições antes de coletar dados pessoais)
const STEP_LABELS = ['Consulta', 'Simulação', 'Qualificação', 'Biometria', 'Contrato', 'Boletos'];

function StatusBadge({ status, decision }: { status: string; decision: string | null }) {
  if (decision === 'rejected' || status === 'rejected')
    return <Badge className="bg-destructive/15 text-destructive border-destructive/30"><ShieldX className="w-3 h-3 mr-1" />Recusado</Badge>;
  if (decision === 'manual')
    return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"><ShieldAlert className="w-3 h-3 mr-1" />Análise</Badge>;
  if (status === 'contracted')
    return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"><ShieldCheck className="w-3 h-3 mr-1" />Contratado</Badge>;
  if (decision === 'approved')
    return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"><ShieldCheck className="w-3 h-3 mr-1" />Aprovado</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function ApprovalSourceBadge({ decision, hasAlcada }: { decision: string | null; hasAlcada: boolean }) {
  if (decision !== 'approved' && decision !== 'manual') return null;
  if (hasAlcada) {
    return (
      <Badge className="bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30" title="Aprovação envolveu liberação por alçada">
        <Gavel className="w-3 h-3 mr-1" />Aprovação por alçada
      </Badge>
    );
  }
  return (
    <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30" title="Decisão tomada automaticamente pelas regras do motor">
      <ShieldCheck className="w-3 h-3 mr-1" />Aprovação automática
    </Badge>
  );
}

export function CreditApplicationsPage({ companyId }: Props) {
  const { applications, loading, refetch } = useCreditApplications(companyId);
  const { user } = useAuth();
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newDoc, setNewDoc] = useState('');
  const [consultResult, setConsultResult] = useState<ConsultResult | null>(null);
  const [createdAppId, setCreatedAppId] = useState<string | null>(null);
  const [detailApp, setDetailApp] = useState<CreditApplication | null>(null);
  const [detailInitialStep, setDetailInitialStep] = useState<number | null>(null);
  const [reevaluatingId, setReevaluatingId] = useState<string | null>(null);

  const handleStartNew = async () => {
    const docDigits = newDoc.replace(/\D/g, '');
    if (docDigits.length !== 11 && docDigits.length !== 14) {
      toast.error('Informe CPF (11 dígitos) ou CNPJ (14 dígitos)');
      return;
    }
    setCreating(true);
    try {
      const tipo = docDigits.length === 11 ? 'CPF' : 'CNPJ';
      const { data: appRow, error: appErr } = await (supabase as any)
        .from('credit_applications')
        .insert({
          company_id: companyId,
          documento: docDigits,
          tipo_documento: tipo,
          current_step: 1,
          status: 'draft',
          created_by: user?.id,
        })
        .select()
        .single();
      if (appErr) throw appErr;
      setCreatedAppId(appRow.id);

      const r = await consultCredit({ documento: docDigits, company_id: companyId, application_id: appRow.id });
      setConsultResult(r);
      await refetch();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao iniciar proposta');
    } finally {
      setCreating(false);
    }
  };

  const reset = () => {
    setShowNew(false);
    setNewDoc('');
    setConsultResult(null);
    setCreatedAppId(null);
  };

  const handleReevaluate = async (a: CreditApplication, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setReevaluatingId(a.id);
    try {
      // Reaproveita a última consulta ao bureau (sem custo) e aplica ocorrências ignoradas.
      const r = await consultCredit({ documento: a.documento, company_id: companyId, application_id: a.id, reuse_last: true });
      const { data: refreshedApp } = await (supabase as any)
        .from('credit_applications')
        .select('*')
        .eq('id', a.id)
        .maybeSingle();

      if (refreshedApp) {
        setDetailApp((current) => current?.id === a.id ? (refreshedApp as CreditApplication) : current);
      } else {
        setDetailApp((current) => {
          if (!current || current.id !== a.id) return current;
          return {
            ...current,
            nome: r.nome || current.nome,
            score: r.engine.score,
            classification: r.engine.classification,
            approved_limit: r.engine.approved_limit,
            decision: r.engine.decision,
            decision_reason: r.engine.reason,
            status: r.engine.decision === 'rejected' ? 'rejected' : 'consulted',
            current_step: r.engine.decision === 'rejected' ? 1 : Math.max(current.current_step || 1, 2),
            probabilidade_inadimplencia: r.probabilidade_inadimplencia ?? current.probabilidade_inadimplencia,
            texto_score_bucket: r.texto_score_bucket ?? current.texto_score_bucket,
            bureau_analysis: r.bureau_analysis ?? current.bureau_analysis,
          };
        });
      }

      toast.success(
        r.engine.decision === 'approved' ? 'Reavaliada: aprovada' :
        r.engine.decision === 'manual' ? 'Reavaliada: análise manual' :
        'Reavaliada: ainda recusada'
      );
      await refetch();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao reavaliar');
    } finally {
      setReevaluatingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestão de Crédito</h1>
          <p className="text-sm text-muted-foreground">Propostas de venda a prazo com consulta bureau, biometria e contrato digital.</p>
        </div>
        {!showNew && (
          <Button onClick={() => setShowNew(true)}><Plus className="w-4 h-4 mr-2" /> Nova proposta</Button>
        )}
      </div>

      {showNew && (
        <Card>
          <CardHeader>
            <CardTitle>Nova proposta — Etapa 1: Consulta</CardTitle>
            <CardDescription>Informe o CPF/CNPJ do cliente para iniciar a análise de crédito.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!consultResult ? (
              <div className="flex gap-2">
                <Input
                  value={newDoc}
                  onChange={(e) => setNewDoc(e.target.value)}
                  placeholder="CPF ou CNPJ (só dígitos)"
                  className="flex-1"
                  disabled={creating}
                />
                <Button onClick={handleStartNew} disabled={creating}>
                  {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                  Consultar
                </Button>
                <Button variant="ghost" onClick={reset} disabled={creating}>Cancelar</Button>
              </div>
            ) : (
              <ConsultationResultCard result={consultResult} onContinue={reset} onDiscard={async () => {
                if (createdAppId) {
                  await (supabase as any).from('credit_applications').delete().eq('id', createdAppId);
                }
                reset();
                refetch();
              }} />
            )}
          </CardContent>
        </Card>
      )}

      <ConsultationsUsageCard companyId={companyId} />



      <Card>
        <CardHeader>
          <CardTitle>Propostas</CardTitle>
          <CardDescription>Clique em uma linha para ver a consulta na íntegra.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : applications.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma proposta criada ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Limite</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criada em</TableHead>
                  <TableHead className="w-28 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((a) => (
                  <TableRow key={a.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setDetailInitialStep(null); setDetailApp(a); }}>
                    <TableCell className="font-mono text-xs">{a.documento} <span className="text-muted-foreground">({a.tipo_documento})</span></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>{a.nome || '—'}</span>
                        <PaymentProbabilityBadge
                          probabilidadeInadimplencia={a.probabilidade_inadimplencia}
                          textoBucket={a.texto_score_bucket}
                          compact
                        />
                      </div>
                    </TableCell>
                    <TableCell>{a.score ?? '—'}{a.classification ? ` (${a.classification})` : ''}</TableCell>
                    <TableCell>{a.approved_limit != null ? `R$ ${Number(a.approved_limit).toLocaleString('pt-BR')}` : '—'}</TableCell>
                    <TableCell className="min-w-[220px]">
                      <HorizontalTimeline labels={STEP_LABELS} current={a.current_step || 1} compact />
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {a.current_step}/6 — {STEP_LABELS[(a.current_step || 1) - 1]}
                      </div>
                    </TableCell>
                    <TableCell><StatusBadge status={a.status} decision={a.decision} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Ver consulta, ocorrências e resumo"
                          onClick={(e) => { e.stopPropagation(); setDetailInitialStep(1); setDetailApp(a); }}
                        >
                          <FileSearch className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Reavaliar análise"
                          disabled={reevaluatingId === a.id}
                          onClick={(e) => handleReevaluate(a, e)}
                        >
                          {reevaluatingId === a.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <RefreshCw className="w-4 h-4" />}
                        </Button>
                        <Eye className="w-4 h-4 text-muted-foreground self-center" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ApplicationDetailDialog
        app={detailApp}
        initialStep={detailInitialStep}
        companyId={companyId}
        userId={user?.id ?? null}
        onClose={() => { setDetailApp(null); setDetailInitialStep(null); }}
        onReevaluate={(a) => handleReevaluate(a)}
        reevaluating={!!detailApp && reevaluatingId === detailApp.id}
        onChanged={refetch}
      />
    </div>
  );
}

function knockoutsFromReason(reason: string | null | undefined): string[] {
  if (!reason) return [];
  return reason.split(';').map((s) => s.trim()).filter(Boolean);
}

// ---------- Ocorrências ignoradas (alçada) ----------

type IgnoredRow = {
  id: string;
  occurrence_key: string;
  status: 'pending' | 'approved' | 'rejected';
  category: string;
  request_reason: string | null;
  decision_notes: string | null;
};

function useIgnoredOccurrences(companyId: string | null, documento: string | null) {
  const [byKey, setByKey] = useState<Record<string, IgnoredRow>>({});
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!companyId || !documento) { setByKey({}); return; }
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('credit_ignored_occurrences')
      .select('id, occurrence_key, status, category, request_reason, decision_notes')
      .eq('company_id', companyId)
      .eq('documento', documento)
      .order('created_at', { ascending: false });
    if (error) console.error(error);
    const map: Record<string, IgnoredRow> = {};
    for (const r of (data || []) as IgnoredRow[]) {
      // keep most recent per key
      if (!map[r.occurrence_key]) map[r.occurrence_key] = r;
    }
    setByKey(map);
    setLoading(false);
  }, [companyId, documento]);

  useEffect(() => { refetch(); }, [refetch]);

  return { byKey, loading, refetch };
}

function OccurrencesList({
  raw, companyId, documento, applicationId, userId,
}: {
  raw: any;
  companyId: string;
  documento: string;
  applicationId: string | null;
  userId: string | null;
}) {
  const groups = extractOccurrences(raw);
  const { byKey, refetch } = useIgnoredOccurrences(companyId, documento);
  const [requestFor, setRequestFor] = useState<{ category: string; record: OccurrenceRecord; key: string } | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (groups.length === 0) {
    return <p className="text-xs text-muted-foreground">Nenhuma ocorrência detalhada retornada pelo bureau.</p>;
  }

  const submitRequest = async () => {
    if (!requestFor) return;
    setSubmitting(true);
    const { error } = await (supabase as any).from('credit_ignored_occurrences').insert({
      company_id: companyId,
      application_id: applicationId,
      documento,
      occurrence_key: requestFor.key,
      category: requestFor.category,
      titulo: pickTitulo(requestFor.record),
      descricao: pickDescricao(requestFor.record),
      raw_record: requestFor.record,
      status: 'pending',
      request_reason: reason || null,
      requested_by: userId,
    });
    setSubmitting(false);
    if (error) {
      if (String(error.message || '').includes('uq_cio_pending_or_approved')) {
        toast.error('Já existe uma solicitação pendente ou aprovada para esta ocorrência.');
      } else {
        toast.error('Erro ao solicitar alçada: ' + error.message);
      }
      return;
    }
    toast.success('Alçada solicitada. Aguardando aprovação do gerente.');
    setRequestFor(null);
    setReason('');
    refetch();
  };

  return (
    <>
      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.category} className="rounded-lg border border-border bg-card">
            <div className="px-3 py-2 border-b bg-muted/40 flex items-center justify-between">
              <div className="text-sm font-semibold">{g.category}</div>
              <Badge variant="outline" className="text-xs">{g.items.length}</Badge>
            </div>
            <div className="divide-y">
              {g.items.map((it, i) => {
                const entries = Object.entries(it).filter(([, v]) =>
                  v != null && (typeof v === 'string' || typeof v === 'number') && String(v).trim() !== ''
                );
                const priority = entries.filter(([k]) => PRIORITY_FIELDS.includes(k.toUpperCase()));
                const rest = entries.filter(([k]) => !PRIORITY_FIELDS.includes(k.toUpperCase()));
                const titulo = priority.find(([k]) => k.toUpperCase() === 'TITULO')?.[1];
                const descricao = priority.find(([k]) =>
                  ['DESCRICAO', 'OBSERVACOES', 'OBSERVACAO', 'MENSAGEM', 'MOTIVO', 'DESCRICAO_TIPO_INFORMACAO'].includes(k.toUpperCase())
                )?.[1];
                const key = buildOccurrenceKey(it);
                const ignored = byKey[key];

                return (
                  <div key={i} className="p-3 space-y-2">
                    {entries.length === 0 ? (
                      <pre className="text-[11px] font-mono whitespace-pre-wrap">{JSON.stringify(it, null, 2)}</pre>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          {(titulo || descricao) ? (
                            <div className="flex-1 rounded border-l-2 border-amber-500 bg-amber-500/5 px-3 py-2">
                              {titulo && <div className="text-sm font-semibold">{String(titulo)}</div>}
                              {descricao && <div className="text-xs text-muted-foreground mt-0.5">{String(descricao)}</div>}
                            </div>
                          ) : <div className="flex-1" />}
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {ignored?.status === 'approved' && (
                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3 mr-1" />Ignorada (alçada)
                              </Badge>
                            )}
                            {ignored?.status === 'pending' && (
                              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30">
                                <Clock className="w-3 h-3 mr-1" />Aguardando alçada
                              </Badge>
                            )}
                            {ignored?.status === 'rejected' && (
                              <Badge className="bg-destructive/15 text-destructive border-destructive/30">
                                <XCircle className="w-3 h-3 mr-1" />Alçada negada
                              </Badge>
                            )}
                            {(!ignored || ignored.status === 'rejected') && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setRequestFor({ category: g.category, record: it, key }); setReason(''); }}
                              >
                                <Gavel className="w-3.5 h-3.5 mr-1.5" />
                                Solicitar alçada
                              </Button>
                            )}
                          </div>
                        </div>
                        {rest.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {rest.map(([k, v]) => (
                              <div key={k} className="text-xs">
                                <div className="text-[10px] uppercase text-muted-foreground">{k.replace(/_/g, ' ')}</div>
                                <div className="font-medium break-words">{String(v)}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!requestFor} onOpenChange={(o) => !o && setRequestFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar alçada</DialogTitle>
            <DialogDescription>
              Esta ocorrência ficará pendente até que um Gerente ou Supervisor aprove. Uma vez aprovada, ela
              não será considerada restritiva nesta nem em próximas consultas deste documento.
            </DialogDescription>
          </DialogHeader>
          {requestFor && (
            <div className="space-y-3">
              <div className="rounded border-l-2 border-amber-500 bg-amber-500/5 px-3 py-2">
                <div className="text-xs uppercase text-muted-foreground">{requestFor.category}</div>
                <div className="text-sm font-semibold">{pickTitulo(requestFor.record) || '(sem título)'}</div>
                {pickDescricao(requestFor.record) && (
                  <div className="text-xs text-muted-foreground mt-0.5">{pickDescricao(requestFor.record)}</div>
                )}
              </div>
              <div>
                <label className="text-xs font-medium">Justificativa (opcional)</label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Por que esta ocorrência deve ser ignorada?" rows={3} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRequestFor(null)} disabled={submitting}>Cancelar</Button>
            <Button onClick={submitRequest} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Gavel className="w-4 h-4 mr-2" />}
              Solicitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ConsultationResultCard({ result, onContinue, onDiscard }: { result: ConsultResult; onContinue: () => void; onDiscard: () => void }) {
  const e = result.engine;
  const colorClass = e.decision === 'approved' ? 'border-emerald-500/40 bg-emerald-500/5'
    : e.decision === 'manual' ? 'border-amber-500/40 bg-amber-500/5'
    : 'border-destructive/40 bg-destructive/5';
  return (
    <div className={`rounded-lg border p-4 space-y-3 ${colorClass}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-semibold text-lg">{result.nome || '(sem nome retornado)'}</div>
          <div className="text-xs text-muted-foreground font-mono">{result.documento} ({result.tipo_documento})</div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold">{e.score}</div>
          <div className="text-xs text-muted-foreground">Classe {e.classification}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <Stat label="Protestos" value={result.summary.quantidade_protestos || '0'} />
        <Stat label="Pendências" value={result.summary.quantidade_pendencias_financeiras || '0'} />
        <Stat label="CCF Bacen" value={result.summary.quantidade_ccf_bacen || '0'} />
        <Stat label="CCF Varejo" value={result.summary.quantidade_ccf_varejo || '0'} />
        <Stat label="Ações Cíveis" value={result.summary.quantidade_acoes_civeis || '0'} />
        <Stat label="Alertas" value={result.summary.quantidade_alertas_restricoes || '0'} />
        <Stat label="Prob. Inadimpl." value={result.summary.probabilidade_inadimplencia || '—'} />
        <Stat label="Situação" value={result.summary.situacao_cpf || '—'} />
      </div>

      {result.ignored_adjustments && result.ignored_adjustments.length > 0 && (
        <div className="rounded border border-emerald-500/30 bg-emerald-500/5 p-2 text-xs">
          <div className="font-medium text-emerald-700 dark:text-emerald-300 mb-1 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Ocorrências ignoradas por alçada aplicadas
          </div>
          <ul className="space-y-0.5">
            {result.ignored_adjustments.map((a, i) => (
              <li key={i} className="text-muted-foreground">
                {a.category}: {a.field} {a.before} → {a.after} (−{a.subtracted})
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.bureau_analysis && <BureauAnalysisCard analysis={result.bureau_analysis} />}

      {result.pdf_data && (
        <div className="flex justify-end">
          <PdfEspelhoButton pdfData={result.pdf_data} filename={`espelho-${result.documento}.pdf`} />
        </div>
      )}

      <DecisionBox decision={e.decision} approved_limit={e.approved_limit} max_parcelas={e.max_parcelas} reason={e.reason} knockouts={e.knockouts} />

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onDiscard}>Descartar</Button>
        {e.decision !== 'rejected' && (
          <Button onClick={onContinue}>
            Avançar para simulação <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
        {e.decision === 'rejected' && (
          <Button variant="outline" onClick={onContinue}>Fechar</Button>
        )}
      </div>
    </div>
  );
}

function DecisionBox({ decision, approved_limit, max_parcelas, reason, knockouts }: {
  decision: 'approved' | 'manual' | 'rejected' | null;
  approved_limit: number | null;
  max_parcelas?: number;
  reason: string | null;
  knockouts?: string[];
}) {
  const list = knockouts && knockouts.length > 0 ? knockouts : knockoutsFromReason(reason);
  return (
    <div className="border-t pt-3 space-y-2">
      {decision === 'approved' && (
        <div>
          <div className="text-base font-semibold text-emerald-700 dark:text-emerald-300">✅ Aprovado</div>
          {approved_limit != null && (
            <div className="text-sm">Limite sugerido: <strong>R$ {Number(approved_limit).toLocaleString('pt-BR')}</strong>{max_parcelas ? <> em até <strong>{max_parcelas}x</strong></> : null}</div>
          )}
          {reason && <div className="text-xs text-muted-foreground mt-1">{reason}</div>}
        </div>
      )}
      {decision === 'manual' && (
        <div>
          <div className="text-base font-semibold text-amber-700 dark:text-amber-300">⚠️ Análise manual</div>
          {approved_limit != null && (
            <div className="text-sm">Limite sugerido: <strong>R$ {Number(approved_limit).toLocaleString('pt-BR')}</strong>{max_parcelas ? <> em até <strong>{max_parcelas}x</strong></> : null}</div>
          )}
          {reason && <div className="text-xs text-muted-foreground mt-1">{reason}</div>}
        </div>
      )}
      {decision === 'rejected' && (
        <div>
          <div className="text-base font-semibold text-destructive">❌ Recusado</div>
          {list.length > 0 ? (
            <div className="mt-2">
              <div className="text-xs font-medium text-destructive/90 mb-1">Motivos:</div>
              <ul className="space-y-1">
                {list.map((k, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs bg-destructive/10 border border-destructive/20 rounded px-2 py-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                    <span>{k}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : reason ? (
            <div className="text-xs text-muted-foreground mt-1">{reason}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-card px-2 py-1.5">
      <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function ApplicationDetailDialog({
  app, companyId, userId, onClose, onReevaluate, reevaluating, onChanged, initialStep,
}: {
  app: CreditApplication | null;
  companyId: string;
  userId: string | null;
  onClose: () => void;
  onReevaluate: (a: CreditApplication) => void;
  reevaluating: boolean;
  onChanged: () => void;
  initialStep?: number | null;
}) {
  const [consultation, setConsultation] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState<number>(1);
  const [localStep, setLocalStep] = useState<number>(1);
  const [pendingSim, setPendingSim] = useState<any | null>(null);
  const [canApprove, setCanApprove] = useState(false);
  const { rules } = useCreditRules(companyId);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await (supabase as any).from('user_roles').select('role').eq('user_id', userId);
      const roles = (data || []).map((r: any) => r.role);
      setCanApprove(roles.includes('supervisor') || roles.includes('gerente'));
    })();
  }, [userId]);

  const [hasAlcada, setHasAlcada] = useState(false);

  useEffect(() => {
    if (!app) { setConsultation(null); setHasAlcada(false); return; }
    const cur = Math.max(1, app.current_step || 1);
    setActiveStep(initialStep ?? cur);
    setLocalStep(cur);
    setLoading(true);
    (async () => {
      const [consultationResp, ignoredResp, overrideResp] = await Promise.all([
        (supabase as any)
          .from('credit_consultations')
          .select('*')
          .eq('application_id', app.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        (supabase as any)
          .from('credit_ignored_occurrences')
          .select('id')
          .eq('company_id', companyId)
          .eq('status', 'approved')
          .or(`application_id.eq.${app.id},documento.eq.${app.documento}`),
        (supabase as any)
          .from('credit_overridden_criteria')
          .select('id')
          .eq('company_id', companyId)
          .eq('application_id', app.id)
          .eq('status', 'approved'),
      ]);

      const { data } = consultationResp;
      setConsultation(data);
      const ignoredRows = ignoredResp.data;
      const overrideRows = overrideResp.data;
      setHasAlcada(
        (Array.isArray(ignoredRows) && ignoredRows.length > 0) ||
        (Array.isArray(overrideRows) && overrideRows.length > 0)
      );
      setLoading(false);
    })();
  }, [app, reevaluating, companyId]);

  if (!app) return null;
  const summary = ((consultation?.summary || (app as any).summary || {}) as Record<string, string>);
  const currentDecision = (consultation?.decision ?? app.decision) as any;
  const currentReason = consultation?.decision_reason ?? app.decision_reason;
  const currentStatus = app.status === 'contracted'
    ? 'contracted'
    : consultation?.decision === 'rejected'
      ? 'rejected'
      : (currentDecision ? 'consulted' : app.status);
  const currentScore = consultation?.score ?? app.score;
  const currentClassification = consultation?.classification ?? app.classification;
  const currentApprovedLimit = consultation?.approved_limit ?? app.approved_limit;
  const currentProbabilidade = consultation?.probabilidade_inadimplencia ?? app.probabilidade_inadimplencia;
  const currentTextoBucket = consultation?.texto_score_bucket ?? app.texto_score_bucket;
  const knockouts = knockoutsFromReason(currentReason);
  const decisionOk = currentDecision === 'approved' || currentDecision === 'manual';


  const advanceStep = async (next: number) => {
    setLocalStep((p) => Math.max(p, next));
    setActiveStep(next);
    await (supabase as any).from('credit_applications').update({ current_step: next }).eq('id', app.id).lt('current_step', next);
    onChanged();
  };

  const steps = STEP_LABELS.map((label, i) => {
    const id = i + 1;
    let status: 'done' | 'current' | 'locked' | 'pending';
    const cur = localStep;
    if (id < cur) status = 'done';
    else if (id === cur) status = 'current';
    else if (id === 1 || (id === 2 && decisionOk) || id <= cur) status = 'pending';
    else status = 'locked';
    return { id, label, status };
  });

  

  return (
    <Dialog open={!!app} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-5">
          <DialogTitle className="flex items-center gap-3 flex-wrap">
            <span>{app.nome || '(sem nome)'}</span>
            <StatusBadge status={currentStatus} decision={currentDecision} />
            <ApprovalSourceBadge decision={currentDecision} hasAlcada={hasAlcada} />
            <PaymentProbabilityBadge
              probabilidadeInadimplencia={currentProbabilidade}
              textoBucket={currentTextoBucket}
            />
            <div className="ml-auto flex items-center gap-2">
              {consultation?.pdf_data && (
                <PdfEspelhoButton pdfData={consultation.pdf_data} filename={`espelho-${app.documento}.pdf`} />
              )}
              <Button size="sm" variant="outline" onClick={() => onReevaluate(app)} disabled={reevaluating}>
                {reevaluating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Reavaliar
              </Button>
            </div>
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {app.documento} ({app.tipo_documento}) · Criada em {new Date(app.created_at).toLocaleString('pt-BR')}
          </DialogDescription>
          <div className="pt-3 pb-1">
            <HorizontalTimeline labels={STEP_LABELS} current={localStep} />
          </div>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            <JourneyStepper steps={steps} active={activeStep} onSelect={setActiveStep} />
            <div className="flex-1 overflow-auto">
              {activeStep === 1 && (
                <Tabs defaultValue="decision" className="flex flex-col h-full">
                  <TabsList className="m-3">
                    <TabsTrigger value="decision">Decisão</TabsTrigger>
                    <TabsTrigger value="occurrences">Ocorrências</TabsTrigger>
                    <TabsTrigger value="summary">Resumo</TabsTrigger>
                    <TabsTrigger value="raw">Resposta</TabsTrigger>
                    {consultation?.pdf_data && <TabsTrigger value="espelho">Espelho (PDF)</TabsTrigger>}
                  </TabsList>
                  <TabsContent value="decision" className="flex-1 overflow-auto px-4 pb-4">
                    <div className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-xs text-muted-foreground">Score</div>
                          <div className="text-3xl font-bold">{currentScore ?? '—'}</div>
                          <div className="text-xs">Classe {currentClassification ?? '—'}</div>
                        </div>
                        {currentApprovedLimit != null && (
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">Limite aprovado</div>
                            <div className="text-2xl font-bold">R$ {Number(currentApprovedLimit).toLocaleString('pt-BR')}</div>
                          </div>
                        )}
                      </div>
                      <DecisionBox decision={currentDecision} approved_limit={currentApprovedLimit} reason={currentReason} knockouts={knockouts} />
                      <EngineChecklist
                        summary={summary}
                        bureau={(consultation?.bureau_analysis || (app as any).bureau_analysis) as any}
                        rules={rules}
                        tipoDocumento={app.tipo_documento}
                        applicationId={app.id}
                        companyId={companyId}
                        userId={userId}
                        canApprove={canApprove}
                        onChanged={onChanged}
                      />
                      {(consultation?.bureau_analysis || (app as any).bureau_analysis) && (
                        <BureauAnalysisCard analysis={(consultation?.bureau_analysis || (app as any).bureau_analysis) as any} />
                      )}
                      {decisionOk && localStep < 2 && (
                        <div className="flex justify-end pt-2">
                          <Button onClick={() => advanceStep(2)}>
                            Prosseguir para simulação <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="occurrences" className="flex-1 overflow-auto px-4 pb-4">
                    <OccurrencesList raw={consultation?.raw_response} companyId={companyId} documento={app.documento} applicationId={app.id} userId={userId} />
                  </TabsContent>
                  <TabsContent value="summary" className="flex-1 overflow-auto px-4 pb-4">
                    {Object.keys(summary).length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 text-center">Sem resumo disponível.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {Object.entries(summary).map(([k, v]) => (
                          <div key={k} className="rounded border border-border bg-card px-3 py-2 text-sm">
                            <div className="text-[10px] text-muted-foreground uppercase">{k.replace(/_/g, ' ')}</div>
                            <div className="font-medium break-words">{String(v ?? '—')}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="raw" className="flex-1 overflow-hidden px-4 pb-4">
                    <ScrollArea className="h-[55vh] rounded border bg-muted/30">
                      <pre className="text-[11px] p-3 whitespace-pre-wrap break-all font-mono">
                        {consultation?.raw_response ? JSON.stringify(consultation.raw_response, null, 2) : 'Sem resposta bruta.'}
                      </pre>
                    </ScrollArea>
                  </TabsContent>
                  {consultation?.pdf_data && (
                    <TabsContent value="espelho" className="flex-1 overflow-hidden px-4 pb-4">
                      <PdfEspelhoViewer pdfData={consultation.pdf_data} />
                    </TabsContent>
                  )}
                </Tabs>
              )}
              {activeStep === 2 && <SimulationStep applicationId={app.id} companyId={companyId} approvedLimit={currentApprovedLimit} bureauParcelaMaxima={(consultation?.bureau_analysis as any)?.parcela_maxima ?? (app as any).bureau_analysis?.parcela_maxima ?? null} onCompleted={(data) => { setPendingSim(data); advanceStep(3); }} />}
              {activeStep === 3 && <QualificationStep applicationId={app.id} companyId={companyId} consultationRaw={consultation?.raw_response} consultationName={app.nome || consultation?.nome} onCompleted={() => advanceStep(4)} />}
              {activeStep === 4 && <BiometryStep applicationId={app.id} companyId={companyId} canApprove={canApprove} onCompleted={() => advanceStep(5)} />}
              {activeStep === 5 && <ContractStep applicationId={app.id} companyId={companyId} application={app} pendingSimulation={pendingSim || (app as any).simulation} canApprove={canApprove} onCompleted={() => advanceStep(6)} />}
              {activeStep === 6 && <BoletosStep applicationId={app.id} companyId={companyId} clientSupplierId={app.client_supplier_id} userId={userId} onCompleted={() => { onChanged(); }} />}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------- Bureau consumption summary ----------

function ConsultationsUsageCard({ companyId }: { companyId: string }) {
  const { rules } = useCreditRules(companyId);
  const price = Number(rules?.consulta_price || 0);

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const [from, setFrom] = useState<string>(toISO(firstOfMonth));
  const [to, setTo] = useState<string>(toISO(today));
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    (async () => {
      const fromTs = new Date(`${from}T00:00:00`).toISOString();
      const toTs = new Date(`${to}T23:59:59.999`).toISOString();
      const { count: c } = await (supabase as any)
        .from('credit_consultations')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .gte('created_at', fromTs)
        .lte('created_at', toTs);
      setCount(c || 0);
      setLoading(false);
    })();
  }, [companyId, from, to]);

  const total = count * price;
  const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Consumo de consultas ao bureau</CardTitle>
        <CardDescription>Quantidade de consultas realizadas pela empresa no período e custo estimado.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">Consultas realizadas</div>
            <div className="text-2xl font-bold">{loading ? '…' : count}</div>
          </div>
          <div className="rounded-lg border bg-primary/5 border-primary/30 p-3">
            <div className="text-xs text-muted-foreground">
              Custo total {price > 0 ? `(${fmt(price)} / consulta)` : '(preço não configurado)'}
            </div>
            <div className="text-2xl font-bold text-primary">{loading ? '…' : fmt(total)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


function buildPdfObjectUrl(pdfData: string): { url: string; revoke?: () => void } {
  const s = pdfData.trim();
  if (/^https?:\/\//i.test(s)) return { url: s };
  // Strip optional data URL prefix
  const base64 = s.replace(/^data:application\/pdf;base64,/, '');
  try {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    return { url, revoke: () => URL.revokeObjectURL(url) };
  } catch {
    return { url: s };
  }
}

function openPdfInNewTab(url: string) {
  // Use an anchor click instead of window.open so that the iframe sandbox /
  // popup blocker does not stop blob: URLs from opening.
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function downloadPdf(pdfData: string, filename = 'espelho.pdf') {
  const { url, revoke } = buildPdfObjectUrl(pdfData);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Give browser a moment to start the download before revoking blob.
  setTimeout(() => revoke?.(), 1500);
}

function PdfEspelhoButton({ pdfData, filename }: { pdfData: string; filename?: string }) {
  return (
    <Button size="sm" variant="outline" onClick={() => downloadPdf(pdfData, filename)} title="Baixar espelho (PDF)">
      <Download className="w-4 h-4 mr-2" />
      Download Espelho
    </Button>
  );
}

function PdfEspelhoViewer({ pdfData }: { pdfData: string }) {
  const [obj] = useState(() => buildPdfObjectUrl(pdfData));
  useEffect(() => () => { obj.revoke?.(); }, [obj]);
  return (
    <div className="h-[60vh] w-full">
      <iframe src={obj.url} title="Espelho PDF da consulta" className="h-full w-full rounded border bg-muted/20" />
    </div>
  );
}


