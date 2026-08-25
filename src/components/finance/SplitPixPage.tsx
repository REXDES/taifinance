import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Users, Split, Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DeleteConfirmDialog } from '@/components/dialogs/DeleteConfirmDialog';
import { useSplitRecipients, SplitRecipient } from '@/hooks/useSplitRecipients';
import { useSplitRules, SplitRule, SplitScope, SplitValueType } from '@/hooks/useSplitRules';
import { useTransactionCategories } from '@/hooks/useTransactionCategories';
import { useClientsSuppliers } from '@/hooks/useClientsSuppliers';
import { useFinanceTags } from '@/hooks/useFinanceTags';

const PIX_TYPES = [
  { v: 'cpf', l: 'CPF' },
  { v: 'cnpj', l: 'CNPJ' },
  { v: 'email', l: 'E-mail' },
  { v: 'phone', l: 'Telefone' },
  { v: 'random', l: 'Chave aleatória' },
];

interface Props { companyId: string }

export function SplitPixPage({ companyId }: Props) {
  const recip = useSplitRecipients(companyId);
  const rls = useSplitRules(companyId);
  const { categories } = useTransactionCategories(companyId);
  const { clientsSuppliers } = useClientsSuppliers(companyId);
  const { tags } = useFinanceTags(companyId);

  const recipientMap = useMemo(() => Object.fromEntries(recip.recipients.map(r => [r.id, r])), [recip.recipients]);

  // Recipient dialog
  const [recOpen, setRecOpen] = useState(false);
  const [recEditing, setRecEditing] = useState<SplitRecipient | null>(null);
  const [recForm, setRecForm] = useState({
    name: '', document: '', pix_key: '', pix_key_type: 'cpf',
    bank_name: '', bank_branch: '', bank_account: '', notes: '', active: true,
  });
  const [recSaving, setRecSaving] = useState(false);
  const [recDelete, setRecDelete] = useState<SplitRecipient | null>(null);

  const openRec = (r?: SplitRecipient) => {
    if (r) {
      setRecEditing(r);
      setRecForm({
        name: r.name, document: r.document || '', pix_key: r.pix_key, pix_key_type: r.pix_key_type,
        bank_name: r.bank_name || '', bank_branch: r.bank_branch || '', bank_account: r.bank_account || '',
        notes: r.notes || '', active: r.active,
      });
    } else {
      setRecEditing(null);
      setRecForm({ name: '', document: '', pix_key: '', pix_key_type: 'cpf', bank_name: '', bank_branch: '', bank_account: '', notes: '', active: true });
    }
    setRecOpen(true);
  };

  const saveRec = async () => {
    if (!recForm.name.trim() || !recForm.pix_key.trim()) return;
    setRecSaving(true);
    const payload = {
      name: recForm.name.trim(),
      document: recForm.document.trim() || null,
      pix_key: recForm.pix_key.trim(),
      pix_key_type: recForm.pix_key_type,
      bank_name: recForm.bank_name.trim() || null,
      bank_branch: recForm.bank_branch.trim() || null,
      bank_account: recForm.bank_account.trim() || null,
      notes: recForm.notes.trim() || null,
      active: recForm.active,
    };
    const ok = recEditing
      ? await recip.update(recEditing.id, payload)
      : !!(await recip.create(payload));
    setRecSaving(false);
    if (ok) setRecOpen(false);
  };

  // Rule dialog
  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleEditing, setRuleEditing] = useState<SplitRule | null>(null);
  const [ruleForm, setRuleForm] = useState({
    recipient_id: '', scope: 'global' as SplitScope, scope_ref_id: '',
    value_type: 'percent' as SplitValueType, value: 0, priority: 0, active: true, notes: '',
  });
  const [ruleSaving, setRuleSaving] = useState(false);
  const [ruleDelete, setRuleDelete] = useState<SplitRule | null>(null);

  const openRule = (r?: SplitRule) => {
    if (r) {
      setRuleEditing(r);
      setRuleForm({
        recipient_id: r.recipient_id, scope: r.scope, scope_ref_id: r.scope_ref_id || '',
        value_type: r.value_type, value: r.value, priority: r.priority, active: r.active,
        notes: r.notes || '',
      });
    } else {
      setRuleEditing(null);
      setRuleForm({ recipient_id: recip.recipients[0]?.id || '', scope: 'global', scope_ref_id: '', value_type: 'percent', value: 0, priority: 0, active: true, notes: '' });
    }
    setRuleOpen(true);
  };

  const saveRule = async () => {
    if (!ruleForm.recipient_id || ruleForm.value <= 0) return;
    if (ruleForm.scope !== 'global' && !ruleForm.scope_ref_id) return;
    setRuleSaving(true);
    const payload = {
      recipient_id: ruleForm.recipient_id,
      scope: ruleForm.scope,
      scope_ref_id: ruleForm.scope === 'global' ? null : ruleForm.scope_ref_id,
      value_type: ruleForm.value_type,
      value: Number(ruleForm.value),
      priority: Number(ruleForm.priority) || 0,
      active: ruleForm.active,
      notes: ruleForm.notes.trim() || null,
    };
    const ok = ruleEditing
      ? await rls.update(ruleEditing.id, payload)
      : !!(await rls.create(payload));
    setRuleSaving(false);
    if (ok) setRuleOpen(false);
  };

  const scopeLabel = (rule: SplitRule) => {
    if (rule.scope === 'global') return 'Todas as cobranças';
    if (rule.scope === 'category') return `Categoria: ${categories.find(c => c.id === rule.scope_ref_id)?.name || '—'}`;
    if (rule.scope === 'client_supplier') return `Cliente/Forn.: ${clientsSuppliers.find(c => c.id === rule.scope_ref_id)?.name || '—'}`;
    if (rule.scope === 'tag') return `Tag: ${tags.find(t => t.id === rule.scope_ref_id)?.name || '—'}`;
    return '';
  };

  const formatValue = (rule: SplitRule) =>
    rule.value_type === 'percent' ? `${rule.value}%` : `R$ ${rule.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const scopeOptions = ruleForm.scope === 'category'
    ? categories.map(c => ({ v: c.id, l: c.name }))
    : ruleForm.scope === 'client_supplier'
    ? clientsSuppliers.map(c => ({ v: c.id, l: c.name }))
    : ruleForm.scope === 'tag'
    ? tags.map(t => ({ v: t.id, l: t.name }))
    : [];

  if (recip.loading || rls.loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Split className="w-6 h-6" /> Split de PIX
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cadastre destinatários e regras para dividir automaticamente uma fração dos recebimentos PIX.
        </p>
      </div>

      <Alert>
        <Info className="w-4 h-4" />
        <AlertDescription>
          <strong>Configuração lógica (Fase 1).</strong> Os splits ficam registrados junto de cada cobrança para controle e conciliação. A execução automática via PSP será habilitada em uma próxima etapa.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="recipients">
        <TabsList>
          <TabsTrigger value="recipients"><Users className="w-4 h-4 mr-2" />Destinatários</TabsTrigger>
          <TabsTrigger value="rules"><Split className="w-4 h-4 mr-2" />Regras</TabsTrigger>
        </TabsList>

        {/* ============= RECIPIENTS ============= */}
        <TabsContent value="recipients" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => openRec()}><Plus className="w-4 h-4 mr-2" />Novo destinatário</Button>
          </div>
          {recip.recipients.length === 0 ? (
            <Card className="p-12 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Nenhum destinatário cadastrado.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {recip.recipients.map(r => (
                <Card key={r.id} className="p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold truncate">{r.name}</p>
                        {!r.active && <Badge variant="secondary" className="text-[10px]">Inativo</Badge>}
                      </div>
                      {r.document && <p className="text-xs text-muted-foreground">{r.document}</p>}
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openRec(r)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setRecDelete(r)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </div>
                  <div className="text-xs">
                    <p className="text-muted-foreground">Chave PIX ({r.pix_key_type})</p>
                    <p className="font-mono truncate">{r.pix_key}</p>
                  </div>
                  {(r.bank_name || r.bank_account) && (
                    <p className="text-xs text-muted-foreground">
                      {[r.bank_name, r.bank_branch, r.bank_account].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ============= RULES ============= */}
        <TabsContent value="rules" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => openRule()} disabled={recip.recipients.length === 0}>
              <Plus className="w-4 h-4 mr-2" />Nova regra
            </Button>
          </div>
          {recip.recipients.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Cadastre pelo menos um destinatário antes de criar regras.
            </Card>
          ) : rls.rules.length === 0 ? (
            <Card className="p-12 text-center">
              <Split className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Nenhuma regra cadastrada.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {rls.rules.map(r => (
                <Card key={r.id} className="p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{recipientMap[r.recipient_id]?.name || '—'}</span>
                      <Badge variant="outline" className="text-xs">{formatValue(r)}</Badge>
                      <Badge variant="secondary" className="text-xs">Prioridade {r.priority}</Badge>
                      {!r.active && <Badge variant="secondary" className="text-[10px]">Inativa</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{scopeLabel(r)}</p>
                    {r.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{r.notes}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openRule(r)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setRuleDelete(r)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Recipient Dialog */}
      <Dialog open={recOpen} onOpenChange={setRecOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{recEditing ? 'Editar destinatário' : 'Novo destinatário'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={recForm.name} onChange={e => setRecForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Documento (CPF/CNPJ)</Label><Input value={recForm.document} onChange={e => setRecForm(f => ({ ...f, document: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo de chave *</Label>
                <Select value={recForm.pix_key_type} onValueChange={v => setRecForm(f => ({ ...f, pix_key_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PIX_TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Chave PIX *</Label><Input value={recForm.pix_key} onChange={e => setRecForm(f => ({ ...f, pix_key: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Banco</Label><Input value={recForm.bank_name} onChange={e => setRecForm(f => ({ ...f, bank_name: e.target.value }))} /></div>
              <div><Label>Agência</Label><Input value={recForm.bank_branch} onChange={e => setRecForm(f => ({ ...f, bank_branch: e.target.value }))} /></div>
              <div><Label>Conta</Label><Input value={recForm.bank_account} onChange={e => setRecForm(f => ({ ...f, bank_account: e.target.value }))} /></div>
            </div>
            <div><Label>Observações</Label><Textarea rows={2} value={recForm.notes} onChange={e => setRecForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <div className="flex items-center gap-2">
              <Switch checked={recForm.active} onCheckedChange={v => setRecForm(f => ({ ...f, active: v }))} />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecOpen(false)}>Cancelar</Button>
            <Button onClick={saveRec} disabled={recSaving || !recForm.name.trim() || !recForm.pix_key.trim()}>
              {recSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {recEditing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rule Dialog */}
      <Dialog open={ruleOpen} onOpenChange={setRuleOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{ruleEditing ? 'Editar regra' : 'Nova regra'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Destinatário *</Label>
              <Select value={ruleForm.recipient_id} onValueChange={v => setRuleForm(f => ({ ...f, recipient_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {recip.recipients.filter(r => r.active).map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Escopo *</Label>
                <Select value={ruleForm.scope} onValueChange={(v: SplitScope) => setRuleForm(f => ({ ...f, scope: v, scope_ref_id: '' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Todas as cobranças</SelectItem>
                    <SelectItem value="category">Categoria</SelectItem>
                    <SelectItem value="client_supplier">Cliente/Fornecedor</SelectItem>
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
                <Select value={ruleForm.value_type} onValueChange={(v: SplitValueType) => setRuleForm(f => ({ ...f, value_type: v }))}>
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

            <div><Label>Observações</Label><Textarea rows={2} value={ruleForm.notes} onChange={e => setRuleForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleOpen(false)}>Cancelar</Button>
            <Button onClick={saveRule} disabled={ruleSaving || !ruleForm.recipient_id || ruleForm.value <= 0 || (ruleForm.scope !== 'global' && !ruleForm.scope_ref_id)}>
              {ruleSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {ruleEditing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!recDelete} onOpenChange={o => !o && setRecDelete(null)}
        onConfirm={async () => { if (recDelete) { await recip.remove(recDelete.id); setRecDelete(null); } }}
        title="Excluir destinatário"
        description={`"${recDelete?.name}" será removido. Regras associadas também serão excluídas.`}
      />
      <DeleteConfirmDialog
        open={!!ruleDelete} onOpenChange={o => !o && setRuleDelete(null)}
        onConfirm={async () => { if (ruleDelete) { await rls.remove(ruleDelete.id); setRuleDelete(null); } }}
        title="Excluir regra"
        description="A regra será removida permanentemente."
      />
    </div>
  );
}
