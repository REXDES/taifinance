import { useMemo, useState } from 'react';
import { useClientsSuppliers, ClientSupplier } from '@/hooks/useClientsSuppliers';
import { useClientSplit, ClientSplitRule } from '@/hooks/useClientSplit';
import { useTransactionCategories } from '@/hooks/useTransactionCategories';
import { useFinanceTags } from '@/hooks/useFinanceTags';
import type { SplitScope, SplitValueType } from '@/hooks/useSplitRules';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, MoreHorizontal, Pencil, Trash2, Search, Users, Phone, Split } from 'lucide-react';
import { toast } from 'sonner';
import { DeleteConfirmDialog } from '@/components/dialogs/DeleteConfirmDialog';

interface ClientsSuppliersPageProps {
  companyId: string;
}

const PIX_TYPES = [
  { v: 'cpf', l: 'CPF' },
  { v: 'cnpj', l: 'CNPJ' },
  { v: 'email', l: 'E-mail' },
  { v: 'phone', l: 'Telefone' },
  { v: 'random', l: 'Chave aleatória' },
];

const emptyRuleForm = {
  scope: 'global' as SplitScope,
  scope_ref_id: '',
  value_type: 'percent' as SplitValueType,
  value: 0,
  priority: 0,
  active: true,
  notes: '',
};

