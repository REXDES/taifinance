import { useState } from 'react';
import { useAccounts, Account, AccountGroup } from '@/hooks/useAccounts';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Pencil, Trash2, FolderPlus } from 'lucide-react';

interface AccountsPageProps {
  companyId: string;
}

export function AccountsPage({ companyId }: AccountsPageProps) {
  const {
    accounts,
    groups,
    loading,
    totalAtivo,
    totalPassivo,
    totalGeral,
    createAccount,
    updateAccount,
    deleteAccount,
    createGroup,
    updateGroup,
    deleteGroup,
  } = useAccounts(companyId);

  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editingGroup, setEditingGroup] = useState<AccountGroup | null>(null);

  const [accountForm, setAccountForm] = useState({
    name: '',
    description: '',
    group_id: '',
    initial_balance: '',
    color: '#10B981',
  });

  const [groupForm, setGroupForm] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
    type: 'ativo' as 'ativo' | 'passivo',
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleSaveAccount = async () => {
    if (editingAccount) {
      const newInitialBalance = parseFloat(accountForm.initial_balance) || 0;
      const balanceDiff = newInitialBalance - editingAccount.initial_balance;
      await updateAccount(editingAccount.id, {
        name: accountForm.name,
        description: accountForm.description || null,
        group_id: accountForm.group_id || null,
        color: accountForm.color,
        initial_balance: newInitialBalance,
        current_balance: editingAccount.current_balance + balanceDiff,
      });
    } else {
      await createAccount({
        name: accountForm.name,
        description: accountForm.description,
        group_id: accountForm.group_id || undefined,
        initial_balance: parseFloat(accountForm.initial_balance) || 0,
        color: accountForm.color,
      });
    }
    setShowAccountDialog(false);
    setEditingAccount(null);
    setAccountForm({ name: '', description: '', group_id: '', initial_balance: '', color: '#10B981' });
  };

  const handleEditAccount = (account: Account) => {
    setEditingAccount(account);
    setAccountForm({
      name: account.name,
      description: account.description || '',
      group_id: account.group_id || '',
      initial_balance: account.initial_balance.toString(),
      color: account.color,
    });
    setShowAccountDialog(true);
  };

  const handleDeleteAccount = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta conta?')) {
      await deleteAccount(id);
    }
  };

  const handleSaveGroup = async () => {
    if (editingGroup) {
      await updateGroup(editingGroup.id, {
        name: groupForm.name,
        description: groupForm.description || null,
        color: groupForm.color,
        type: groupForm.type,
      });
    } else {
      await createGroup({
        name: groupForm.name,
        description: groupForm.description,
        color: groupForm.color,
        type: groupForm.type,
      });
    }
    setShowGroupDialog(false);
    setEditingGroup(null);
    setGroupForm({ name: '', description: '', color: '#3B82F6', type: 'ativo' });
  };

  const handleEditGroup = (group: AccountGroup) => {
    setEditingGroup(group);
    setGroupForm({
      name: group.name,
      description: group.description || '',
      color: group.color,
      type: group.type || 'ativo',
    });
    setShowGroupDialog(true);
  };

  const handleDeleteGroup = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este grupo?')) {
      await deleteGroup(id);
    }
  };

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
          <h1 className="text-2xl font-bold text-foreground">Contas</h1>
          <p className="text-muted-foreground">Gerencie suas contas financeiras</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showGroupDialog} onOpenChange={setShowGroupDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={() => {
                setEditingGroup(null);
                setGroupForm({ name: '', description: '', color: '#3B82F6', type: 'ativo' });
              }}>
                <FolderPlus className="w-4 h-4 mr-2" />
                Novo Grupo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingGroup ? 'Editar Grupo' : 'Novo Grupo'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome</Label>
                  <Input
                    value={groupForm.name}
                    onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                    placeholder="Ex: Bancos"
                  />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Input
                    value={groupForm.description}
                    onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                    placeholder="Descrição opcional"
                  />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select
                    value={groupForm.type}
                    onValueChange={(value: 'ativo' | 'passivo') => setGroupForm({ ...groupForm, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="passivo">Passivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Cor</Label>
                  <Input
                    type="color"
                    value={groupForm.color}
                    onChange={(e) => setGroupForm({ ...groupForm, color: e.target.value })}
                  />
                </div>
                <Button onClick={handleSaveGroup} className="w-full">
                  {editingGroup ? 'Salvar' : 'Criar Grupo'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showAccountDialog} onOpenChange={setShowAccountDialog}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingAccount(null);
                setAccountForm({ name: '', description: '', group_id: '', initial_balance: '', color: '#10B981' });
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Nova Conta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingAccount ? 'Editar Conta' : 'Nova Conta'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome</Label>
                  <Input
                    value={accountForm.name}
                    onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                    placeholder="Ex: Banco do Brasil"
                  />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Input
                    value={accountForm.description}
                    onChange={(e) => setAccountForm({ ...accountForm, description: e.target.value })}
                    placeholder="Descrição opcional"
                  />
                </div>
                <div>
                  <Label>Grupo</Label>
                  <Select
                    value={accountForm.group_id}
                    onValueChange={(value) => setAccountForm({ ...accountForm, group_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um grupo (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem grupo</SelectItem>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Saldo Inicial</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={accountForm.initial_balance}
                    onChange={(e) => setAccountForm({ ...accountForm, initial_balance: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <Label>Cor</Label>
                  <Input
                    type="color"
                    value={accountForm.color}
                    onChange={(e) => setAccountForm({ ...accountForm, color: e.target.value })}
                  />
                </div>
                <Button onClick={handleSaveAccount} className="w-full">
                  {editingAccount ? 'Salvar' : 'Criar Conta'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Total Balance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Geral</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-3xl font-bold ${totalAtivo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(totalAtivo)}
          </div>
          <div className="mt-3 space-y-1">
            <p className="text-sm text-muted-foreground flex justify-between">
              <span>Passivo:</span>
              <span className={totalPassivo >= 0 ? 'text-red-500' : 'text-green-500'}>{formatCurrency(totalPassivo)}</span>
            </p>
            <p className="text-sm font-medium flex justify-between border-t pt-1">
              <span>Total Geral:</span>
              <span className={totalGeral >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(totalGeral)}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Groups */}
      {groups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Grupos de Contas</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Contas</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: group.color }}
                        />
                        {group.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-1 rounded ${group.type === 'ativo' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                        {group.type === 'ativo' ? 'Ativo' : 'Passivo'}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{group.description || '-'}</TableCell>
                    <TableCell>{accounts.filter(a => a.group_id === group.id).length}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEditGroup(group)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteGroup(group.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Accounts */}
      <Card>
        <CardHeader>
          <CardTitle>Contas</CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Nenhuma conta cadastrada. Clique em "Nova Conta" para adicionar.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Saldo Inicial</TableHead>
                  <TableHead>Saldo Atual</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: account.color }}
                        />
                        <div>
                          <p className="font-medium">{account.name}</p>
                          {account.description && (
                            <p className="text-xs text-muted-foreground">{account.description}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{account.group?.name || '-'}</TableCell>
                    <TableCell>{formatCurrency(Number(account.initial_balance))}</TableCell>
                    <TableCell className={Number(account.current_balance) >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {formatCurrency(Number(account.current_balance))}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEditAccount(account)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteAccount(account.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
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
