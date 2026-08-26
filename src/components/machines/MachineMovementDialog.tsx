import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAccounts } from '@/hooks/useAccounts';
import { useClientsSuppliers } from '@/hooks/useClientsSuppliers';
import { useAuth } from '@/contexts/AuthContext';
import { dueDateForInstallment } from '@/lib/machinesFinance';

interface Props {
  companyId: string;
  machine: { id: string; name: string; sale_price?: number | null } | null;
  onClose: () => void;
  onDone: () => void;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

export function MachineMovementDialog({ companyId, machine, onClose, onDone }: Props) {
  const { accounts } = useAccounts(companyId);
  const { clientsSuppliers } = useClientsSuppliers(companyId);
  const { user } = useAuth();
  const [tab, setTab] = useState<'venda' | 'baixa'>('venda');
  const [saving, setSaving] = useState(false);

  const [sale, setSale] = useState({
    date: todayStr(),
    amount: '',
    buyer_client_id: 'none',
    buyer_name: '',
    payment_mode: 'cash' as 'cash' | 'installments',
    account_id: 'none',
    down_payment: '',
    installments_count: '1',
    frequency: 'monthly' as 'monthly' | 'weekly' | 'daily',
    notes: '',
  });
  const [writeOff, setWriteOff] = useState({ date: todayStr(), reason: '', notes: '' });

  const clientOptions = useMemo(
    () => clientsSuppliers.filter(c => c.type === 'client' || c.type === 'both'),
    [clientsSuppliers]
  );

  const resetAndClose = () => {
    setSale({ date: todayStr(), amount: '', buyer_client_id: 'none', buyer_name: '', payment_mode: 'cash', account_id: 'none', down_payment: '', installments_count: '1', frequency: 'monthly', notes: '' });
    setWriteOff({ date: todayStr(), reason: '', notes: '' });
    setTab('venda');
    onClose();
  };

  const saveSale = async () => {
    if (!machine) return;
    const amount = parseFloat(sale.amount || '0');
    if (!amount || amount <= 0) return toast.error('Informe o valor da venda');
    const buyerName = sale.buyer_client_id !== 'none'
      ? (clientOptions.find(c => c.id === sale.buyer_client_id)?.name || '')
      : sale.buyer_name.trim();
    if (!buyerName) return toast.error('Informe o comprador');
    const down = parseFloat(sale.down_payment || '0');
    const installments = Math.max(1, parseInt(sale.installments_count || '1'));
    if (sale.payment_mode === 'cash' && sale.account_id === 'none') return toast.error('Selecione a conta de recebimento');
    if (down >= amount && sale.payment_mode === 'installments') return toast.error('A entrada deve ser menor que o valor da venda');

    setSaving(true);
    try {
      const { data: mov, error: movErr } = await (supabase as any)
        .from('machine_movements')
        .insert({
          company_id: companyId,
          machine_id: machine.id,
          movement_type: 'venda',
          movement_date: sale.date,
          buyer_client_id: sale.buyer_client_id !== 'none' ? sale.buyer_client_id : null,
          buyer_name: buyerName,
          sale_amount: amount,
          payment_mode: sale.payment_mode,
          down_payment: sale.payment_mode === 'installments' ? down : 0,
          installments_count: sale.payment_mode === 'installments' ? installments : null,
          account_id: sale.account_id !== 'none' ? sale.account_id : null,
          notes: sale.notes || null,
          created_by: user?.id ?? null,
        })
        .select('id')
        .single();
      if (movErr) throw movErr;

      const description = `Venda de ${machine.name} - ${buyerName}`;

      if (sale.payment_mode === 'cash') {
        const { data: tx, error: txErr } = await (supabase as any)
          .from('transactions')
          .insert({
            company_id: companyId,
            account_id: sale.account_id,
            type: 'income',
            amount,
            description,
            date: sale.date,
            created_by: user?.id ?? null,
          })
          .select('id')
          .single();
        if (txErr) throw txErr;
        await (supabase as any).from('machine_movements').update({ transaction_id: tx.id }).eq('id', mov.id);
      } else {
        const rows: any[] = [];
        if (down > 0) {
          if (sale.account_id !== 'none') {
            const { data: tx, error: txErr } = await (supabase as any)
              .from('transactions')
              .insert({
                company_id: companyId,
                account_id: sale.account_id,
                type: 'income',
                amount: down,
                description: `${description} (entrada)`,
                date: sale.date,
                created_by: user?.id ?? null,
              })
              .select('id')
              .single();
            if (txErr) throw txErr;
            await (supabase as any).from('machine_movements').update({ transaction_id: tx.id }).eq('id', mov.id);
          } else {
            rows.push({
              company_id: companyId,
              type: 'receivable',
              payment_type: 'single',
              description: `${description} (entrada)`,
              amount: down,
              due_date: sale.date,
              status: 'pending',
              client_supplier_id: sale.buyer_client_id !== 'none' ? sale.buyer_client_id : null,
              machine_movement_id: mov.id,
              created_by: user?.id ?? null,
            });
          }
        }
        const remaining = +(amount - down).toFixed(2);
        const installmentValue = +(remaining / installments).toFixed(2);
        for (let i = 0; i < installments; i++) {
          rows.push({
            company_id: companyId,
            type: 'receivable',
            payment_type: installments > 1 ? 'installment' : 'single',
            description: installments > 1 ? `${description} (${i + 1}/${installments})` : description,
            amount: installmentValue,
            due_date: dueDateForInstallment(sale.date, sale.frequency, i + 1),
            status: 'pending',
            client_supplier_id: sale.buyer_client_id !== 'none' ? sale.buyer_client_id : null,
            machine_movement_id: mov.id,
            installment_number: i + 1,
            total_installments: installments,
            created_by: user?.id ?? null,
          });
        }
        if (rows.length) {
          const { error: prErr } = await (supabase as any).from('payables_receivables').insert(rows);
          if (prErr) throw prErr;
        }
      }

      const { error: mErr } = await (supabase as any)
        .from('machines')
        .update({ status: 'vendida' })
        .eq('id', machine.id);
      if (mErr) throw mErr;

      toast.success('Venda registrada — item removido do inventário ativo');
      onDone();
      resetAndClose();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao registrar venda');
    } finally {
      setSaving(false);
    }
  };

  const saveWriteOff = async () => {
    if (!machine) return;
    if (!writeOff.reason.trim()) return toast.error('Informe o motivo da baixa');
    setSaving(true);
    try {
      const { error } = await (supabase as any).from('machine_movements').insert({
        company_id: companyId,
        machine_id: machine.id,
        movement_type: 'baixa',
        movement_date: writeOff.date,
        reason: writeOff.reason.trim(),
        notes: writeOff.notes || null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      const { error: mErr } = await (supabase as any)
        .from('machines')
        .update({ status: 'baixada', technical_status: 'descarte' })
        .eq('id', machine.id);
      if (mErr) throw mErr;
      toast.success('Baixa registrada — item removido do inventário ativo');
      onDone();
      resetAndClose();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao registrar baixa');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!machine} onOpenChange={(o) => { if (!o) resetAndClose(); }}>
      <DialogContent className="max-w-2xl overflow-y-auto max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Movimentação — {machine?.name}</DialogTitle>
          <DialogDescription>Registre a venda ou a baixa do item. Em ambos os casos ele sai do inventário ativo e passa a constar no relatório de vendidos e baixados.</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v: any) => setTab(v)}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="venda">Venda</TabsTrigger>
            <TabsTrigger value="baixa">Baixa simples</TabsTrigger>
          </TabsList>

          <TabsContent value="venda" className="space-y-3 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data da venda *</Label><Input type="date" value={sale.date} onChange={e => setSale({ ...sale, date: e.target.value })} /></div>
              <div><Label>Valor da venda *</Label><Input type="number" step="0.01" value={sale.amount} onChange={e => setSale({ ...sale, amount: e.target.value })} placeholder={machine?.sale_price ? String(machine.sale_price) : '0,00'} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Comprador (cadastrado)</Label>
                <Select value={sale.buyer_client_id} onValueChange={v => setSale({ ...sale, buyer_client_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não cadastrado</SelectItem>
                    {clientOptions.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {sale.buyer_client_id === 'none' && (
                <div><Label>Nome do comprador *</Label><Input value={sale.buyer_name} onChange={e => setSale({ ...sale, buyer_name: e.target.value })} /></div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Forma de pagamento *</Label>
                <Select value={sale.payment_mode} onValueChange={(v: any) => setSale({ ...sale, payment_mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">À vista (baixa direto na conta)</SelectItem>
                    <SelectItem value="installments">Contas a receber (parcelado)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{sale.payment_mode === 'cash' ? 'Conta de recebimento *' : 'Conta da entrada (opcional)'}</Label>
                <Select value={sale.account_id} onValueChange={v => setSale({ ...sale, account_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não informar</SelectItem>
                    {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {sale.payment_mode === 'installments' && (
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Entrada (opcional)</Label><Input type="number" step="0.01" value={sale.down_payment} onChange={e => setSale({ ...sale, down_payment: e.target.value })} placeholder="0,00" /></div>
                <div><Label>Nº de parcelas *</Label><Input type="number" min="1" value={sale.installments_count} onChange={e => setSale({ ...sale, installments_count: e.target.value })} /></div>
                <div>
                  <Label>Periodicidade</Label>
                  <Select value={sale.frequency} onValueChange={(v: any) => setSale({ ...sale, frequency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="daily">Diária</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div><Label>Observações</Label><Textarea value={sale.notes} onChange={e => setSale({ ...sale, notes: e.target.value })} /></div>
            <DialogFooter>
              <Button variant="outline" onClick={resetAndClose}>Cancelar</Button>
              <Button onClick={saveSale} disabled={saving}>{saving ? 'Salvando...' : 'Registrar venda'}</Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="baixa" className="space-y-3 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data da baixa *</Label><Input type="date" value={writeOff.date} onChange={e => setWriteOff({ ...writeOff, date: e.target.value })} /></div>
              <div><Label>Motivo *</Label><Input value={writeOff.reason} onChange={e => setWriteOff({ ...writeOff, reason: e.target.value })} placeholder="Ex.: Sucata, perda, furto, obsolescência" /></div>
            </div>
            <div><Label>Observações</Label><Textarea value={writeOff.notes} onChange={e => setWriteOff({ ...writeOff, notes: e.target.value })} /></div>
            <DialogFooter>
              <Button variant="outline" onClick={resetAndClose}>Cancelar</Button>
              <Button variant="destructive" onClick={saveWriteOff} disabled={saving}>{saving ? 'Salvando...' : 'Registrar baixa'}</Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
