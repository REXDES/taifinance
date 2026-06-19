import { useState, useMemo } from 'react';
import { useTransfers, Transfer } from '@/hooks/useTransfers';
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
import { Plus, Trash2, ArrowRight, Filter } from 'lucide-react';
import { DeleteConfirmDialog } from '@/components/dialogs/DeleteConfirmDialog';
import { TagPicker } from './TagPicker';
import TagBadges from './TagBadges';
import { useRecordTags } from '@/hooks/useRecordTags';
import { setEntityTags, findRecordIdsByTags } from '@/hooks/useFinanceTags';

interface TransfersPageProps {
  companyId: string;
}

export function TransfersPage({ companyId }: TransfersPageProps) {
  const { transfers, loading, createTransfer, deleteTransfer } = useTransfers(companyId);
  const { accounts } = useAccounts(companyId);
  const [showDialog, setShowDialog] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Transfer | null>(null);
  const [filters, setFilters] = useState<{
    startDate?: string;
    endDate?: string;
    accountId?: string;
  }>({});
  const [form, setForm] = useState({
    from_account_id: '',
    to_account_id: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    tags: [] as string[],
  });
  const [tagRefresh, setTagRefresh] = useState(0);
  const [filterTagIds, setFilterTagIdsRaw] = useState<string[]>([]);
  const [tagFilteredIds, setTagFilteredIds] = useState<Set<string> | null>(null);
  const setFilterTagIds = async (ids: string[]) => {
    setFilterTagIdsRaw(ids);
    if (ids.length === 0) { setTagFilteredIds(null); return; }
    try {
      const recs = await findRecordIdsByTags('transfer', ids);
      setTagFilteredIds(new Set(recs));
    } catch { setTagFilteredIds(new Set()); }
  };
  const recordTags = useRecordTags('transfer', transfers.map(t => t.id), tagRefresh);

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const filteredTransfers = useMemo(() => {
    return transfers.filter(t => {
      const transferDate = new Date(t.date + 'T00:00:00');
      
      if (filters.startDate) {
        const startDate = new Date(filters.startDate + 'T00:00:00');
        if (transferDate < startDate) return false;
      }
      
      if (filters.endDate) {
        const endDate = new Date(filters.endDate + 'T00:00:00');
        if (transferDate > endDate) return false;
      }
      
      if (filters.accountId) {
        if (t.from_account_id !== filters.accountId && t.to_account_id !== filters.accountId) {
          return false;
        }
      }
      
      if (tagFilteredIds && !tagFilteredIds.has(t.id)) return false;
      return true;
    });
  }, [transfers, filters, tagFilteredIds]);

  const handleSave = async () => {
    const created = await createTransfer({
      from_account_id: form.from_account_id,
      to_account_id: form.to_account_id,
      amount: parseFloat(form.amount),
      description: form.description,
      date: form.date,
    });
    if (created && form.tags.length > 0) {
      try { await setEntityTags('transfer', (created as any).id, form.tags); } catch {}
    }
    setTagRefresh(r => r + 1);
    setShowDialog(false);
    setForm({ from_account_id: '', to_account_id: '', amount: '', description: '', date: new Date().toISOString().split('T')[0], tags: [] });
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Transferências</h1>
          <p className="text-muted-foreground">Transfira valores entre suas contas</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="w-4 h-4 mr-2" />
            Filtros
          </Button>
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
                <div>
                  <Label>Tags</Label>
                  <TagPicker companyId={companyId} value={form.tags} onChange={(ids) => setForm({ ...form, tags: ids })} placeholder="Adicionar tags..." />
                </div>
                <Button onClick={handleSave} className="w-full" disabled={!form.from_account_id || !form.to_account_id || !form.amount}>Transferir</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>Data Inicial</Label>
                <Input
                  type="date"
                  value={filters.startDate || ''}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value || undefined })}
                />
              </div>
              <div>
                <Label>Data Final</Label>
                <Input
                  type="date"
                  value={filters.endDate || ''}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value || undefined })}
                />
              </div>
              <div>
                <Label>Conta</Label>
                <Select value={filters.accountId || 'all'} onValueChange={(v) => setFilters({ ...filters, accountId: v === 'all' ? undefined : v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tags</Label>
                <TagPicker companyId={companyId} value={filterTagIds} onChange={setFilterTagIds} placeholder="Filtrar por tags..." />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="pt-4">
        {filteredTransfers.length === 0 ? <p className="text-muted-foreground text-center py-8">Nenhuma transferência encontrada.</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>De</TableHead><TableHead></TableHead><TableHead>Para</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="w-16">Ações</TableHead></TableRow></TableHeader>
            <TableBody>
              {filteredTransfers.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell>{t.from_account?.name}</TableCell>
                  <TableCell><ArrowRight className="w-4 h-4 text-muted-foreground" /></TableCell>
                  <TableCell>{t.to_account?.name}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(t.amount)}</TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => setDeleteTarget(t)}><Trash2 className="w-4 h-4 text-destructive" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent></Card>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={async () => { if (deleteTarget) { await deleteTransfer(deleteTarget.id); setDeleteTarget(null); } }}
        title="Excluir transferência"
        itemName={deleteTarget?.description || 'Transferência'}
        itemType="transferência"
        description={`Você está prestes a excluir a transferência de ${deleteTarget ? formatCurrency(deleteTarget.amount) : ''} entre contas.`}
        warningMessage="Os saldos das contas envolvidas serão recalculados automaticamente."
      />
    </div>
  );
}
