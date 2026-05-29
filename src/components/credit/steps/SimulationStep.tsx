import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ArrowRight, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useCreditRules } from '@/hooks/useCreditModule';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export interface SimulationData {
  principal: number;
  num_parcelas: number;
  juros_mensal_pct: number;
  parcela_amount: number;
  total_amount: number;
  first_due_date: string;
  description: string;
}

export function SimulationStep({
  applicationId,
  companyId,
  approvedLimit,
  bureauParcelaMaxima,
  onCompleted,
}: {
  applicationId: string;
  companyId: string;
  approvedLimit: number | null;
  bureauParcelaMaxima?: number | null;
  onCompleted: (data: SimulationData) => void;
}) {
  const { rules } = useCreditRules(companyId);
  const [principal, setPrincipal] = useState<string>('');
  const [numParcelas, setNumParcelas] = useState<string>('1');
  const [firstDue, setFirstDue] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [description, setDescription] = useState<string>('');
  const [loadedDraft, setLoadedDraft] = useState(false);

  // Carrega rascunho salvo (se houver)
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from('credit_applications')
        .select('simulation')
        .eq('id', applicationId)
        .maybeSingle();
      const sim = data?.simulation;
      if (sim) {
        if (sim.principal != null) setPrincipal(String(sim.principal));
        if (sim.num_parcelas != null) setNumParcelas(String(sim.num_parcelas));
        if (sim.first_due_date) setFirstDue(sim.first_due_date);
        if (sim.description) setDescription(sim.description);
      }
      setLoadedDraft(true);
    })();
  }, [applicationId]);

  useEffect(() => {
    if (loadedDraft && approvedLimit != null && !principal) setPrincipal(String(approvedLimit));
  }, [approvedLimit, principal, loadedDraft]);

  // Auto-save (debounced) sempre que o usuário alterar algum campo, mesmo sem confirmar
  useEffect(() => {
    if (!loadedDraft) return;
    const t = setTimeout(() => {
      const payload = {
        principal: principal ? Number(principal) : null,
        num_parcelas: numParcelas ? Number(numParcelas) : null,
        first_due_date: firstDue || null,
        description: description || null,
        juros_mensal_pct: rules?.juros_mensal_pct ?? null,
      };
      (supabase as any).from('credit_applications').update({ simulation: payload }).eq('id', applicationId);
    }, 600);
    return () => clearTimeout(t);
  }, [principal, numParcelas, firstDue, description, rules?.juros_mensal_pct, applicationId, loadedDraft]);

  const calc = useMemo(() => {
    const P = Number(principal) || 0;
    const n = Math.max(1, Number(numParcelas) || 1);
    const i = (rules?.juros_mensal_pct || 0) / 100;
    if (P <= 0) return null;
    const parcela = i === 0 ? P / n : (P * i) / (1 - Math.pow(1 + i, -n));
    const total = parcela * n;
    return { parcela, total };
  }, [principal, numParcelas, rules]);

  const validate = (): string | null => {
    const P = Number(principal);
    const n = Number(numParcelas);
    if (!P || P <= 0) return 'Informe um valor válido';
    if (approvedLimit != null && P > approvedLimit) return `Valor excede o limite aprovado de R$ ${approvedLimit.toLocaleString('pt-BR')}`;
    if (!n || n < 1) return 'Nº de parcelas inválido';
    if (!firstDue) return 'Defina a data da 1ª parcela';
    if (!description.trim()) return 'Descreva a operação (ex: Venda mercadoria #123)';
    if (calc && rules && calc.parcela < rules.parcela_minima) return `Parcela abaixo do mínimo (R$ ${rules.parcela_minima})`;
    return null;
  };

  const confirm = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    const data: SimulationData = {
      principal: Number(principal),
      num_parcelas: Number(numParcelas),
      juros_mensal_pct: rules?.juros_mensal_pct || 0,
      parcela_amount: calc!.parcela,
      total_amount: calc!.total,
      first_due_date: firstDue,
      description: description.trim(),
    };
    await (supabase as any).from('credit_applications').update({
      simulation: data,
      current_step: 3,
    }).eq('id', applicationId).lt('current_step', 3);
    // garante o save mesmo se já estiver em step >= 3 (re-simulação)
    await (supabase as any).from('credit_applications').update({ simulation: data }).eq('id', applicationId);
    onCompleted(data);
  };

  const schedule = useMemo(() => {
    if (!calc) return [];
    const n = Number(numParcelas);
    const base = new Date(firstDue + 'T00:00:00');
    return Array.from({ length: n }, (_, k) => {
      const d = new Date(base);
      d.setMonth(d.getMonth() + k);
      return { i: k + 1, date: d.toLocaleDateString('pt-BR'), value: calc.parcela };
    });
  }, [calc, numParcelas, firstDue]);

  if (!rules) return <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="text-base font-semibold">Simulação da operação</h3>
        <p className="text-xs text-muted-foreground">
          Juros mensal: <strong>{rules.juros_mensal_pct}%</strong> · Parcela mínima: <strong>R$ {rules.parcela_minima}</strong>
          {approvedLimit != null && <> · Limite aprovado: <strong>R$ {approvedLimit.toLocaleString('pt-BR')}</strong></>}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>Valor da operação (R$)</Label>
          <Input type="number" step="0.01" value={principal} onChange={(e) => setPrincipal(e.target.value)} />
        </div>
        <div>
          <Label>Nº de parcelas</Label>
          <Input type="number" min={1} value={numParcelas} onChange={(e) => setNumParcelas(e.target.value)} />
        </div>
        <div>
          <Label>Data da 1ª parcela</Label>
          <Input type="date" value={firstDue} onChange={(e) => setFirstDue(e.target.value)} />
        </div>
        <div>
          <Label>Descrição</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Venda mercadoria pedido #123" />
        </div>
      </div>

      {calc && (
        <div className="rounded border bg-muted/30 p-3 space-y-2">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <Stat label="Valor da parcela" value={`R$ ${calc.parcela.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
            <Stat label="Total a pagar" value={`R$ ${calc.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
            <Stat label="Juros total" value={`R$ ${(calc.total - Number(principal)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-8">#</TableHead>
                <TableHead className="h-8">Vencimento</TableHead>
                <TableHead className="h-8 text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedule.map((p) => (
                <TableRow key={p.i}>
                  <TableCell className="py-1.5">{p.i}</TableCell>
                  <TableCell className="py-1.5">{p.date}</TableCell>
                  <TableCell className="py-1.5 text-right">R$ {p.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={confirm}>
          Confirmar e avançar para qualificação <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-card p-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
