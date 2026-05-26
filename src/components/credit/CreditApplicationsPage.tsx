import { useState, useEffect } from 'react';
import { useCreditApplications, consultCredit, type ConsultResult, type CreditApplication } from '@/hooks/useCreditModule';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Search, ShieldCheck, ShieldAlert, ShieldX, ArrowRight, Eye, AlertTriangle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Props { companyId: string }

const STEP_LABELS = ['Consulta', 'Qualificação', 'Biometria', 'Simulação', 'Contrato', 'Boletos'];

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

export function CreditApplicationsPage({ companyId }: Props) {
  const { applications, loading, refetch } = useCreditApplications(companyId);
  const { user } = useAuth();
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newDoc, setNewDoc] = useState('');
  const [consultResult, setConsultResult] = useState<ConsultResult | null>(null);
  const [createdAppId, setCreatedAppId] = useState<string | null>(null);
  const [detailApp, setDetailApp] = useState<CreditApplication | null>(null);

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
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((a) => (
                  <TableRow key={a.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailApp(a)}>
                    <TableCell className="font-mono text-xs">{a.documento} <span className="text-muted-foreground">({a.tipo_documento})</span></TableCell>
                    <TableCell>{a.nome || '—'}</TableCell>
                    <TableCell>{a.score ?? '—'}{a.classification ? ` (${a.classification})` : ''}</TableCell>
                    <TableCell>{a.approved_limit != null ? `R$ ${Number(a.approved_limit).toLocaleString('pt-BR')}` : '—'}</TableCell>
                    <TableCell>
                      <span className="text-xs">{a.current_step}/6 — {STEP_LABELS[a.current_step - 1]}</span>
                    </TableCell>
                    <TableCell><StatusBadge status={a.status} decision={a.decision} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell><Eye className="w-4 h-4 text-muted-foreground" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ApplicationDetailDialog app={detailApp} onClose={() => setDetailApp(null)} />
    </div>
  );
}

function knockoutsFromReason(reason: string | null | undefined): string[] {
  if (!reason) return [];
  return reason.split(';').map((s) => s.trim()).filter(Boolean);
}

/** Categorias de ocorrências negativas que queremos exibir detalhadas. */
const OCCURRENCE_KEY_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: 'Alertas / Restrições', regex: /ALERTA|RESTRIC|CHAVEAMENTO|STATUS_CONSUMIDOR/i },
  { label: 'Protestos', regex: /PROTESTO/i },
  { label: 'Pendências Financeiras', regex: /PENDENCIA/i },
  { label: 'Cheques sem Fundo (CCF)', regex: /\bCCF\b|CHEQUE/i },
  { label: 'Ações Cíveis', regex: /ACAO_CIVE|ACOES_CIVE|AC_CIVEIS/i },
];

/** Campos prioritários que descrevem a ocorrência (exibidos primeiro e em destaque). */
const PRIORITY_FIELDS = ['TITULO', 'TIPO', 'DESCRICAO', 'OBSERVACOES', 'OBSERVACAO', 'MENSAGEM', 'MOTIVO', 'DESCRICAO_TIPO_INFORMACAO'];

/** Walks the raw_response and collects records from arrays whose key matches a pattern. */
function extractOccurrences(raw: any): Array<{ category: string; items: Array<Record<string, any>> }> {
  const buckets: Record<string, Array<Record<string, any>>> = {};
  const visit = (node: any, parentKey = '') => {
    if (node == null) return;
    if (Array.isArray(node)) {
      node.forEach((v) => visit(v, parentKey));
      return;
    }
    if (typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node)) {
      const matched = OCCURRENCE_KEY_PATTERNS.find((p) => p.regex.test(k));
      if (matched && Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') {
        buckets[matched.label] = (buckets[matched.label] || []).concat(v as any[]);
      } else if (matched && v && typeof v === 'object' && !Array.isArray(v)) {
        // some bureaus wrap a single record as object — include if it has scalar fields
        const hasScalars = Object.values(v as any).some((x) => typeof x === 'string' || typeof x === 'number');
        if (hasScalars) buckets[matched.label] = (buckets[matched.label] || []).concat([v as any]);
        visit(v, k);
      } else {
        visit(v, k);
      }
    }
  };
  visit(raw);
  return Object.entries(buckets).map(([category, items]) => ({ category, items }));
}