export function ClientsSuppliersPage({ companyId }: ClientsSuppliersPageProps) {
  const { clientsSuppliers, loading, createClientSupplier, updateClientSupplier, deleteClientSupplier } = useClientsSuppliers(companyId);
  const split = useClientSplit(companyId);
  const { categories } = useTransactionCategories(companyId);
  const { tags } = useFinanceTags(companyId);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ClientSupplier | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'client' | 'supplier' | 'both'>('all');
  const [onlyWithSplit, setOnlyWithSplit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ClientSupplier | null>(null);

  // Split rules dialog (dentro do cadastro)
  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleEditing, setRuleEditing] = useState<ClientSplitRule | null>(null);
  const [ruleForm, setRuleForm] = useState(emptyRuleForm);
  const [ruleSaving, setRuleSaving] = useState(false);
  const [ruleDelete, setRuleDelete] = useState<ClientSplitRule | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    type: 'client' as 'client' | 'supplier' | 'both',
    document: '',
    email: '',
    phone: '',
    whatsapp_phone: '',
    notes: '',
    pix_key: '',
    pix_key_type: 'cpf',
    bank_name: '',
    bank_branch: '',
    bank_account: '',
  });

  const activeSplitCount = useMemo(() => {
    const map: Record<string, number> = {};
    split.rules.forEach(r => {
      if (!r.active || !r.client_supplier_id) return;
      map[r.client_supplier_id] = (map[r.client_supplier_id] || 0) + 1;
    });
    return map;
  }, [split.rules]);

  const resetForm = () => {
    setFormData({
      name: '', type: 'client', document: '', email: '', phone: '', whatsapp_phone: '', notes: '',
      pix_key: '', pix_key_type: 'cpf', bank_name: '', bank_branch: '', bank_account: '',
    });
    setEditingItem(null);
  };

  const handleOpenDialog = (item?: ClientSupplier) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        type: item.type as 'client' | 'supplier' | 'both',
        document: item.document || '',
        email: item.email || '',
        phone: item.phone || '',
        whatsapp_phone: item.whatsapp_phone || '',
        notes: item.notes || '',
        pix_key: item.pix_key || '',
        pix_key_type: item.pix_key_type || 'cpf',
        bank_name: item.bank_name || '',
        bank_branch: item.bank_branch || '',
        bank_account: item.bank_account || '',
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    const payload = {
      name: formData.name.trim(),
      type: formData.type,
      document: formData.document.trim() || null,
      email: formData.email.trim() || null,
      phone: formData.phone.trim() || null,
      whatsapp_phone: formData.whatsapp_phone.trim() || null,
      notes: formData.notes.trim() || null,
      pix_key: formData.pix_key.trim() || null,
      pix_key_type: formData.pix_key.trim() ? formData.pix_key_type : null,
      bank_name: formData.bank_name.trim() || null,
      bank_branch: formData.bank_branch.trim() || null,
      bank_account: formData.bank_account.trim() || null,
    };

    try {
      if (editingItem) {
        await updateClientSupplier(editingItem.id, payload as any);
        await split.syncRecipient({ ...editingItem, ...payload } as ClientSupplier);
        toast.success('Cliente/Fornecedor atualizado');
      } else {
        await createClientSupplier({ company_id: companyId, ...payload, created_by: null } as any);
        toast.success('Cliente/Fornecedor criado');
      }
      handleCloseDialog();
    } catch (error) {
      toast.error('Erro ao salvar');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteClientSupplier(deleteTarget.id);
      toast.success('Excluído com sucesso');
      setDeleteTarget(null);
    } catch (error) {
      toast.error('Erro ao excluir');
    }
  };

  const openRule = (rule?: ClientSplitRule) => {
    if (rule) {
      setRuleEditing(rule);
      setRuleForm({
        scope: rule.scope, scope_ref_id: rule.scope_ref_id || '', value_type: rule.value_type,
        value: rule.value, priority: rule.priority, active: rule.active, notes: rule.notes || '',
      });
    } else {
      setRuleEditing(null);
      setRuleForm(emptyRuleForm);
    }
    setRuleOpen(true);
  };

  const saveRule = async () => {
    if (!editingItem) return;
    if (!formData.pix_key.trim()) {
      toast.error('Informe a chave PIX deste cadastro antes de criar regras.');
      return;
    }
    if (ruleForm.value <= 0) return;
    if (ruleForm.scope !== 'global' && !ruleForm.scope_ref_id) return;

    setRuleSaving(true);
    const input = {
      scope: ruleForm.scope,
      scope_ref_id: ruleForm.scope === 'global' ? null : ruleForm.scope_ref_id,
      value_type: ruleForm.value_type,
      value: Number(ruleForm.value),
      priority: Number(ruleForm.priority) || 0,
      active: ruleForm.active,
      notes: ruleForm.notes.trim() || null,
    };
    const client: ClientSupplier = {
      ...editingItem,
      name: formData.name.trim(),
      document: formData.document.trim() || null,
      pix_key: formData.pix_key.trim(),
      pix_key_type: formData.pix_key_type,
      bank_name: formData.bank_name.trim() || null,
      bank_branch: formData.bank_branch.trim() || null,
      bank_account: formData.bank_account.trim() || null,
    };
    const ok = ruleEditing
      ? await split.updateRule(ruleEditing.id, input)
      : await split.createRule(client, input);
    setRuleSaving(false);
    if (ok) setRuleOpen(false);
  };

  const scopeOptions = ruleForm.scope === 'category'
    ? categories.map(c => ({ v: c.id, l: c.name }))
    : ruleForm.scope === 'client_supplier'
    ? clientsSuppliers.map(c => ({ v: c.id, l: c.name }))
    : ruleForm.scope === 'tag'
    ? tags.map(t => ({ v: t.id, l: t.name }))
    : [];

  const scopeLabel = (rule: ClientSplitRule) => {
    if (rule.scope === 'global') return 'Todas as cobranças';
    if (rule.scope === 'category') return `Categoria: ${categories.find(c => c.id === rule.scope_ref_id)?.name || '—'}`;
    if (rule.scope === 'client_supplier') return `Cliente: ${clientsSuppliers.find(c => c.id === rule.scope_ref_id)?.name || '—'}`;
    if (rule.scope === 'tag') return `Tag: ${tags.find(t => t.id === rule.scope_ref_id)?.name || '—'}`;
    return '';
  };

  const formatValue = (rule: ClientSplitRule) =>
    rule.value_type === 'percent'
      ? `${rule.value}%`
      : `R$ ${rule.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'client': return 'Cliente';
      case 'supplier': return 'Fornecedor';
      case 'both': return 'Ambos';
      default: return type;
    }
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'client': return 'default';
      case 'supplier': return 'secondary';
      case 'both': return 'outline';
      default: return 'default';
    }
  };

  const filteredItems = clientsSuppliers.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.document?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || item.type === filterType;
    const matchesSplit = !onlyWithSplit || (activeSplitCount[item.id] || 0) > 0;
    return matchesSearch && matchesType && matchesSplit;
  });

  const editingRules = editingItem ? split.rulesFor(editingItem.id) : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes e Fornecedores</h1>
          <p className="text-muted-foreground">Cadastro, dados de PIX e regras de split</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Cadastro
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar por nome, documento ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="client">Clientes</SelectItem>
                <SelectItem value="supplier">Fornecedores</SelectItem>
                <SelectItem value="both">Ambos</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch checked={onlyWithSplit} onCheckedChange={setOnlyWithSplit} id="only-split" />
              <Label htmlFor="only-split" className="text-sm">Com split ativo</Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchTerm || filterType !== 'all' || onlyWithSplit
                  ? 'Nenhum resultado encontrado'
                  : 'Nenhum cliente ou fornecedor cadastrado'}
              </p>
              {!searchTerm && filterType === 'all' && !onlyWithSplit && (
                <Button variant="outline" className="mt-4" onClick={() => handleOpenDialog()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Cadastrar primeiro
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>PIX / Split</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <Badge variant={getTypeBadgeVariant(item.type) as any}>
                        {getTypeLabel(item.type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{item.document || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{item.email || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{item.phone || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.whatsapp_phone ? (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-green-600" />
                          {item.whatsapp_phone}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        {item.pix_key && <Badge variant="outline" className="text-[10px]">PIX</Badge>}
                        {(activeSplitCount[item.id] || 0) > 0 && (
                          <Badge variant="secondary" className="text-[10px] flex items-center gap-1">
                            <Split className="w-3 h-3" />
                            {activeSplitCount[item.id]}
                          </Badge>
                        )}
                        {!item.pix_key && !(activeSplitCount[item.id] || 0) && (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenDialog(item)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteTarget(item)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl overflow-y-auto max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Editar Cliente/Fornecedor' : 'Novo Cliente/Fornecedor'}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="data">
            <TabsList>
              <TabsTrigger value="data">Dados</TabsTrigger>
              <TabsTrigger value="split">PIX / Split</TabsTrigger>
            </TabsList>

            <TabsContent value="data" className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nome do cliente ou fornecedor"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Tipo *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, type: v as any }))}
                >
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

              <div className="space-y-2">
                <Label htmlFor="document">CPF/CNPJ</Label>
                <Input
                  id="document"
                  value={formData.document}
                  onChange={(e) => setFormData(prev => ({ ...prev, document: e.target.value }))}
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp_phone">WhatsApp</Label>
                <Input
                  id="whatsapp_phone"
                  value={formData.whatsapp_phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, whatsapp_phone: e.target.value }))}
                  placeholder="5511999999999"
                />
                <p className="text-xs text-muted-foreground">Número com código do país (ex: 5511999999999)</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Observações adicionais..."
                  rows={3}
                />
              </div>
            </TabsContent>

            <TabsContent value="split" className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de chave PIX</Label>
                  <Select
                    value={formData.pix_key_type}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, pix_key_type: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PIX_TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Chave PIX</Label>
                  <Input
                    value={formData.pix_key}
                    onChange={(e) => setFormData(prev => ({ ...prev, pix_key: e.target.value }))}
                    placeholder="Chave para receber o split"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Banco</Label>
                  <Input value={formData.bank_name} onChange={(e) => setFormData(prev => ({ ...prev, bank_name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Agência</Label>
                  <Input value={formData.bank_branch} onChange={(e) => setFormData(prev => ({ ...prev, bank_branch: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Conta</Label>
                  <Input value={formData.bank_account} onChange={(e) => setFormData(prev => ({ ...prev, bank_account: e.target.value }))} />
                </div>
              </div>

              <div className="border-t border-border pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Regras de split</p>
                    <p className="text-xs text-muted-foreground">
                      Fração dos recebimentos direcionada a este cadastro.
                    </p>
                  </div>
                  <Button size="sm" onClick={() => openRule()} disabled={!editingItem}>
                    <Plus className="w-4 h-4 mr-2" />Nova regra
                  </Button>
                </div>

                {!editingItem ? (
                  <p className="text-xs text-muted-foreground">
                    Salve o cadastro para poder criar regras de split.
                  </p>
                ) : editingRules.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma regra cadastrada.</p>
                ) : (
                  <div className="space-y-2">
                    {editingRules.map(rule => (
                      <Card key={rule.id} className="p-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">{formatValue(rule)}</Badge>
                            <Badge variant="secondary" className="text-xs">Prioridade {rule.priority}</Badge>
                            {!rule.active && <Badge variant="secondary" className="text-[10px]">Inativa</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{scopeLabel(rule)}</p>
                          {rule.notes && <p className="text-xs text-muted-foreground italic">{rule.notes}</p>}
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openRule(rule)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setRuleDelete(rule)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>
              {editingItem ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regra de split */}
      <Dialog open={ruleOpen} onOpenChange={setRuleOpen}>
        <DialogContent className="max-w-lg overflow-y-auto max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>{ruleEditing ? 'Editar regra de split' : 'Nova regra de split'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Abrangência *</Label>
                <Select
                  value={ruleForm.scope}
                  onValueChange={(v: SplitScope) => setRuleForm(f => ({ ...f, scope: v, scope_ref_id: '' }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Todas as cobranças</SelectItem>
                    <SelectItem value="category">Categoria</SelectItem>
                    <SelectItem value="client_supplier">Cliente específico</SelectItem>
                    <SelectItem value="tag">Tag</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {ruleForm.scope !== 'global' && (
                <div>
                  <Label>Referência *</Label>
                  <Select value={ruleForm.scope_ref_id} onValueChange={v => setRuleForm(f => ({ ...f, scope_ref_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {scopeOptions.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo de valor *</Label>
                <Select
                  value={ruleForm.value_type}
                  onValueChange={(v: SplitValueType) => setRuleForm(f => ({ ...f, value_type: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percentual (%)</SelectItem>
                    <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor *</Label>
                <Input type="number" min={0} step="0.01" value={ruleForm.value}
                  onChange={e => setRuleForm(f => ({ ...f, value: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prioridade</Label>
                <Input type="number" value={ruleForm.priority}
                  onChange={e => setRuleForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="flex items-center gap-2 mt-6">
                <Switch checked={ruleForm.active} onCheckedChange={v => setRuleForm(f => ({ ...f, active: v }))} />
                <Label>Ativa</Label>
              </div>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea rows={2} value={ruleForm.notes} onChange={e => setRuleForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleOpen(false)}>Cancelar</Button>
            <Button
              onClick={saveRule}
              disabled={ruleSaving || ruleForm.value <= 0 || (ruleForm.scope !== 'global' && !ruleForm.scope_ref_id)}
            >
              {ruleEditing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!ruleDelete}
        onOpenChange={(open) => !open && setRuleDelete(null)}
        onConfirm={async () => { if (ruleDelete) { await split.removeRule(ruleDelete.id); setRuleDelete(null); } }}
        title="Excluir regra de split"
        description="A regra será removida permanentemente."
      />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir cliente/fornecedor"
        itemName={deleteTarget?.name}
        itemType={deleteTarget?.type === 'client' ? 'cliente' : deleteTarget?.type === 'supplier' ? 'fornecedor' : 'cadastro'}
        description={`Você está prestes a excluir "${deleteTarget?.name}" do seu cadastro.`}
        warningMessage="Contas a pagar/receber e regras de split vinculadas a este cadastro podem perder a referência."
      />
    </div>
  );
}
