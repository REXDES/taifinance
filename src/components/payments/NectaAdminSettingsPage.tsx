import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { nectaCall } from '@/hooks/useNectaApi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { CheckCircle2, Copy, Loader2, Plus, RefreshCw, Trash2, XCircle } from 'lucide-react';

interface Props { companyId: string | null }

const EVENT_OPTIONS = ['sale.paid', 'sale.refunded', 'sale.failed', 'seller.status_changed'];

export function NectaAdminSettingsPage({ companyId }: Props) {
  const { user } = useAuth();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [scope, setScope] = useState('marketplaces');
  const [scopeUuid, setScopeUuid] = useState('');
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const [remoteEndpoints, setRemoteEndpoints] = useState<any[]>([]);
  const [form, setForm] = useState<{ url: string; description: string; events: string[] }>({ url: '', description: '', events: ['sale.paid'] });
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/necta-webhook`;

  const loadLocal = useCallback(async () => {
    const [{ data: eps }, { data: evs }] = await Promise.all([
      (supabase as any).from('necta_webhook_endpoints').select('*').order('created_at', { ascending: false }),
      (supabase as any).from('necta_webhook_events').select('*').order('received_at', { ascending: false }).limit(50),
    ]);
    setEndpoints(eps ?? []);
    setEvents(evs ?? []);
    const first = (eps ?? [])[0];
    if (first?.scope_uuid && !scopeUuid) { setScope(first.scope); setScopeUuid(first.scope_uuid); }
  }, [scopeUuid]);

  useEffect(() => { loadLocal(); }, [loadLocal]);

  const testConnection = async () => {
    setTesting(true);
    try {
      const resp = await nectaCall<any>('/users/me');
      setTestResult({ ok: true, message: `Conectado como ${resp?.email ?? resp?.name ?? 'token de API'}` });
    } catch (e) {
      setTestResult({ ok: false, message: (e as Error).message });
    }
    setTesting(false);
  };

  const loadRemote = async () => {
    if (!scopeUuid) { toast.error('Informe o UUID do escopo (marketplace ou estabelecimento)'); return; }
    setLoading(true);
    try {
      const resp = await nectaCall<any>(`/${scope}/${scopeUuid}/outbound-webhooks/endpoints`);
      setRemoteEndpoints(resp?.endpoints ?? []);
    } catch (e) { toast.error((e as Error).message); }
    setLoading(false);
  };

  const createEndpoint = async () => {
    if (!scopeUuid) { toast.error('Informe o UUID do escopo'); return; }
    if (!form.url) { toast.error('Informe a URL de destino'); return; }
    try {
      const resp = await nectaCall<any>(`/${scope}/${scopeUuid}/outbound-webhooks/endpoints`, 'POST', {
        url: form.url, description: form.description || undefined, eventTypes: form.events,
      });
      await (supabase as any).from('necta_webhook_endpoints').insert({
        company_id: companyId, scope, scope_uuid: scopeUuid, necta_endpoint_id: resp?.id ?? null,
        url: form.url, events: form.events, raw: resp, created_by: user?.id,
      });
      toast.success('URL de webhook cadastrada');
      setForm({ url: '', description: '', events: ['sale.paid'] });
      loadLocal(); loadRemote();
    } catch (e) { toast.error((e as Error).message); }
  };

  const removeEndpoint = async (row: any) => {
    try {
      if (row.necta_endpoint_id) {
        await nectaCall(`/${row.scope}/${row.scope_uuid}/outbound-webhooks/endpoints/${row.necta_endpoint_id}`, 'DELETE');
      }
      await (supabase as any).from('necta_webhook_endpoints').delete().eq('id', row.id);
      toast.success('URL removida');
      loadLocal();
    } catch (e) { toast.error((e as Error).message); }
  };

  const toggleEvent = (ev: string) =>
    setForm(f => ({ ...f, events: f.events.includes(ev) ? f.events.filter(e => e !== ev) : [...f.events, ev] }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Pagamentos — Configurações</h1>
        <p className="text-muted-foreground text-sm">Credenciais de API, webhooks e histórico de eventos</p>
      </div>

      <Tabs defaultValue="api">
        <TabsList>
          <TabsTrigger value="api">API</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="events">Eventos recebidos</TabsTrigger>
        </TabsList>

        <TabsContent value="api">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Credenciais de integração</CardTitle>
              <CardDescription>
                As credenciais (client secret e secret key) ficam armazenadas com segurança no backend e nunca são expostas ao navegador.
                Use o teste abaixo para validar a autenticação.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={testConnection} disabled={testing}>
                {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}Testar conexão
              </Button>
              {testResult && (
                <Alert variant={testResult.ok ? 'default' : 'destructive'}>
                  {testResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  <AlertDescription className="break-words text-xs">{testResult.message}</AlertDescription>
                </Alert>
              )}
              <div>
                <Label>URL para receber notificações (cadastre na Necta)</Label>
                <div className="flex gap-2">
                  <Input readOnly value={webhookUrl} />
                  <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success('URL copiada'); }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Canal de webhooks</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div><Label>Escopo</Label>
                  <Select value={scope} onValueChange={setScope}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="marketplaces">Marketplace</SelectItem>
                      <SelectItem value="establishments">Estabelecimento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2"><Label>UUID do escopo</Label>
                  <Input value={scopeUuid} onChange={e => setScopeUuid(e.target.value)} placeholder="uuid do marketplace/estabelecimento" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>URL de destino</Label><Input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder={webhookUrl} /></div>
                <div><Label>Descrição</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              </div>
              <div>
                <Label>Eventos</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {EVENT_OPTIONS.map(ev => (
                    <Badge key={ev} variant={form.events.includes(ev) ? 'default' : 'outline'} className="cursor-pointer" onClick={() => toggleEvent(ev)}>
                      {ev}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={createEndpoint}><Plus className="w-4 h-4 mr-2" />Cadastrar URL</Button>
                <Button variant="outline" onClick={loadRemote} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}Consultar na Necta
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>URL</TableHead><TableHead>Escopo</TableHead><TableHead>Eventos</TableHead>
                <TableHead>ID Necta</TableHead><TableHead className="text-right">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {endpoints.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma URL cadastrada</TableCell></TableRow>}
                {endpoints.map(ep => (
                  <TableRow key={ep.id}>
                    <TableCell className="max-w-[320px] truncate">{ep.url}</TableCell>
                    <TableCell>{ep.scope}</TableCell>
                    <TableCell className="text-xs">{(ep.events ?? []).join(', ')}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{ep.necta_endpoint_id ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => removeEndpoint(ep)}><Trash2 className="w-4 h-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>

          {remoteEndpoints.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">URLs registradas na Necta</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {remoteEndpoints.map((ep: any) => (
                  <div key={ep.id} className="flex items-center justify-between border rounded-md p-2">
                    <span className="truncate">{ep.url}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{(ep.eventTypes ?? []).join(', ')}</span>
                      <Badge variant={ep.disabled ? 'outline' : 'default'}>{ep.disabled ? 'inativa' : 'ativa'}</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="events">
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Recebido</TableHead><TableHead>Evento</TableHead><TableHead>Referência</TableHead>
                <TableHead>Processado</TableHead><TableHead>Erro</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {events.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum evento recebido</TableCell></TableRow>}
                {events.map(ev => (
                  <TableRow key={ev.id}>
                    <TableCell>{new Date(ev.received_at).toLocaleString('pt-BR')}</TableCell>
                    <TableCell>{ev.event_type}</TableCell>
                    <TableCell className="text-xs">{ev.necta_reference_id ?? '—'}</TableCell>
                    <TableCell><Badge variant={ev.processed ? 'default' : 'secondary'}>{ev.processed ? 'sim' : 'não'}</Badge></TableCell>
                    <TableCell className="text-xs text-destructive max-w-[260px] truncate">{ev.process_error ?? ''}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
