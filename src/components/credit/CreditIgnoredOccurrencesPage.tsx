import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ShieldAlert, CheckCircle2, XCircle, Clock, Gavel } from 'lucide-react';
import { toast } from 'sonner';

interface Props { companyId: string }

interface Row {
  id: string;
  company_id: string;
  application_id: string | null;
  documento: string;
  category: string;
  titulo: string | null;
  descricao: string | null;
  raw_record: any;
  status: 'pending' | 'approved' | 'rejected';
  request_reason: string | null;
  decision_notes: string | null;
  requested_by: string | null;
  requested_at: string;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
}

export function CreditIgnoredOccurrencesPage({ companyId }: Props) {
  const { user } = useAuth();
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});
  const [decideRow, setDecideRow] = useState<Row | null>(null);
  const [decideAction, setDecideAction] = useState<'approve' | 'reject'>('approve');
  const [decideNotes, setDecideNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [canDecide, setCanDecide] = useState(false);

  const fetchData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('credit_ignored_occurrences')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', tab)
      .order('requested_at', { ascending: false });
    if (error) console.error(error);
    const list = (data || []) as Row[];
    setRows(list);

    // fetch profile names for requested_by / decided_by
    const ids = new Set<string>();
    list.forEach(r => { if (r.requested_by) ids.add(r.requested_by); if (r.decided_by) ids.add(r.decided_by); });
    if (ids.size > 0) {
      const { data: profs } = await (supabase as any)
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', Array.from(ids));
      const m: Record<string, string> = {};
      for (const p of (profs || []) as any[]) m[p.user_id] = p.full_name || p.email || p.user_id;
      setProfileMap(m);
    }
    setLoading(false);
  }, [companyId, tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // role check (only supervisor/gerente can decide)
  useEffect(() => {
    (async () => {
      if (!user?.id) return;
      const { data } = await (supabase as any)
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      const role = data?.role;
      setCanDecide(role === 'supervisor' || role === 'gerente');
    })();
  }, [user?.id]);

  const decide = async () => {
    if (!decideRow) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from('credit_ignored_occurrences')
      .update({
        status: decideAction === 'approve' ? 'approved' : 'rejected',
        decision_notes: decideNotes || null,
        decided_by: user?.id,
        decided_at: new Date().toISOString(),
      })
      .eq('id', decideRow.id);
    setSaving(false);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success(decideAction === 'approve' ? 'Ocorrência ignorada.' : 'Solicitação rejeitada.');
    setDecideRow(null);
    setDecideNotes('');
    fetchData();
  };

  const statusBadge = (s: Row['status']) => {
    if (s === 'pending') return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
    if (s === 'approved') return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"><CheckCircle2 className="w-3 h-3 mr-1" />Aprovada</Badge>;
    return <Badge className="bg-destructive/15 text-destructive border-destructive/30"><XCircle className="w-3 h-3 mr-1" />Rejeitada</Badge>;
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldAlert className="w-6 h-6" /> Ocorrências Ignoradas (Alçada)</h1>
        <p className="text-sm text-muted-foreground">
          Solicitações de alçada para ignorar restrições de crédito. Ocorrências aprovadas deixam de ser consideradas em todas as consultas do documento.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="pending">Pendentes</TabsTrigger>
          <TabsTrigger value="approved">Aprovadas</TabsTrigger>
          <TabsTrigger value="rejected">Rejeitadas</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Solicitações {tab === 'pending' ? 'pendentes' : tab === 'approved' ? 'aprovadas' : 'rejeitadas'}</CardTitle>
              <CardDescription>
                {tab === 'pending' && (canDecide ? 'Aprove ou rejeite cada solicitação abaixo.' : 'Apenas Gerentes e Supervisores podem decidir.')}
                {tab === 'approved' && 'Ocorrências já desconsideradas pelo sistema.'}
                {tab === 'rejected' && 'Solicitações que foram analisadas e negadas.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
              ) : rows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Nada por aqui.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Documento</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Ocorrência</TableHead>
                      <TableHead>Solicitada por</TableHead>
                      <TableHead>Em</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.documento}</TableCell>
                        <TableCell className="text-xs">{r.category}</TableCell>
                        <TableCell className="max-w-md">
                          <div className="text-sm font-medium truncate">{r.titulo || '(sem título)'}</div>
                          {r.descricao && <div className="text-xs text-muted-foreground truncate">{r.descricao}</div>}
                          {r.request_reason && <div className="text-[11px] italic text-muted-foreground mt-1">Justif.: {r.request_reason}</div>}
                        </TableCell>
                        <TableCell className="text-xs">{r.requested_by ? (profileMap[r.requested_by] || '—') : '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(r.requested_at).toLocaleString('pt-BR')}</TableCell>
                        <TableCell>{statusBadge(r.status)}</TableCell>
                        <TableCell className="text-right">
                          {r.status === 'pending' && canDecide && (
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="outline" onClick={() => { setDecideRow(r); setDecideAction('approve'); setDecideNotes(''); }}>
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Aprovar
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => { setDecideRow(r); setDecideAction('reject'); setDecideNotes(''); }}>
                                <XCircle className="w-3.5 h-3.5 mr-1 text-destructive" /> Rejeitar
                              </Button>
                            </div>
                          )}
                          {r.status !== 'pending' && r.decision_notes && (
                            <div className="text-[11px] italic text-muted-foreground">"{r.decision_notes}"</div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!decideRow} onOpenChange={(o) => !o && setDecideRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decideAction === 'approve' ? 'Aprovar alçada e ignorar ocorrência' : 'Rejeitar solicitação'}
            </DialogTitle>
            <DialogDescription>
              {decideAction === 'approve'
                ? 'A ocorrência deixará de ser considerada restritiva em todas as consultas deste documento, nesta e nas próximas propostas.'
                : 'A solicitação ficará registrada como negada e a ocorrência continuará pesando nas decisões.'}
            </DialogDescription>
          </DialogHeader>
          {decideRow && (
            <div className="space-y-3">
              <div className="rounded border-l-2 border-amber-500 bg-amber-500/5 px-3 py-2">
                <div className="text-xs uppercase text-muted-foreground">{decideRow.category} · {decideRow.documento}</div>
                <div className="text-sm font-semibold">{decideRow.titulo || '(sem título)'}</div>
                {decideRow.descricao && <div className="text-xs text-muted-foreground mt-0.5">{decideRow.descricao}</div>}
                {decideRow.request_reason && <div className="text-[11px] italic mt-1">Justificativa: {decideRow.request_reason}</div>}
              </div>
              <div>
                <label className="text-xs font-medium">Observação da decisão (opcional)</label>
                <Textarea value={decideNotes} onChange={(e) => setDecideNotes(e.target.value)} rows={3} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDecideRow(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={decide} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Gavel className="w-4 h-4 mr-2" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