function OccurrencesList({ raw }: { raw: any }) {
  const groups = extractOccurrences(raw);
  if (groups.length === 0) {
    return <p className="text-xs text-muted-foreground">Nenhuma ocorrência detalhada retornada pelo bureau.</p>;
  }
  return (
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
              return (
                <div key={i} className="p-3 space-y-2">
                  {entries.length === 0 ? (
                    <pre className="text-[11px] font-mono whitespace-pre-wrap">{JSON.stringify(it, null, 2)}</pre>
                  ) : (
                    <>
                      {(titulo || descricao) && (
                        <div className="rounded border-l-2 border-amber-500 bg-amber-500/5 px-3 py-2">
                          {titulo && <div className="text-sm font-semibold">{String(titulo)}</div>}
                          {descricao && <div className="text-xs text-muted-foreground mt-0.5">{String(descricao)}</div>}
                        </div>
                      )}
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

      <DecisionBox decision={e.decision} approved_limit={e.approved_limit} max_parcelas={e.max_parcelas} reason={e.reason} knockouts={e.knockouts} />

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onDiscard}>Descartar</Button>
        {e.decision !== 'rejected' && (
          <Button onClick={onContinue}>
            Avançar para qualificação <ArrowRight className="w-4 h-4 ml-2" />
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

function ApplicationDetailDialog({ app, onClose }: { app: CreditApplication | null; onClose: () => void }) {
  const [consultation, setConsultation] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!app) { setConsultation(null); return; }
    setLoading(true);
    (async () => {
      const { data, error } = await (supabase as any)
        .from('credit_consultations')
        .select('*')
        .eq('application_id', app.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) console.error(error);
      setConsultation(data);
      setLoading(false);
    })();
  }, [app]);

  if (!app) return null;

  const summary = (consultation?.summary || {}) as Record<string, string>;
  const knockouts = knockoutsFromReason(consultation?.decision_reason || app.decision_reason);

  return (
    <Dialog open={!!app} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{app.nome || '(sem nome)'}</span>
            <StatusBadge status={app.status} decision={app.decision} />
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {app.documento} ({app.tipo_documento}) · Criada em {new Date(app.created_at).toLocaleString('pt-BR')}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <Tabs defaultValue="decision" className="flex-1 overflow-hidden flex flex-col">
            <TabsList>
              <TabsTrigger value="decision">Decisão</TabsTrigger>
              <TabsTrigger value="occurrences">Ocorrências</TabsTrigger>
              <TabsTrigger value="summary">Resumo</TabsTrigger>
              <TabsTrigger value="raw">Resposta completa</TabsTrigger>
            </TabsList>

            <TabsContent value="decision" className="flex-1 overflow-auto">
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">Score</div>
                    <div className="text-3xl font-bold">{app.score ?? consultation?.score ?? '—'}</div>
                    <div className="text-xs">Classe {app.classification ?? consultation?.classification ?? '—'}</div>
                  </div>
                  {app.approved_limit != null && (
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Limite aprovado</div>
                      <div className="text-2xl font-bold">R$ {Number(app.approved_limit).toLocaleString('pt-BR')}</div>
                    </div>
                  )}
                </div>
                <DecisionBox
                  decision={(app.decision || consultation?.decision) as any}
                  approved_limit={app.approved_limit}
                  reason={app.decision_reason || consultation?.decision_reason}
                  knockouts={knockouts}
                />
              </div>
            </TabsContent>

            <TabsContent value="occurrences" className="flex-1 overflow-auto">
              <OccurrencesList raw={consultation?.raw_response} />
            </TabsContent>



            <TabsContent value="summary" className="flex-1 overflow-auto">
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

            <TabsContent value="raw" className="flex-1 overflow-hidden">
              <ScrollArea className="h-[55vh] rounded border bg-muted/30">
                <pre className="text-[11px] p-3 whitespace-pre-wrap break-all font-mono">
                  {consultation?.raw_response
                    ? JSON.stringify(consultation.raw_response, null, 2)
                    : 'Sem resposta bruta armazenada.'}
                </pre>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
