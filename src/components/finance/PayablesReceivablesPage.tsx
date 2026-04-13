import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Filter, Check, X, Loader2, UserPlus, Trash2, HelpCircle, Pencil, Sparkles, QrCode, Settings } from 'lucide-react';
import { AiCategoryHelper } from './AiCategoryHelper';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { usePayablesReceivables } from '@/hooks/usePayablesReceivables';
import { useClientsSuppliers } from '@/hooks/useClientsSuppliers';
import { useTransactionCategories } from '@/hooks/useTransactionCategories';
import { useAccounts } from '@/hooks/useAccounts';
import { useAuth } from '@/contexts/AuthContext';
import { PixQrCodeDialog } from './PixQrCodeDialog';
import { CompanySettingsDialog } from './CompanySettingsDialog';

interface PayablesReceivablesPageProps {
  companyId: string;
}

export function PayablesReceivablesPage({ companyId }: PayablesReceivablesPageProps) {
  const { user } = useAuth();
  const STORAGE_KEY = `payables_receivables_filters_${companyId}`;

  const getInitialFilters = () => {
    const defaultFilters = {
      startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
      type: '' as '' | 'payable' | 'receivable',
      status: [] as ('pending' | 'paid' | 'cancelled')[]
    };
    
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Only restore type and status, never the period
        return {
          ...defaultFilters,
          type: (parsed.type || '') as '' | 'payable' | 'receivable',
          status: (parsed.status || []) as ('pending' | 'paid' | 'cancelled')[]
        };
      }
    } catch (e) {
      console.error('Error loading filter preferences:', e);
    }
    return defaultFilters;
  };

  const initialFilters = getInitialFilters();
  const hasActiveFilters = initialFilters.type !== '' || initialFilters.status.length > 0;
  const [showFilters, setShowFilters] = useState(hasActiveFilters);
  const [filters, setFilters] = useState(initialFilters);

  // Persist filter preferences
  const updateFilters = (newFilters: typeof filters) => {
    setFilters(newFilters);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        type: newFilters.type,
        status: newFilters.status
      }));
    } catch (e) {
      console.error('Error saving filter preferences:', e);
    }
  };

  const [editingRecord, setEditingRecord] = useState<any>(null);

  const { 
    payablesReceivables, 
    loading, 
    totalPayable, 
    totalReceivable,
    pendingAmountCount,
    createPayableReceivable,
    updatePayableReceivable,
    effectuatePayment,
    cancelPayableReceivable,
    deletePayableReceivable,
    checkRelatedRecords
  } = usePayablesReceivables(companyId, {
    startDate: filters.startDate,
    endDate: filters.endDate,
    type: filters.type || undefined,
    status: filters.status.length > 0 ? filters.status : undefined
  });

  const { clientsSuppliers, createClientSupplier } = useClientsSuppliers(companyId);
  const { categories } = useTransactionCategories(companyId);
  const { accounts } = useAccounts(companyId);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [isEffectuateDialogOpen, setIsEffectuateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteDialogData, setDeleteDialogData] = useState<{
    id: string;
    hasRelated: boolean;
    count: number;
    type: 'installment' | 'recurring' | null;
  } | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [isPixDialogOpen, setIsPixDialogOpen] = useState(false);
  const [pixRecord, setPixRecord] = useState<any>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [formData, setFormData] = useState({
    type: 'payable' as 'payable' | 'receivable',
    payment_type: 'single' as 'single' | 'installment' | 'recurring',
    description: '',
    amount: '',
    is_amount_pending: false,
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
    if (!formData.description || !formData.due_date) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    // Validar valor apenas se não for valor pendente
    if (!formData.is_amount_pending && !formData.amount) {
      toast.error('Preencha o valor ou marque "Valor a definir"');
      return;
    }

    try {
      setSaving(true);
      
      if (editingRecord) {
        // Update existing record
        await updatePayableReceivable(editingRecord.id, {
          type: formData.type,
          description: formData.description,
          amount: formData.is_amount_pending ? null : parseFloat(formData.amount),
          is_amount_pending: formData.is_amount_pending,
          due_date: formData.due_date,
          category_id: formData.category_id || null,
          subcategory_id: formData.subcategory_id || null,
          client_supplier_id: formData.client_supplier_id || null
        });
        toast.success('Conta atualizada com sucesso!');
      } else {
        // Create new record
        await createPayableReceivable(
          {
            company_id: companyId,
            type: formData.type,
            payment_type: formData.payment_type,
            description: formData.description,
            amount: formData.is_amount_pending ? null : parseFloat(formData.amount),
            is_amount_pending: formData.is_amount_pending,
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
      }
      
      setIsDialogOpen(false);
      setEditingRecord(null);
      resetForm();
    } catch (error) {
      console.error(error);
      toast.error(editingRecord ? 'Erro ao atualizar conta' : 'Erro ao criar conta');
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = (record: any) => {
    setEditingRecord(record);
    setFormData({
      type: record.type,
      payment_type: record.payment_type,
      description: record.description,
      amount: record.amount ? String(record.amount) : '',
      is_amount_pending: record.is_amount_pending,
      due_date: record.due_date,
      category_id: record.category_id || '',
      subcategory_id: record.subcategory_id || '',
      client_supplier_id: record.client_supplier_id || '',
      installments: '2'
    });
    setIsDialogOpen(true);
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

  const handleDeleteClick = async (record: any) => {
    try {
      const related = await checkRelatedRecords(record.id);
      if (related.hasRelated) {
        setDeleteDialogData({
          id: record.id,
          hasRelated: related.hasRelated,
          count: related.count,
          type: related.type
        });
        setIsDeleteDialogOpen(true);
      } else {
        // No related records, delete directly
        await deletePayableReceivable(record.id, false);
        toast.success('Conta excluída com sucesso');
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir conta');
    }
  };

  const handleDeleteConfirm = async (deleteRelated: boolean) => {
    if (!deleteDialogData) return;
    
    try {
      setSaving(true);
      await deletePayableReceivable(deleteDialogData.id, deleteRelated);
      toast.success(deleteRelated 
        ? 'Conta e registros futuros excluídos com sucesso' 
        : 'Conta excluída com sucesso'
      );
      setIsDeleteDialogOpen(false);
      setDeleteDialogData(null);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir conta');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      type: 'payable',
      payment_type: 'single',
      description: '',
      amount: '',
      is_amount_pending: false,
      due_date: format(new Date(), 'yyyy-MM-dd'),
      category_id: '',
      subcategory_id: '',
      client_supplier_id: '',
      installments: '2'
    });
    setEditingRecord(null);
  };

  const openEffectuateDialog = (record: any) => {
    setSelectedRecord(record);
    setEffectuateFormData({
      // Se valor pendente, iniciar vazio; senão, usar valor original
      paid_amount: record.is_amount_pending ? '' : String(record.amount),
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
          <Button variant="outline" onClick={() => setIsSettingsOpen(true)} title="Configurações da empresa">
            <Settings className="h-4 w-4 mr-2" />
            Configurações
          </Button>
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
              <Select value={filters.type || "all"} onValueChange={(v) => updateFilters({ ...filters, type: v === "all" ? "" : v as any })}>
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
              <div className="flex flex-wrap gap-3 mt-2">
                {[
                  { value: 'pending', label: 'Pendente' },
                  { value: 'paid', label: 'Pago' },
                  { value: 'cancelled', label: 'Cancelado' }
                ].map((status) => (
                  <div key={status.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`status-${status.value}`}
                      checked={filters.status.includes(status.value as any)}
                      onCheckedChange={(checked) => {
                        const newStatus = checked 
                          ? [...filters.status, status.value as 'pending' | 'paid' | 'cancelled']
                          : filters.status.filter(s => s !== status.value);
                        updateFilters({ ...filters, status: newStatus });
                      }}
                    />
                    <label
                      htmlFor={`status-${status.value}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {status.label}
                    </label>
                  </div>
                ))}
              </div>
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
          {pendingAmountCount > 0 && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <HelpCircle className="h-3 w-3" />
              {pendingAmountCount} conta(s) sem valor definido
            </p>
          )}
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
                    {record.is_amount_pending ? (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                        <HelpCircle className="h-3 w-3 mr-1" />
                        A definir
                      </Badge>
                    ) : (
                      formatCurrency(Number(record.amount))
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(record.status)}</TableCell>
                  <TableCell className="text-right">
                    {record.status === 'pending' && (
                      <div className="flex justify-end gap-2">
                        {record.type === 'receivable' && !record.is_amount_pending && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-primary hover:text-primary"
                            onClick={() => {
                              setPixRecord(record);
                              setIsPixDialogOpen(true);
                            }}
                            title="Gerar PIX"
                          >
                            <QrCode className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(record)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 hover:text-green-700"
                          onClick={() => openEffectuateDialog(record)}
                          title="Efetivar"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleCancel(record.id)}
                          title="Cancelar"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteClick(record)}
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
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

      {/* Dialog para criar/editar conta */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) {
          setEditingRecord(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{editingRecord ? 'Editar Conta' : 'Nova Conta'}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
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
              {!editingRecord && (
                <>
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
                </>
              )}
              <div>
                <Label>Descrição *</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descrição da conta"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Valor Total {!formData.is_amount_pending && '*'}</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="is_amount_pending"
                      checked={formData.is_amount_pending}
                      onCheckedChange={(checked) => setFormData(prev => ({ 
                        ...prev, 
                        is_amount_pending: !!checked,
                        amount: checked ? '' : prev.amount
                      }))}
                    />
                    <Label htmlFor="is_amount_pending" className="text-xs text-muted-foreground cursor-pointer">
                      Valor a definir
                    </Label>
                  </div>
                </div>
                {formData.is_amount_pending ? (
                  <div className="flex items-center gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/30">
                    <HelpCircle className="h-4 w-4 text-amber-600" />
                    <span className="text-sm text-amber-600">
                      O valor será informado na efetivação
                    </span>
                  </div>
                ) : (
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0,00"
                  />
                )}
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
                <div className="flex items-center justify-between mb-1">
                  <Label>Categoria</Label>
                  <AiCategoryHelper
                    type={formData.type === 'payable' ? 'expense' : 'income'}
                    categories={filteredCategories}
                    initialDescription={formData.description}
                    onSelectCategory={(categoryId, subcategoryId) => {
                      if (subcategoryId) {
                        setFormData(prev => ({
                          ...prev,
                          category_id: categoryId,
                          subcategory_id: subcategoryId,
                        }));
                      } else {
                        setFormData(prev => ({
                          ...prev,
                          category_id: categoryId,
                          subcategory_id: '',
                        }));
                      }
                    }}
                    trigger={
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        Ajude-me
                      </button>
                    }
                  />
                </div>
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
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => {
              setIsDialogOpen(false);
              setEditingRecord(null);
              resetForm();
            }}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingRecord ? 'Atualizar' : 'Salvar'}
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
            {selectedRecord?.is_amount_pending && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/30">
                <HelpCircle className="h-4 w-4 text-amber-600" />
                <span className="text-sm text-amber-600">
                  Esta conta foi criada sem valor definido. Informe o valor real abaixo.
                </span>
              </div>
            )}
            <div>
              <Label>Valor {selectedRecord?.is_amount_pending ? '(informe o valor real) *' : '*'}</Label>
              <Input
                type="number"
                step="0.01"
                value={effectuateFormData.paid_amount}
                onChange={(e) => setEffectuateFormData(prev => ({ ...prev, paid_amount: e.target.value }))}
                placeholder={selectedRecord?.is_amount_pending ? 'Informe o valor' : '0,00'}
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

      {/* Dialog para confirmar exclusão com parcelas/recorrência */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Conta</DialogTitle>
            <DialogDescription>
              {deleteDialogData?.type === 'installment' && (
                <>
                  Esta conta faz parte de um parcelamento. Existem <strong>{deleteDialogData.count}</strong> parcela(s) futura(s) pendente(s).
                  <br /><br />
                  Deseja excluir apenas esta parcela ou todas as parcelas futuras?
                </>
              )}
              {deleteDialogData?.type === 'recurring' && (
                <>
                  Esta é uma conta recorrente. Existem <strong>{deleteDialogData.count}</strong> ocorrência(s) futura(s) pendente(s).
                  <br /><br />
                  Deseja excluir apenas esta ocorrência ou todas as futuras?
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="secondary" 
              onClick={() => handleDeleteConfirm(false)}
              disabled={saving}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir Apenas Esta
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => handleDeleteConfirm(true)}
              disabled={saving}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir Todas Futuras
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PixQrCodeDialog
        open={isPixDialogOpen}
        onOpenChange={setIsPixDialogOpen}
        companyId={companyId}
        record={pixRecord}
      />

      <CompanySettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        companyId={companyId}
      />
    </div>
  );
}
