import { useState } from 'react';
import { useClientsSuppliers, ClientSupplier } from '@/hooks/useClientsSuppliers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Badge } from '@/components/ui/badge';
import { Plus, MoreHorizontal, Pencil, Trash2, Search, Users, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { DeleteConfirmDialog } from '@/components/dialogs/DeleteConfirmDialog';

interface ClientsSuppliersPageProps {
  companyId: string;
}

export function ClientsSuppliersPage({ companyId }: ClientsSuppliersPageProps) {
  const { clientsSuppliers, loading, createClientSupplier, updateClientSupplier, deleteClientSupplier } = useClientsSuppliers(companyId);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ClientSupplier | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'client' | 'supplier' | 'both'>('all');
  const [deleteTarget, setDeleteTarget] = useState<ClientSupplier | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'client' as 'client' | 'supplier' | 'both',
    document: '',
    email: '',
    phone: '',
    whatsapp_phone: '',
    notes: '',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'client',
      document: '',
      email: '',
      phone: '',
      whatsapp_phone: '',
      notes: '',
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
        whatsapp_phone: (item as any).whatsapp_phone || '',
        notes: item.notes || '',
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

    try {
      if (editingItem) {
        await updateClientSupplier(editingItem.id, {
          name: formData.name.trim(),
          type: formData.type,
          document: formData.document.trim() || null,
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          whatsapp_phone: formData.whatsapp_phone.trim() || null,
          notes: formData.notes.trim() || null,
        } as any);
        toast.success('Cliente/Fornecedor atualizado');
      } else {
        await createClientSupplier({
          company_id: companyId,
          name: formData.name.trim(),
          type: formData.type,
          document: formData.document.trim() || null,
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          whatsapp_phone: formData.whatsapp_phone.trim() || null,
          notes: formData.notes.trim() || null,
          created_by: null,
        } as any);
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
    
    return matchesSearch && matchesType;
  });

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
          <p className="text-muted-foreground">Gerencie seus clientes e fornecedores</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Cadastro
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
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
          </div>
        </CardHeader>
        <CardContent>
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchTerm || filterType !== 'all' 
                  ? 'Nenhum resultado encontrado' 
                  : 'Nenhum cliente ou fornecedor cadastrado'}
              </p>
              {!searchTerm && filterType === 'all' && (
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
                      {(item as any).whatsapp_phone ? (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-green-600" />
                          {(item as any).whatsapp_phone}
                        </span>
                      ) : '-'}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Editar Cliente/Fornecedor' : 'Novo Cliente/Fornecedor'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
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
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Observações adicionais..."
                rows={3}
              />
            </div>
          </div>

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

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir cliente/fornecedor"
        itemName={deleteTarget?.name}
        itemType={deleteTarget?.type === 'client' ? 'cliente' : deleteTarget?.type === 'supplier' ? 'fornecedor' : 'cadastro'}
        description={`Você está prestes a excluir "${deleteTarget?.name}" do seu cadastro.`}
        warningMessage="Contas a pagar/receber vinculadas a este cadastro podem perder a referência."
      />
    </div>
  );
}
