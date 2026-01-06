import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuditLogs } from '@/hooks/useAuditLogs';
import { useCompanies } from '@/hooks/useCompanies';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Filter, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const actionLabels: Record<string, string> = {
  invitation_created: 'Convite Criado',
  invitation_deleted: 'Convite Excluído',
  company_created: 'Empresa Criada',
  company_updated: 'Empresa Atualizada',
  company_deleted: 'Empresa Excluída',
  user_role_updated: 'Função Atualizada',
  user_removed: 'Usuário Removido',
  user_permissions_updated: 'Permissões Atualizadas',
};

const actionColors: Record<string, string> = {
  invitation_created: 'bg-green-500/10 text-green-600 border-green-500/20',
  invitation_deleted: 'bg-red-500/10 text-red-600 border-red-500/20',
  company_created: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  company_updated: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  company_deleted: 'bg-red-500/10 text-red-600 border-red-500/20',
  user_role_updated: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  user_removed: 'bg-red-500/10 text-red-600 border-red-500/20',
  user_permissions_updated: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
};

const entityLabels: Record<string, string> = {
  invitation: 'Convite',
  company: 'Empresa',
  user: 'Usuário',
  user_role: 'Função de Usuário',
};

export function AuditLogsPage() {
  const { companies } = useCompanies();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  const { logs, loading, refetch } = useAuditLogs({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    action: selectedAction || undefined,
    companyId: selectedCompanyId || undefined,
  });

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedAction('');
    setSelectedCompanyId('');
  };

  const hasFilters = startDate || endDate || selectedAction || selectedCompanyId;

  const formatDetails = (details: unknown): string => {
    if (!details || typeof details !== 'object') return '-';
    
    const d = details as Record<string, unknown>;
    const parts: string[] = [];
    
    if (d.email) parts.push(`Email: ${d.email}`);
    if (d.name) parts.push(`Nome: ${d.name}`);
    if (d.role) parts.push(`Função: ${d.role}`);
    if (d.company_name) parts.push(`Empresa: ${d.company_name}`);
    if (d.old_role && d.new_role) {
      parts.push(`${d.old_role} → ${d.new_role}`);
    }
    
    return parts.length > 0 ? parts.join(' | ') : '-';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Logs de Auditoria</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filtros
            {hasFilters && (
              <Badge variant="secondary" className="ml-2">
                {[startDate, endDate, selectedAction, selectedCompanyId].filter(Boolean).length}
              </Badge>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {showFilters && (
        <Card>
          <CardHeader className="py-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Filtros</CardTitle>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="w-4 h-4 mr-1" />
                  Limpar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Data Inicial</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Data Final</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Ação</Label>
              <Select value={selectedAction} onValueChange={setSelectedAction}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as ações" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas as ações</SelectItem>
                  {Object.entries(actionLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as empresas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas as empresas</SelectItem>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              Nenhum log encontrado
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-280px)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Entidade</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {log.user_name || 'Usuário'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {log.user_email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={actionColors[log.action] || 'bg-muted'}
                        >
                          {actionLabels[log.action] || log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {entityLabels[log.entity_type] || log.entity_type}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.company_name || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {formatDetails(log.details)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">
        {logs.length} {logs.length === 1 ? 'registro encontrado' : 'registros encontrados'}
      </div>
    </div>
  );
}
