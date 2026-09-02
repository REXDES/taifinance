import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { nectaCall } from '@/hooks/useNectaApi';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Plus, RefreshCw, Link2, Unlink, Trash2 } from 'lucide-react';

interface Props { companyId: string | null }

const digits = (v?: string | null) => (v ?? '').replace(/\D/g, '');

export function NectaAdminRegistrationPage({ companyId }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // Estabelecimentos
  const [establishments, setEstablishments] = useState<any[]>([]);
  const [estOpen, setEstOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [estForm, setEstForm] = useState<Record<string, string>>({ legalPerson: 'JURIDICAL' });
  const [savingEst, setSavingEst] = useState(false);


  // POS
  const [posList, setPosList] = useState<any[]>([]);
  const [posModels, setPosModels] = useState<any[]>([]);
  const [posOpen, setPosOpen] = useState(false);
  const [posForm, setPosForm] = useState({ serialKey: '', modelId: '', marketplaceId: '' });
  const [bindTarget, setBindTarget] = useState<any | null>(null);
  const [bindEstablishment, setBindEstablishment] = useState('');

  // Taxas
  const [plans, setPlans] = useState<any[]>([]);
  const [planOpen, setPlanOpen] = useState(false);
  const [planForm, setPlanForm] = useState<Record<string, string>>({});

  const loadEstablishments = useCallback(async () => {
    setLoading(true);
    try {
      const list = await nectaCall<any>('/establishments', 'GET', undefined, { limit: 100 });
      setEstablishments(Array.isArray(list) ? list : (list?.data ?? []));
    } catch (e) { toast.error((e as Error).message); }
    setLoading(false);
  }, []);

  const loadPos = useCallback(async () => {
    try {
      const [list, models] = await Promise.all([
        nectaCall<any>('/pos', 'GET', undefined, { limit: 100 }),
        nectaCall<any>('/pos/models').catch(() => ({ data: [] })),
      ]);
      setPosList(Array.isArray(list) ? list : (list?.data ?? []));
      setPosModels((models as any)?.data ?? []);
    } catch (e) { toast.error((e as Error).message); }
  }, []);

  const loadPlans = useCallback(async () => {
    const { data } = await (supabase as any).from('necta_fee_plans').select('*').order('created_at', { ascending: false });
    setPlans(data ?? []);
  }, []);

  useEffect(() => { loadEstablishments(); loadPos(); loadPlans(); }, [loadEstablishments, loadPos, loadPlans]);

  const createEstablishment = async () => {
    const required = ['name', 'document', 'email', 'phone', 'street', 'number', 'neighborhood', 'city', 'state', 'postalCode'];
    const missing = required.filter(k => !estForm[k]);
    if (missing.length) { toast.error('Preencha os campos obrigatórios'); return; }
    setSavingEst(true);
    try {
      const doc = digits(estForm.document);
      const resp = await nectaCall<any>('/establishments', 'POST', {
        name: estForm.name,
        document: doc,
        email: estForm.email,
        phone: digits(estForm.phone),
        legalPerson: estForm.legalPerson || (doc.length > 11 ? 'JURIDICAL' : 'NATURAL'),
        birthDate: estForm.birthDate || '1990-01-01',
        marketplaceId: estForm.marketplaceId || undefined,
        address: {
          street: estForm.street, number: estForm.number, neighborhood: estForm.neighborhood,
          city: estForm.city, state: estForm.state, country: 'BR', postalCode: digits(estForm.postalCode),
        },
        bankAccount: {
          document: digits(estForm.bankDocument || estForm.document),
          corporateName: estForm.bankHolder || estForm.name,
          legalPerson: estForm.legalPerson || 'JURIDICAL',
          bankCode: estForm.bankCode || undefined,
          bankName: estForm.bankName || undefined,
          accountNumber: digits(estForm.bankAccount),
          agencyNumber: digits(estForm.bankAgency),
          accountType: 'CHECKING', type: 'CHECKING',
          compeCode: estForm.bankCode || undefined, active: true,
        },
      });
      await (supabase as any).from('necta_establishments').insert({
        company_id: companyId, necta_establishment_id: resp?.id ?? null,
        legal_name: estForm.name, document: doc, email: estForm.email, phone: estForm.phone,
        address_zip: estForm.postalCode, address_street: estForm.street, address_number: estForm.number,
        address_district: estForm.neighborhood, address_city: estForm.city, address_state: estForm.state,
        bank_code: estForm.bankCode ?? null, bank_name: estForm.bankName ?? null,
        bank_agency: estForm.bankAgency ?? null, bank_account: estForm.bankAccount ?? null,
        homologation_status: 'pending', homologation_sent_at: new Date().toISOString(),
        raw: resp, created_by: user?.id,
      });
      toast.success('Estabelecimento cadastrado');
      setEstOpen(false); setEstForm({ legalPerson: 'JURIDICAL' });
      loadEstablishments();
    } catch (e) { toast.error((e as Error).message); }
    setSavingEst(false);
  };

  const createPos = async () => {
    if (!posForm.serialKey || !posForm.modelId) { toast.error('Informe o serial e o modelo'); return; }
    try {
      const resp = await nectaCall<any>('/pos', 'POST', {
        marketplaceId: posForm.marketplaceId || undefined,
        serialKey: posForm.serialKey,
        modelId: Number(posForm.modelId),
        modelName: posModels.find(m => String(m.id) === posForm.modelId)?.name,
      });
      await (supabase as any).from('necta_pos').insert({
        company_id: companyId, necta_pos_id: resp?.id ?? null, serial_number: posForm.serialKey,
        model: resp?.modelName ?? null, model_id: String(posForm.modelId), status: resp?.status ?? 'available',
        raw: resp, created_by: user?.id,
      });
      toast.success('Terminal registrado');
      setPosOpen(false); setPosForm({ serialKey: '', modelId: '', marketplaceId: '' });
      loadPos();
    } catch (e) { toast.error((e as Error).message); }
  };

  const bindPos = async () => {
    if (!bindTarget || !bindEstablishment) return;
    try {
      await nectaCall(`/pos/${bindTarget.id}/bind`, 'PATCH', { establishmentId: bindEstablishment });
      toast.success('Terminal vinculado');
      setBindTarget(null); setBindEstablishment('');
      loadPos();
    } catch (e) { toast.error((e as Error).message); }
  };

  const unbindPos = async (id: string) => {
    try {
      await nectaCall(`/pos/${id}/unbind`, 'PATCH', {});
      toast.success('Terminal desvinculado');
      loadPos();
    } catch (e) { toast.error((e as Error).message); }
  };

  const savePlan = async () => {
    if (!planForm.name) { toast.error('Informe o nome do plano'); return; }
    const payload = {
      company_id: companyId,
      necta_plan_id: planForm.necta_plan_id || null,
      name: planForm.name,
      description: planForm.description || null,
      pix_fee: planForm.pix_fee ? Number(planForm.pix_fee) : null,
      bank_slip_fee: planForm.bank_slip_fee ? Number(planForm.bank_slip_fee) : null,
      debit_fee: planForm.debit_fee ? Number(planForm.debit_fee) : null,
      credit_fee: planForm.credit_fee ? Number(planForm.credit_fee) : null,
      credit_installment_fee: planForm.credit_installment_fee ? Number(planForm.credit_installment_fee) : null,
      anticipation_fee: planForm.anticipation_fee ? Number(planForm.anticipation_fee) : null,
      royalty_percent: planForm.royalty_percent ? Number(planForm.royalty_percent) : null,
      created_by: user?.id,
    };
    const { error } = planForm.id
      ? await (supabase as any).from('necta_fee_plans').update(payload).eq('id', planForm.id)
      : await (supabase as any).from('necta_fee_plans').insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success('Plano de taxas salvo');
    setPlanOpen(false); setPlanForm({});
    loadPlans();
  };

  const deletePlan = async (id: string) => {
    const { error } = await (supabase as any).from('necta_fee_plans').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Plano removido');
    loadPlans();
  };

  const applyPlan = async (planId: string, establishmentId: string) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan?.necta_plan_id) { toast.error('Informe o ID do plano na Necta para aplicá-lo'); return; }
    try {
      await nectaCall(`/establishments/${establishmentId}/fee-plan`, 'PUT', { feePlanId: plan.necta_plan_id });
      toast.success('Plano aplicado ao estabelecimento');
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Pagamentos — Cadastro</h1>
        <p className="text-muted-foreground text-sm">Estabelecimentos, terminais POS e planos de taxa</p>
      </div>

      <Tabs defaultValue="establishments">
        <TabsList>
          <TabsTrigger value="establishments">Estabelecimentos</TabsTrigger>
          <TabsTrigger value="pos">POS</TabsTrigger>
          <TabsTrigger value="fees">Taxas</TabsTrigger>
        </TabsList>

        {/* ---------------- Estabelecimentos ---------------- */}
        <TabsContent value="establishments" className="space-y-3">
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" onClick={loadEstablishments} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={() => setLinkOpen(true)}>
              <Link2 className="w-4 h-4 mr-2" />Vincular sellers às empresas
            </Button>
            <Button size="sm" onClick={() => setEstOpen(true)}><Plus className="w-4 h-4 mr-2" />Novo estabelecimento</Button>
          </div>

          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Nome</TableHead><TableHead>Documento</TableHead><TableHead>E-mail</TableHead>
                <TableHead>Cidade/UF</TableHead><TableHead>Situação</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {establishments.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum estabelecimento</TableCell></TableRow>}
                {establishments.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.name}</TableCell>
                    <TableCell>{e.document}</TableCell>
                    <TableCell>{e.email}</TableCell>
                    <TableCell>{e.address ? `${e.address.city}/${e.address.state}` : '—'}</TableCell>
                    <TableCell><Badge variant="secondary">{e.status?.name ?? '—'}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* ---------------- POS ---------------- */}
        <TabsContent value="pos" className="space-y-3">
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={loadPos}><RefreshCw className="w-4 h-4 mr-2" />Atualizar</Button>
            <Button size="sm" onClick={() => setPosOpen(true)}><Plus className="w-4 h-4 mr-2" />Registrar terminal</Button>
          </div>
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Serial</TableHead><TableHead>Modelo</TableHead><TableHead>Status</TableHead>
                <TableHead>Vinculado em</TableHead><TableHead className="text-right">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {posList.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum terminal</TableCell></TableRow>}
                {posList.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.serialKey}</TableCell>
                    <TableCell>{p.modelName ?? p.modelId}</TableCell>
                    <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                    <TableCell>{p.boundAt ? new Date(p.boundAt).toLocaleString('pt-BR') : '—'}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => setBindTarget(p)}><Link2 className="w-4 h-4 mr-1" />Vincular</Button>
                      <Button size="sm" variant="ghost" onClick={() => unbindPos(p.id)}><Unlink className="w-4 h-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* ---------------- Taxas ---------------- */}
        <TabsContent value="fees" className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setPlanForm({}); setPlanOpen(true); }}><Plus className="w-4 h-4 mr-2" />Novo plano de taxas</Button>
          </div>
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Plano</TableHead><TableHead>ID Necta</TableHead>
                <TableHead className="text-right">PIX</TableHead><TableHead className="text-right">Boleto</TableHead>
                <TableHead className="text-right">Débito</TableHead><TableHead className="text-right">Crédito</TableHead>
                <TableHead className="text-right">Parcelado</TableHead><TableHead className="text-right">Royalty</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {plans.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhum plano cadastrado</TableCell></TableRow>}
                {plans.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="cursor-pointer" onClick={() => { setPlanForm(p); setPlanOpen(true); }}>{p.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.necta_plan_id ?? '—'}</TableCell>
                    <TableCell className="text-right">{p.pix_fee ?? '—'}</TableCell>
                    <TableCell className="text-right">{p.bank_slip_fee ?? '—'}</TableCell>
                    <TableCell className="text-right">{p.debit_fee ?? '—'}</TableCell>
                    <TableCell className="text-right">{p.credit_fee ?? '—'}</TableCell>
                    <TableCell className="text-right">{p.credit_installment_fee ?? '—'}</TableCell>
                    <TableCell className="text-right">{p.royalty_percent ?? '—'}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Select onValueChange={(v) => applyPlan(p.id, v)}>
                        <SelectTrigger className="w-[150px] inline-flex"><SelectValue placeholder="Aplicar em…" /></SelectTrigger>
                        <SelectContent>
                          {establishments.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button size="icon" variant="ghost" onClick={() => deletePlan(p.id)}><Trash2 className="w-4 h-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Novo estabelecimento */}
      <Dialog open={estOpen} onOpenChange={setEstOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo estabelecimento</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {[['name', 'Razão social *'], ['document', 'CNPJ/CPF *'], ['email', 'E-mail *'], ['phone', 'Telefone *'],
              ['birthDate', 'Abertura/nascimento'], ['marketplaceId', 'Marketplace ID (opcional)'],
              ['postalCode', 'CEP *'], ['street', 'Logradouro *'], ['number', 'Número *'], ['neighborhood', 'Bairro *'],
              ['city', 'Cidade *'], ['state', 'UF *'], ['bankCode', 'Código do banco'], ['bankName', 'Banco'],
              ['bankAgency', 'Agência'], ['bankAccount', 'Conta'], ['bankHolder', 'Titular'], ['bankDocument', 'Doc. titular']].map(([k, label]) => (
              <div key={k}>
                <Label>{label}</Label>
                <Input type={k === 'birthDate' ? 'date' : 'text'} value={estForm[k] ?? ''} onChange={e => setEstForm(f => ({ ...f, [k]: e.target.value }))} />
              </div>
            ))}
            <div><Label>Tipo</Label>
              <Select value={estForm.legalPerson ?? 'JURIDICAL'} onValueChange={v => setEstForm(f => ({ ...f, legalPerson: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="JURIDICAL">Pessoa jurídica</SelectItem>
                  <SelectItem value="NATURAL">Pessoa física</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEstOpen(false)}>Cancelar</Button>
            <Button onClick={createEstablishment} disabled={savingEst}>{savingEst ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cadastrar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Novo POS */}
      <Dialog open={posOpen} onOpenChange={setPosOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar terminal POS</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Serial *</Label><Input value={posForm.serialKey} onChange={e => setPosForm(f => ({ ...f, serialKey: e.target.value }))} /></div>
            <div><Label>Modelo *</Label>
              <Select value={posForm.modelId} onValueChange={v => setPosForm(f => ({ ...f, modelId: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o modelo homologado" /></SelectTrigger>
                <SelectContent>
                  {posModels.map((m: any) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Marketplace ID (opcional)</Label><Input value={posForm.marketplaceId} onChange={e => setPosForm(f => ({ ...f, marketplaceId: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPosOpen(false)}>Cancelar</Button>
            <Button onClick={createPos}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vincular POS */}
      <Dialog open={!!bindTarget} onOpenChange={(o) => !o && setBindTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Vincular terminal {bindTarget?.serialKey}</DialogTitle></DialogHeader>
          <div><Label>Estabelecimento</Label>
            <Select value={bindEstablishment} onValueChange={setBindEstablishment}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {establishments.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBindTarget(null)}>Cancelar</Button>
            <Button onClick={bindPos} disabled={!bindEstablishment}>Vincular</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plano de taxas */}
      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{planForm.id ? 'Editar plano de taxas' : 'Novo plano de taxas'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Nome *</Label><Input value={planForm.name ?? ''} onChange={e => setPlanForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="col-span-2"><Label>Descrição</Label><Input value={planForm.description ?? ''} onChange={e => setPlanForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="col-span-2"><Label>ID do plano na Necta</Label><Input value={planForm.necta_plan_id ?? ''} onChange={e => setPlanForm(f => ({ ...f, necta_plan_id: e.target.value }))} /></div>
            {[['pix_fee', 'Taxa PIX (%)'], ['bank_slip_fee', 'Taxa boleto (R$)'], ['debit_fee', 'Taxa débito (%)'],
              ['credit_fee', 'Taxa crédito (%)'], ['credit_installment_fee', 'Taxa parcelado (%)'],
              ['anticipation_fee', 'Taxa antecipação (%)'], ['royalty_percent', 'Royalty (%)']].map(([k, label]) => (
              <div key={k}><Label>{label}</Label>
                <Input type="number" step="0.01" value={planForm[k] ?? ''} onChange={e => setPlanForm(f => ({ ...f, [k]: e.target.value }))} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanOpen(false)}>Cancelar</Button>
            <Button onClick={savePlan}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
