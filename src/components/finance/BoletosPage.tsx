import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Plus,
  Barcode,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  MoreVertical,
  Trash2,
  CreditCard,
  Copy,
  Loader2,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBoletos, Boleto } from '@/hooks/useBoletos';
import { AddBoletoDialog } from './AddBoletoDialog';
import { toast } from 'sonner';

interface BoletosPageProps {
  companyId: string;
}

type TabFilter = 'all' | 'pending' | 'overdue' | 'paid';

const formatCurrency = (value: number | null) => {
  if (value === null) return <span className="text-muted-foreground italic text-sm">Valor em aberto</span>;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const StatusBadge = ({ status }: { status: Boleto['status'] }) => {
  switch (status) {
    case 'pending':
      return (
        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30 gap-1">
          <Clock className="w-3 h-3" /> Pendente
        </Badge>
      );
    case 'overdue':
      return (
        <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30 gap-1">
          <AlertTriangle className="w-3 h-3" /> Vencido
        </Badge>
      );
    case 'paid':
      return (
        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 gap-1">
          <CheckCircle2 className="w-3 h-3" /> Pago
        </Badge>
      );
    case 'cancelled':
      return (
        <Badge variant="outline" className="bg-muted text-muted-foreground border-border gap-1">
          <XCircle className="w-3 h-3" /> Cancelado
        </Badge>
      );
  }
};

interface MarkPaidDialogProps {
  boleto: Boleto | null;
  onConfirm: (amount: number, date: string) => Promise<void>;
  onClose: () => void;
}

function MarkPaidDialog({ boleto, onConfirm, onClose }: MarkPaidDialogProps) {
  const [amount, setAmount] = useState(boleto?.amount?.toFixed(2).replace('.', ',') ?? '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    const n = parseFloat(amount.replace(/\./g, '').replace(',', '.'));
    if (isNaN(n) || n <= 0) { toast.error('Informe o valor pago.'); return; }
    setLoading(true);
    await onConfirm(n, date);
    setLoading(false);
  };

  return (
    <Dialog open={!!boleto} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
          <DialogDescription>
            {boleto?.description || boleto?.recipient || 'Boleto'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Valor pago (R$)</Label>
            <Input
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Data do pagamento</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirmar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BoletosPage({ companyId }: BoletosPageProps) {
  const [tab, setTab] = useState<TabFilter>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [markPaidBoleto, setMarkPaidBoleto] = useState<Boleto | null>(null);

  const statusFilter = tab === 'all' ? undefined : [tab as Boleto['status']];
  const { boletos, loading, counts, createBoleto, markAsPaid, deleteBoleto, updateBoleto } = useBoletos(
    companyId,
    { status: statusFilter }
  );

  const handleCreate = async (data: Parameters<typeof createBoleto>[0]) => {
    return createBoleto(data);
  };

  const handleMarkPaid = async (amount: number, date: string) => {
    if (!markPaidBoleto) return;
    await markAsPaid(markPaidBoleto.id, amount, date);
    setMarkPaidBoleto(null);
  };

  const handleCopyBarcode = (barcode: string) => {
    navigator.clipboard.writeText(barcode).then(
      () => toast.success('Código copiado!'),
      () => toast.error('Não foi possível copiar.')
    );
  };

  const totalPending = boletos
    .filter(b => b.status === 'pending' || b.status === 'overdue')
    .reduce((s, b) => s + (b.amount ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Central de Boletos</h1>
          {totalPending > 0 && (
            <p className="text-sm text-muted-foreground">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPending)} a pagar
            </p>
          )}
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Adicionar boleto</span>
          <span className="sm:hidden">Novo</span>
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Pendentes', count: counts.pending, color: 'text-yellow-600', icon: <Clock className="w-4 h-4" /> },
          { label: 'Vencidos', count: counts.overdue, color: 'text-red-600', icon: <AlertTriangle className="w-4 h-4" /> },
          { label: 'Pagos', count: counts.paid, color: 'text-green-600', icon: <CheckCircle2 className="w-4 h-4" /> },
          { label: 'Total', count: counts.all, color: 'text-foreground', icon: <Barcode className="w-4 h-4" /> },
        ].map(c => (
          <div key={c.label} className="rounded-lg border bg-card p-3 flex items-center gap-3">
            <span className={c.color}>{c.icon}</span>
            <div>
              <p className="text-2xl font-bold leading-tight">{c.count}</p>
              <p className="text-xs text-muted-foreground">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={v => setTab(v as TabFilter)}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="all" className="flex-1 sm:flex-none">Todos</TabsTrigger>
          <TabsTrigger value="pending" className="flex-1 sm:flex-none">
            Pendentes
            {counts.pending > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs h-4 px-1">{counts.pending}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="overdue" className="flex-1 sm:flex-none">
            Vencidos
            {counts.overdue > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs h-4 px-1 bg-red-500/10 text-red-600">{counts.overdue}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="paid" className="flex-1 sm:flex-none">Pagos</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : boletos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <Barcode className="w-12 h-12 text-muted-foreground/30" />
          <div>
            <p className="font-medium text-muted-foreground">Nenhum boleto encontrado</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              {tab === 'all' ? 'Adicione o primeiro boleto clicando em "Adicionar boleto".' : 'Nenhum boleto neste status.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {boletos.map(boleto => (
            <BoletoCard
              key={boleto.id}
              boleto={boleto}
              onMarkPaid={() => setMarkPaidBoleto(boleto)}
              onCancelBoleto={() => updateBoleto(boleto.id, { status: 'cancelled' })}
              onDelete={() => deleteBoleto(boleto.id)}
              onCopyBarcode={() => handleCopyBarcode(boleto.barcode)}
            />
          ))}
        </div>
      )}

      <AddBoletoDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={handleCreate}
      />

      <MarkPaidDialog
        boleto={markPaidBoleto}
        onConfirm={handleMarkPaid}
        onClose={() => setMarkPaidBoleto(null)}
      />
    </div>
  );
}

interface BoletoCardProps {
  boleto: Boleto;
  onMarkPaid: () => void;
  onCancelBoleto: () => void;
  onDelete: () => void;
  onCopyBarcode: () => void;
}

function BoletoCard({ boleto, onMarkPaid, onCancelBoleto, onDelete, onCopyBarcode }: BoletoCardProps) {
  const isActionable = boleto.status === 'pending' || boleto.status === 'overdue';

  const dueDateLabel = boleto.due_date
    ? format(parseISO(boleto.due_date), "d 'de' MMM 'de' yyyy", { locale: ptBR })
    : null;

  return (
    <div className="rounded-lg border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      {/* Icon */}
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
        boleto.status === 'overdue' ? 'bg-red-500/10' :
        boleto.status === 'paid' ? 'bg-green-500/10' :
        boleto.status === 'cancelled' ? 'bg-muted' :
        'bg-yellow-500/10'
      }`}>
        <Barcode className={`w-5 h-5 ${
          boleto.status === 'overdue' ? 'text-red-600' :
          boleto.status === 'paid' ? 'text-green-600' :
          boleto.status === 'cancelled' ? 'text-muted-foreground' :
          'text-yellow-600'
        }`} />
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-sm leading-tight truncate">
            {boleto.description || boleto.recipient || 'Boleto sem descrição'}
          </p>
          <StatusBadge status={boleto.status} />
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {boleto.recipient && boleto.description && (
            <span className="flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              {boleto.recipient}
            </span>
          )}
          {boleto.bank_name && (
            <span className="flex items-center gap-1">
              <CreditCard className="w-3 h-3" />
              {boleto.bank_name}
            </span>
          )}
          {dueDateLabel && (
            <span className={boleto.status === 'overdue' ? 'text-red-600 font-medium' : ''}>
              Vence {dueDateLabel}
            </span>
          )}
          {boleto.status === 'paid' && boleto.paid_at && (
            <span className="text-green-600">
              Pago em {format(parseISO(boleto.paid_at), "d/MM/yyyy")}
            </span>
          )}
        </div>
      </div>

      {/* Amount + actions */}
      <div className="flex items-center gap-3 sm:flex-col sm:items-end shrink-0">
        <div className="text-right">
          <p className={`font-semibold text-sm ${boleto.status === 'paid' ? 'text-green-600' : ''}`}>
            {formatCurrency(boleto.status === 'paid' && boleto.paid_amount !== null ? boleto.paid_amount : boleto.amount)}
          </p>
        </div>

        <div className="flex items-center gap-1">
          {isActionable && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs h-7"
              onClick={onMarkPaid}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Pagar</span>
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onCopyBarcode} className="gap-2">
                <Copy className="w-4 h-4" />
                Copiar código
              </DropdownMenuItem>
              {isActionable && (
                <DropdownMenuItem onClick={onMarkPaid} className="gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Registrar pagamento
                </DropdownMenuItem>
              )}
              {isActionable && (
                <DropdownMenuItem onClick={onCancelBoleto} className="gap-2">
                  <XCircle className="w-4 h-4" />
                  Cancelar boleto
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="gap-2 text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
