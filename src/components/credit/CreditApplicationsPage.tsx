import { useState } from 'react';
import { useCreditApplications, consultCredit, type ConsultResult } from '@/hooks/useCreditModule';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Search, ShieldCheck, ShieldAlert, ShieldX, ArrowRight } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{a.documento} <span className="text-muted-foreground">({a.tipo_documento})</span></TableCell>
                    <TableCell>{a.nome || '—'}</TableCell>
                    <TableCell>{a.score ?? '—'}{a.classification ? ` (${a.classification})` : ''}</TableCell>
                    <TableCell>{a.approved_limit != null ? `R$ ${Number(a.approved_limit).toLocaleString('pt-BR')}` : '—'}</TableCell>
                    <TableCell>
                      <span className="text-xs">{a.current_step}/6 — {STEP_LABELS[a.current_step - 1]}</span>
                    </TableCell>
                    <TableCell><StatusBadge status={a.status} decision={a.decision} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString('pt-BR')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
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

      <div className="border-t pt-3">
        {e.decision === 'approved' && (
          <div>
            <div className="text-base font-semibold text-emerald-700 dark:text-emerald-300">✅ Aprovado</div>
            <div className="text-sm">Limite sugerido: <strong>R$ {e.approved_limit.toLocaleString('pt-BR')}</strong> em até <strong>{e.max_parcelas}x</strong></div>
            <div className="text-xs text-muted-foreground mt-1">{e.reason}</div>
          </div>
        )}
        {e.decision === 'manual' && (
          <div>
            <div className="text-base font-semibold text-amber-700 dark:text-amber-300">⚠️ Análise manual</div>
            <div className="text-sm">Limite sugerido: <strong>R$ {e.approved_limit.toLocaleString('pt-BR')}</strong> em até <strong>{e.max_parcelas}x</strong></div>
            <div className="text-xs text-muted-foreground mt-1">{e.reason}</div>
          </div>
        )}
        {e.decision === 'rejected' && (
          <div>
            <div className="text-base font-semibold text-destructive">❌ Recusado</div>
            <div className="text-xs text-muted-foreground mt-1">{e.reason}</div>
          </div>
        )}
      </div>

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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-card px-2 py-1.5">
      <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
