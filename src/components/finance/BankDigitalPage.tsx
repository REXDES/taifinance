import { useState } from 'react';
import { Plus, Landmark, RefreshCw, FileText, Trash2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBankConnections, BankBalance, ExtractEntry } from '@/hooks/useBankConnections';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';

interface BankDigitalPageProps {
  companyId: string;
}

export function BankDigitalPage({ companyId }: BankDigitalPageProps) {
  const { connections, isLoading, testConnection, createConnection, deleteConnection, fetchBalance, fetchExtract } = useBankConnections(companyId);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', clientId: '', clientSecret: '' });
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<BankBalance | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  // Balance state per connection
  const [balances, setBalances] = useState<Record<string, BankBalance>>({});
  const [loadingBalance, setLoadingBalance] = useState<Record<string, boolean>>({});

  // Extract state
  const [extractDialog, setExtractDialog] = useState<string | null>(null);
  const [extractData, setExtractData] = useState<ExtractEntry[]>([]);
  const [extractLoading, setExtractLoading] = useState(false);
  const [extractFilters, setExtractFilters] = useState({
    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    type: '',
  });

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleTest = async () => {
    if (!createForm.clientId || !createForm.clientSecret) {
      toast.error('Preencha Client ID e Client Secret');
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testConnection(createForm.clientId, createForm.clientSecret);
      setTestResult(result.balance);
      toast.success('Conexão testada com sucesso!');
    } catch (err: any) {
      toast.error('Falha na conexão: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!createForm.name) {
      toast.error('Informe um nome para a conexão');
      return;
    }
    if (!testResult) {
      toast.error('Teste a conexão antes de salvar');
      return;
    }
    setIsSaving(true);
    try {
      await createConnection.mutateAsync({
        name: createForm.name,
        clientId: createForm.clientId,
        clientSecret: createForm.clientSecret,
        accountId: testResult.accountId || undefined,
        agency: testResult.agency || undefined,
        accountNumber: testResult.accountNumber || undefined,
      });
      setShowCreateDialog(false);
      setCreateForm({ name: '', clientId: '', clientSecret: '' });
      setTestResult(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFetchBalance = async (connId: string) => {
    setLoadingBalance(prev => ({ ...prev, [connId]: true }));
    try {
      const data = await fetchBalance(connId);
      setBalances(prev => ({ ...prev, [connId]: data }));
    } catch (err: any) {
      toast.error('Erro ao buscar saldo: ' + err.message);
    } finally {
      setLoadingBalance(prev => ({ ...prev, [connId]: false }));
    }
  };

  const handleFetchExtract = async (connId: string) => {
    setExtractLoading(true);
    try {
      const data = await fetchExtract(connId, {
        startDate: extractFilters.startDate,
        endDate: extractFilters.endDate,
        type: extractFilters.type || undefined,
      });
      const entries = Array.isArray(data) ? data : (data as any)?.items || (data as any)?.data || [];
      setExtractData(entries);
    } catch (err: any) {
      toast.error('Erro ao buscar extrato: ' + err.message);
    } finally {
      setExtractLoading(false);
    }
  };

  const handleOpenExtract = (connId: string) => {
    setExtractDialog(connId);
    setExtractData([]);
    handleFetchExtract(connId);
  };

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || value === null) return 'R$ --';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Landmark className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Banco Digital</h1>
            <p className="text-sm text-muted-foreground">Gerencie suas contas bancárias Unida BaaS</p>
          </div>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Conectar Conta
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : connections.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Landmark className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-lg">Nenhuma conta bancária conectada</p>
            <p className="text-muted-foreground text-sm mt-1">Clique em "Conectar Conta" para começar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {connections.map((conn) => {
            const balance = balances[conn.id];
            return (
              <Card key={conn.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{conn.name}</CardTitle>
                    <Badge variant="outline" className="text-xs">Ativa</Badge>
                  </div>
                  {(conn.agency || conn.account_number) && (
                    <p className="text-sm text-muted-foreground">
                      {conn.agency && `Ag: ${conn.agency}`}
                      {conn.agency && conn.account_number && ' | '}
                      {conn.account_number && `Cc: ${conn.account_number}`}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Saldo</p>
                    <p className="text-2xl font-bold text-foreground">
                      {balance ? formatCurrency(balance.balance) : 'R$ --'}
                    </p>
                    {balance?.status && (
                      <Badge variant={balance.status === 'ACTIVE' ? 'default' : 'destructive'} className="mt-1 text-xs">
                        {balance.status}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleFetchBalance(conn.id)}
                      disabled={loadingBalance[conn.id]}
                    >
                      <RefreshCw className={`w-4 h-4 mr-1 ${loadingBalance[conn.id] ? 'animate-spin' : ''}`} />
                      Saldo
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenExtract(conn.id)}
                    >
                      <FileText className="w-4 h-4 mr-1" />
                      Extrato
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteConfirm(conn.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  {conn.last_sync_at && (
                    <p className="text-xs text-muted-foreground">
                      Última sincronização: {format(new Date(conn.last_sync_at), 'dd/MM/yyyy HH:mm')}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Connection Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) {
          setCreateForm({ name: '', clientId: '', clientSecret: '' });
          setTestResult(null);
          setShowSecret(false);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar Conta Bancária</DialogTitle>
            <DialogDescription>Insira as credenciais da sua conta Unida BaaS</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da conexão</Label>
              <Input
                placeholder="Ex: Conta Principal"
                value={createForm.name}
                onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Client ID</Label>
              <Input
                placeholder="Seu Client ID"
                value={createForm.clientId}
                onChange={(e) => setCreateForm(prev => ({ ...prev, clientId: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Client Secret</Label>
              <div className="relative">
                <Input
                  type={showSecret ? 'text' : 'password'}
                  placeholder="Seu Client Secret"
                  value={createForm.clientSecret}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, clientSecret: e.target.value }))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {testResult && (
              <Card className="bg-accent/30">
                <CardContent className="pt-4 pb-3 space-y-1">
                  <p className="text-sm font-medium text-foreground">✅ Conexão validada</p>
                  {testResult.agency && <p className="text-xs text-muted-foreground">Agência: {testResult.agency}</p>}
                  {testResult.accountNumber && <p className="text-xs text-muted-foreground">Conta: {testResult.accountNumber}</p>}
                  {testResult.balance !== undefined && (
                    <p className="text-xs text-muted-foreground">Saldo: {formatCurrency(testResult.balance)}</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={handleTest} disabled={isTesting}>
              {isTesting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null}
              Testar Conexão
            </Button>
            <Button onClick={handleSave} disabled={!testResult || isSaving}>
              {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extract Dialog */}
      <Dialog open={!!extractDialog} onOpenChange={(open) => !open && setExtractDialog(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Extrato Bancário</DialogTitle>
            <DialogDescription>Movimentações da conta bancária</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Data início</Label>
              <Input
                type="date"
                value={extractFilters.startDate}
                onChange={(e) => setExtractFilters(prev => ({ ...prev, startDate: e.target.value }))}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data fim</Label>
              <Input
                type="date"
                value={extractFilters.endDate}
                onChange={(e) => setExtractFilters(prev => ({ ...prev, endDate: e.target.value }))}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={extractFilters.type} onValueChange={(v) => setExtractFilters(prev => ({ ...prev, type: v }))}>
                <SelectTrigger className="h-9 w-32">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="CREDIT">Crédito</SelectItem>
                  <SelectItem value="DEBIT">Débito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={() => extractDialog && handleFetchExtract(extractDialog)} disabled={extractLoading}>
              {extractLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Buscar'}
            </Button>
          </div>
          <div className="flex-1 overflow-auto mt-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {extractData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {extractLoading ? 'Carregando...' : 'Nenhuma movimentação encontrada'}
                    </TableCell>
                  </TableRow>
                ) : (
                  extractData.map((entry, i) => (
                    <TableRow key={entry.id || i}>
                      <TableCell className="text-sm">{entry.date ? format(new Date(entry.date), 'dd/MM/yyyy') : '--'}</TableCell>
                      <TableCell className="text-sm">{entry.description || '--'}</TableCell>
                      <TableCell>
                        <Badge variant={entry.type === 'CREDIT' ? 'default' : 'destructive'} className="text-xs">
                          {entry.type === 'CREDIT' ? 'Crédito' : 'Débito'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {formatCurrency(entry.amount)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{entry.status || '--'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Desconectar Conta</DialogTitle>
            <DialogDescription>Tem certeza que deseja desconectar esta conta bancária?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteConfirm) {
                  deleteConnection.mutate(deleteConfirm);
                  setDeleteConfirm(null);
                }
              }}
            >
              Desconectar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
