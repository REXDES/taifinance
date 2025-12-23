import { useState } from 'react';
import { useTransfers } from '@/hooks/useTransfers';
import { useAccounts } from '@/hooks/useAccounts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, ArrowRight } from 'lucide-react';

interface TransfersPageProps {
  companyId: string;
}

export function TransfersPage({ companyId }: TransfersPageProps) {
  const { transfers, loading, createTransfer, deleteTransfer } = useTransfers(companyId);
  const { accounts } = useAccounts(companyId);
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({
    from_account_id: '',
    to_account_id: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const handleSave = async () => {
    await createTransfer({
      from_account_id: form.from_account_id,
      to_account_id: form.to_account_id,
      amount: parseFloat(form.amount),
      description: form.description,
      date: form.date,
    });
    setShowDialog(false);
    setForm({ from_account_id: '', to_account_id: '', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Transferências</h1>
          <p className="text-muted-foreground">Transfira valores entre suas contas</p>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nova Transferência</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Transferência</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>De (Conta Origem) *</Label>
                <Select value={form.from_account_id} onValueChange={(v) => setForm({ ...form, from_account_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Para (Conta Destino) *</Label>
                <Select value={form.to_account_id} onValueChange={(v) => setForm({ ...form, to_account_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{accounts.filter(a => a.id !== form.from_account_id).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Valor *</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div><Label>Data *</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div><Label>Descrição</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Opcional" /></div>
              <Button onClick={handleSave} className="w-full" disabled={!form.from_account_id || !form.to_account_id || !form.amount}>Transferir</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card><CardContent className="pt-4">
        {transfers.length === 0 ? <p className="text-muted-foreground text-center py-8">Nenhuma transferência encontrada.</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>De</TableHead><TableHead></TableHead><TableHead>Para</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="w-16">Ações</TableHead></TableRow></TableHeader>
            <TableBody>
              {transfers.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{new Date(t.date).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell>{t.from_account?.name}</TableCell>
                  <TableCell><ArrowRight className="w-4 h-4 text-muted-foreground" /></TableCell>
                  <TableCell>{t.to_account?.name}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(t.amount)}</TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => confirm('Excluir?') && deleteTransfer(t.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent></Card>
    </div>
  );
}
