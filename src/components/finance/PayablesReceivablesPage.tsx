import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Filter, Check, X, Loader2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { usePayablesReceivables } from '@/hooks/usePayablesReceivables';
import { useClientsSuppliers } from '@/hooks/useClientsSuppliers';
import { useTransactionCategories } from '@/hooks/useTransactionCategories';
import { useAccounts } from '@/hooks/useAccounts';
import { useAuth } from '@/contexts/AuthContext';

interface PayablesReceivablesPageProps {
  companyId: string;
}

export function PayablesReceivablesPage({ companyId }: PayablesReceivablesPageProps) {
  const { user } = useAuth();
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    type: '' as '' | 'payable' | 'receivable',
    status: '' as '' | 'pending' | 'paid' | 'cancelled'
  });

  const { 
    payablesReceivables, 
    loading, 
    totalPayable, 
    totalReceivable,
    createPayableReceivable,
    effectuatePayment,
    cancelPayableReceivable
  } = usePayablesReceivables(companyId, {
    startDate: filters.startDate,
    endDate: filters.endDate,
    type: filters.type || undefined,
    status: filters.status || undefined
  });

  const { clientsSuppliers, createClientSupplier } = useClientsSuppliers(companyId);
  const { categories } = useTransactionCategories(companyId);
  const { accounts } = useAccounts(companyId);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [isEffectuateDialogOpen, setIsEffectuateDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    type: 'payable' as 'payable' | 'receivable',
    payment_type: 'single' as 'single' | 'installment' | 'recurring',
    description: '',
    amount: '',
    due_date: format(new Date(), 'yyyy-MM-dd'),
    category_id: '',
    subcategory_id: '',
    client_supplier_id: '',
    installments: '2'
  });

  const [clientFormData, setClientFormData] = useState({
    name: '',
    type: 'both' as 'client' | 'supplier' | 'both',
    document: '',
    email: '',
    phone: '',
    notes: ''
  });

  const [effectuateFormData, setEffectuateFormData] = useState({
    paid_amount: '',
    paid_date: format(new Date(), 'yyyy-MM-dd'),
    account_id: ''
  });

  const filteredCategories = useMemo(() => {
    const categoryType = formData.type === 'receivable' ? 'income' : 'expense';
    return categories.filter(c => c.type === categoryType);
  }, [categories, formData.type]);

  const selectedCategory = categories.find(c => c.id === formData.category_id);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handleSave = async () => {
    if (!formData.description || !formData.amount || !formData.due_date) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    try {
      setSaving(true);
      await createPayableReceivable(
        {
          company_id: companyId,
          type: formData.type,
          payment_type: formData.payment_type,
          description: formData.description,
          amount: parseFloat(formData.amount),
          due_date: formData.due_date,
          category_id: formData.category_id || null,
          subcategory_id: formData.subcategory_id || null,
          client_supplier_id: formData.client_supplier_id || null,
          status: 'pending',
          installment_number: null,
          total_installments: null,
          parent_id: null,
          paid_amount: null,
          paid_date: null,
          paid_account_id: null,
          transaction_id: null,
          created_by: user?.id || null,
          paid_by: null
        },
        formData.payment_type === 'installment' ? parseInt(formData.installments) : undefined
      );
      toast.success('Conta criada com sucesso!');
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao criar conta');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateClient = async () => {
    if (!clientFormData.name) {
      toast.error('Nome é obrigatório');
      return;
    }

    try {
      setSaving(true);
      const newClient = await createClientSupplier({
        company_id: companyId,
        name: clientFormData.name,
        type: clientFormData.type,
        document: clientFormData.document || null,
        email: clientFormData.email || null,
        phone: clientFormData.phone || null,
        notes: clientFormData.notes || null,
        created_by: user?.id || null
      });
      toast.success('Cliente/Fornecedor criado!');
      setFormData(prev => ({ ...prev, client_supplier_id: newClient.id }));
      setIsClientDialogOpen(false);
      setClientFormData({ name: '', type: 'both', document: '', email: '', phone: '', notes: '' });
    } catch (error) {
      toast.error('Erro ao criar cliente/fornecedor');
    } finally {
      setSaving(false);
    }
  };

  const handleEffectuate = async () => {
    if (!effectuateFormData.paid_amount || !effectuateFormData.account_id) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    try {
      setSaving(true);
      const transactionType = selectedRecord.type === 'receivable' ? 'income' : 'expense';
      await effectuatePayment(
        selectedRecord.id,
        parseFloat(effectuateFormData.paid_amount),
        effectuateFormData.paid_date,
        effectuateFormData.account_id,
        transactionType
      );
      toast.success('Conta efetivada com sucesso!');
      setIsEffectuateDialogOpen(false);
      setSelectedRecord(null);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao efetivar conta');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelPayableReceivable(id);
      toast.success('Conta cancelada');
    } catch (error) {
      toast.error('Erro ao cancelar conta');
    }
  };

  const resetForm = () => {
    setFormData({
      type: 'payable',
      payment_type: 'single',
      description: '',
      amount: '',
      due_date: format(new Date(), 'yyyy-MM-dd'),
      category_id: '',
      subcategory_id: '',
      client_supplier_id: '',
      installments: '2'
    });
  };

  const openEffectuateDialog = (record: any) => {
    setSelectedRecord(record);
    setEffectuateFormData({
      paid_amount: String(record.amount),
      paid_date: format(new Date(), 'yyyy-MM-dd'),
      account_id: ''
    });
    setIsEffectuateDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">Pendente</Badge>;
      case 'paid':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Pago</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">Cancelado</Badge>;
      default:
        return null;
    }
  };

  const getTypeBadge = (type: string) => {
    return type === 'payable' 
      ? <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">A Pagar</Badge>
      : <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">A Receber</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Contas a Pagar/Receber</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </Button>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Conta
          </Button>
        </div>
      </div>

      {showFilters && (
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Data Inicial</Label>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            <div>
              <Label>Data Final</Label>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={filters.type || "all"} onValueChange={(v) => setFilters(prev => ({ ...prev, type: v === "all" ? "" : v as any }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="payable">A Pagar</SelectItem>
                  <SelectItem value="receivable">A Receber</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={filters.status || "all"} onValueChange={(v) => setFilters(prev => ({ ...prev, status: v === "all" ? "" : v as any }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total a Pagar</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totalPayable)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total a Receber</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalReceivable)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Saldo Previsto</p>
          <p className={`text-2xl font-bold ${totalReceivable - totalPayable >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(totalReceivable - totalPayable)}
          </p>
        </Card>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vencimento</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Cliente/Fornecedor</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payablesReceivables.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Nenhuma conta encontrada
                </TableCell>
              </TableRow>
            ) : (
              payablesReceivables.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>{format(new Date(record.due_date), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>
                    {record.description}
                    {record.installment_number && (
                      <span className="text-xs text-muted-foreground ml-1">
                        ({record.installment_number}/{record.total_installments})
                      </span>
                    )}
                    {record.payment_type === 'recurring' && (
                      <Badge variant="outline" className="ml-2 text-xs">Recorrente</Badge>
                    )}
                  </TableCell>
                  <TableCell>{getTypeBadge(record.type)}</TableCell>
                  <TableCell>{record.client_supplier?.name || '-'}</TableCell>
                  <TableCell>
                    {record.category && (
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: record.category.color }}
                        />
                        <span>{record.category.name}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className={record.type === 'payable' ? 'text-red-600' : 'text-green-600'}>
                    {formatCurrency(Number(record.amount))}
                  </TableCell>
                  <TableCell>{getStatusBadge(record.status)}</TableCell>
                  <TableCell className="text-right">
                    {record.status === 'pending' && (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 hover:text-green-700"
                          onClick={() => openEffectuateDialog(record)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleCancel(record.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Dialog para criar nova conta */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Conta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData(prev => ({ ...prev, type: v as any, category_id: '', subcategory_id: '' }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="payable">A Pagar</SelectItem>
                  <SelectItem value="receivable">A Receber</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Modalidade</Label>
              <Select value={formData.payment_type} onValueChange={(v) => setFormData(prev => ({ ...prev, payment_type: v as any }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Única</SelectItem>
                  <SelectItem value="installment">Parcelado</SelectItem>
                  <SelectItem value="recurring">Recorrente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.payment_type === 'installment' && (
              <div>
                <Label>Número de Parcelas</Label>
                <Input
                  type="number"
                  min="2"
                  value={formData.installments}
                  onChange={(e) => setFormData(prev => ({ ...prev, installments: e.target.value }))}
                />
              </div>
            )}
            <div>
              <Label>Descrição *</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descrição da conta"
              />
            </div>
            <div>
              <Label>Valor Total *</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label>Vencimento *</Label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
              />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={formData.category_id} onValueChange={(v) => setFormData(prev => ({ ...prev, category_id: v, subcategory_id: '' }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {filteredCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedCategory?.subcategories && selectedCategory.subcategories.length > 0 && (
              <div>
                <Label>Subcategoria</Label>
                <Select value={formData.subcategory_id} onValueChange={(v) => setFormData(prev => ({ ...prev, subcategory_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedCategory.subcategories.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <div className="flex items-center justify-between">
                <Label>Cliente/Fornecedor</Label>
                <Button variant="ghost" size="sm" onClick={() => setIsClientDialogOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-1" />
                  Novo
                </Button>
              </div>
              <Select value={formData.client_supplier_id} onValueChange={(v) => setFormData(prev => ({ ...prev, client_supplier_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {clientsSuppliers.map((cs) => (
                    <SelectItem key={cs.id} value={cs.id}>{cs.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para criar cliente/fornecedor */}
      <Dialog open={isClientDialogOpen} onOpenChange={setIsClientDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Cliente/Fornecedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={clientFormData.name}
                onChange={(e) => setClientFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={clientFormData.type} onValueChange={(v) => setClientFormData(prev => ({ ...prev, type: v as any }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Cliente</SelectItem>
                  <SelectItem value="supplier">Fornecedor</SelectItem>
                  <SelectItem value="both">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>CPF/CNPJ</Label>
              <Input
                value={clientFormData.document}
                onChange={(e) => setClientFormData(prev => ({ ...prev, document: e.target.value }))}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={clientFormData.email}
                onChange={(e) => setClientFormData(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={clientFormData.phone}
                onChange={(e) => setClientFormData(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={clientFormData.notes}
                onChange={(e) => setClientFormData(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsClientDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateClient} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para efetivar pagamento */}
      <Dialog open={isEffectuateDialogOpen} onOpenChange={setIsEffectuateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Efetivar {selectedRecord?.type === 'payable' ? 'Pagamento' : 'Recebimento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Valor *</Label>
              <Input
                type="number"
                step="0.01"
                value={effectuateFormData.paid_amount}
                onChange={(e) => setEffectuateFormData(prev => ({ ...prev, paid_amount: e.target.value }))}
              />
            </div>
            <div>
              <Label>Data *</Label>
              <Input
                type="date"
                value={effectuateFormData.paid_date}
                onChange={(e) => setEffectuateFormData(prev => ({ ...prev, paid_date: e.target.value }))}
              />
            </div>
            <div>
              <Label>Conta *</Label>
              <Select value={effectuateFormData.account_id} onValueChange={(v) => setEffectuateFormData(prev => ({ ...prev, account_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEffectuateDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleEffectuate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Efetivar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
