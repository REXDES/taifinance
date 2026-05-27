import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, QrCode, MessageSquare, Building2, Wrench, ArrowLeft, ChevronRight } from 'lucide-react';
import { normalizePixKey, validatePixKey, type PixKeyType } from '@/lib/pixUtils';

interface CompanySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | null;
  showPicker?: boolean; // se true, força exibir lista de empresas para escolher (modo admin)
  showModulesTab?: boolean; // só admin/supervisor pode ver/alterar módulos
  onSaved?: () => void;
}

const NOTIFY_DAYS_OPTIONS = [
  { value: 0, label: 'No dia do vencimento' },
  { value: 1, label: '1 dia antes' },
  { value: 2, label: '2 dias antes' },
  { value: 3, label: '3 dias antes' },
  { value: 5, label: '5 dias antes' },
  { value: 7, label: '7 dias antes' },
];

const UF_OPTIONS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
  'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
];

export function CompanySettingsDialog({ open, onOpenChange, companyId, showPicker = false, showModulesTab = false, onSaved }: CompanySettingsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [companiesList, setCompaniesList] = useState<Array<{ id: string; name: string; fantasy_name: string | null; cnpj: string | null; color: string }>>([]);
  const [pickedId, setPickedId] = useState<string | null>(null);

  // companyId resolvido: o que vem da prop OU o escolhido na lista
  const effectiveCompanyId = companyId ?? pickedId;
  const showList = showPicker && !pickedId;

  // Dados cadastrais
  const [companyName, setCompanyName] = useState('');
  const [fantasyName, setFantasyName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');

  // PIX
  const [pixKey, setPixKey] = useState('');
  const [pixKeyType, setPixKeyType] = useState('');
  const [pixHolderName, setPixHolderName] = useState('');
  const [pixCity, setPixCity] = useState('');

  // WhatsApp
  const [whatsappNotifyEnabled, setWhatsappNotifyEnabled] = useState(false);
  const [whatsappNotifyDaysBefore, setWhatsappNotifyDaysBefore] = useState<number[]>([0]);
  const [whatsappNotifyTime, setWhatsappNotifyTime] = useState('08:00');

  // Módulos
  const [machinesModuleEnabled, setMachinesModuleEnabled] = useState(false);
  const [creditModuleEnabled, setCreditModuleEnabled] = useState(false);
  const [bankDigitalModuleEnabled, setBankDigitalModuleEnabled] = useState(false);

  // Reset picked when dialog reopens in picker mode
  useEffect(() => {
    if (open && showPicker) {
      setPickedId(null);
    }
  }, [open, showPicker]);

  // Load companies list for picker
  useEffect(() => {
    if (!open || !showList) return;
    (async () => {
      const { data } = await supabase
        .from('companies')
        .select('id, name, fantasy_name, cnpj, color')
        .order('name');
      setCompaniesList((data as any) || []);
    })();
  }, [open, showList]);

  useEffect(() => {
    if (open && effectiveCompanyId) {
      loadSettings();
    }
  }, [open, effectiveCompanyId]);

  const loadSettings = async () => {
    if (!effectiveCompanyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', effectiveCompanyId)
        .single();

      if (error) throw error;

      if (data) {
        const d = data as any;
        setCompanyName(d.name || '');
        setFantasyName(d.fantasy_name || '');
        setCnpj(d.cnpj || '');
        setCompanyEmail(d.email || '');
        setCompanyPhone(d.phone || '');
        setAddress(d.address || '');
        setCity(d.city || '');
        setState(d.state || '');
        setZipCode(d.zip_code || '');
        setPixKey(d.pix_key || '');
        setPixKeyType(d.pix_key_type || '');
        setPixHolderName(d.pix_holder_name || '');
        setPixCity(d.pix_city || '');
        setWhatsappNotifyEnabled(d.whatsapp_notify_enabled || false);
        setWhatsappNotifyDaysBefore(d.whatsapp_notify_days_before || [0]);
        setWhatsappNotifyTime(d.whatsapp_notify_time || '08:00');
        setMachinesModuleEnabled(!!d.machines_module_enabled);
        setCreditModuleEnabled(!!d.credit_module_enabled);
        setBankDigitalModuleEnabled(!!d.bank_digital_module_enabled);
      }
    } catch (error) {
      console.error('Error loading company settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!companyName.trim()) {
      toast.error('Nome da empresa é obrigatório');
      return;
    }

    // Validar e normalizar chave PIX (se preenchida)
    let normalizedPixKey: string | null = null;
    if (pixKey.trim()) {
      if (!pixKeyType) {
        toast.error('Selecione o tipo da chave PIX');
        return;
      }
      const err = validatePixKey(pixKey, pixKeyType as PixKeyType);
      if (err) {
        toast.error(err);
        return;
      }
      normalizedPixKey = normalizePixKey(pixKey, pixKeyType as PixKeyType);
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('companies')
        .update({
          name: companyName,
          fantasy_name: fantasyName || null,
          cnpj: cnpj || null,
          email: companyEmail || null,
          phone: companyPhone || null,
          address: address || null,
          city: city || null,
          state: state || null,
          zip_code: zipCode || null,
          pix_key: normalizedPixKey,
          pix_key_type: pixKeyType || null,
          pix_holder_name: pixHolderName || null,
          pix_city: pixCity || null,
          whatsapp_notify_enabled: whatsappNotifyEnabled,
          whatsapp_notify_days_before: whatsappNotifyDaysBefore,
          whatsapp_notify_time: whatsappNotifyTime,
          machines_module_enabled: machinesModuleEnabled,
          credit_module_enabled: creditModuleEnabled,
          bank_digital_module_enabled: bankDigitalModuleEnabled,
        } as any)
        .eq('id', effectiveCompanyId!);


      if (error) throw error;
      toast.success('Configurações salvas com sucesso!');
      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving company settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day: number) => {
    setWhatsappNotifyDaysBefore(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day].sort((a, b) => a - b)
    );
  };

  const selectedFromList = companiesList.find(c => c.id === pickedId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {showPicker && pickedId && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPickedId(null)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {showList
              ? 'Selecionar Empresa'
              : selectedFromList
                ? `Configurações — ${selectedFromList.name}`
                : 'Gerenciar Empresa'}
          </DialogTitle>
          <DialogDescription>
            {showList
              ? 'Escolha uma empresa para configurar.'
              : 'Configure os dados cadastrais, PIX e notificações da empresa.'}
          </DialogDescription>
        </DialogHeader>

        {showList ? (
          <div className="flex-1 overflow-y-auto -mx-6 px-6 py-2 space-y-2">
            {companiesList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma empresa cadastrada.</p>
            ) : (
              companiesList.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setPickedId(c.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent transition-colors text-left"
                >
                  <div
                    className="w-9 h-9 rounded flex items-center justify-center text-sm font-bold text-primary-foreground flex-shrink-0"
                    style={{ backgroundColor: c.color?.startsWith('#') ? c.color : `hsl(${c.color})` }}
                  >
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground truncate">{c.name}</div>
                    {(c.fantasy_name || c.cnpj) && (
                      <div className="text-xs text-muted-foreground truncate">
                        {c.fantasy_name}{c.fantasy_name && c.cnpj ? ' • ' : ''}{c.cnpj}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))
            )}
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="cadastro" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className={`grid w-full ${showModulesTab ? 'grid-cols-4' : 'grid-cols-3'} flex-shrink-0`}>
              <TabsTrigger value="cadastro" className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                Cadastro
              </TabsTrigger>
              <TabsTrigger value="pix" className="flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5" />
                PIX
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                WhatsApp
              </TabsTrigger>
              {showModulesTab && (
                <TabsTrigger value="modulos" className="flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5" />
                  Módulos
                </TabsTrigger>
              )}
            </TabsList>

            <div className="flex-1 overflow-y-auto mt-4" style={{ maxHeight: '55vh' }}>
              <TabsContent value="cadastro" className="mt-0 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Razão Social *</Label>
                    <Input
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Razão social da empresa"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nome Fantasia</Label>
                    <Input
                      value={fantasyName}
                      onChange={(e) => setFantasyName(e.target.value)}
                      placeholder="Nome fantasia"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>CNPJ</Label>
                    <Input
                      value={cnpj}
                      onChange={(e) => setCnpj(e.target.value)}
                      placeholder="00.000.000/0001-00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input
                      type="email"
                      value={companyEmail}
                      onChange={(e) => setCompanyEmail(e.target.value)}
                      placeholder="empresa@email.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={companyPhone}
                    onChange={(e) => setCompanyPhone(e.target.value)}
                    placeholder="(00) 0000-0000"
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Endereço</Label>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Rua, número, complemento"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Cidade"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado (UF)</Label>
                    <Select value={state} onValueChange={setState}>
                      <SelectTrigger>
                        <SelectValue placeholder="UF" />
                      </SelectTrigger>
                      <SelectContent>
                        {UF_OPTIONS.map(uf => (
                          <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>CEP</Label>
                    <Input
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      placeholder="00000-000"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="pix" className="mt-0 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Configure os dados PIX para gerar cobranças nas contas a receber.
                </p>

                <div className="space-y-2">
                  <Label>Tipo da Chave PIX</Label>
                  <Select value={pixKeyType} onValueChange={setPixKeyType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cpf">CPF</SelectItem>
                      <SelectItem value="cnpj">CNPJ</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="phone">Telefone</SelectItem>
                      <SelectItem value="random">Chave Aleatória</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Chave PIX</Label>
                  <Input
                    value={pixKey}
                    onChange={(e) => setPixKey(e.target.value)}
                    placeholder="Informe a chave PIX"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Nome do Titular</Label>
                  <Input
                    value={pixHolderName}
                    onChange={(e) => setPixHolderName(e.target.value)}
                    placeholder="Nome que aparecerá no PIX"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input
                    value={pixCity}
                    onChange={(e) => setPixCity(e.target.value)}
                    placeholder="Cidade do titular"
                  />
                </div>
              </TabsContent>

              <TabsContent value="whatsapp" className="mt-0 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Configure lembretes automáticos por WhatsApp para contas a pagar e receber.
                </p>

                <div className="flex items-center justify-between">
                  <Label htmlFor="notify-enabled">Ativar notificações</Label>
                  <Switch
                    id="notify-enabled"
                    checked={whatsappNotifyEnabled}
                    onCheckedChange={setWhatsappNotifyEnabled}
                  />
                </div>

                {whatsappNotifyEnabled && (
                  <>
                    <div className="space-y-3">
                      <Label>Quando notificar</Label>
                      <div className="space-y-2">
                        {NOTIFY_DAYS_OPTIONS.map((option) => (
                          <div key={option.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={`day-${option.value}`}
                              checked={whatsappNotifyDaysBefore.includes(option.value)}
                              onCheckedChange={() => toggleDay(option.value)}
                            />
                            <label
                              htmlFor={`day-${option.value}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {option.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Horário de envio</Label>
                      <Input
                        type="time"
                        value={whatsappNotifyTime}
                        onChange={(e) => setWhatsappNotifyTime(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        As mensagens serão enviadas próximo a este horário (horário de Brasília).
                      </p>
                    </div>
                  </>
                )}
              </TabsContent>

              {showModulesTab && (
                <TabsContent value="modulos" className="mt-0 space-y-4">
                  <div className="rounded-lg border border-border p-4 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <Label className="text-base flex items-center gap-2">
                          <Wrench className="w-4 h-4" />
                          Máquinas & Locação
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Habilita o módulo de gestão de máquinas, equipamentos, ferramentas, manutenções, operadores, mecânicos e locações.
                          Quando ativo, surge uma nova seção no menu lateral. Compras e manutenções geram contas a pagar; locações geram contas a receber (à vista ou parceladas).
                        </p>
                      </div>
                      <Switch
                        checked={machinesModuleEnabled}
                        onCheckedChange={setMachinesModuleEnabled}
                      />
                    </div>
                  </div>
                  <div className="rounded-lg border border-border p-4 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <Label className="text-base flex items-center gap-2">
                          <Wrench className="w-4 h-4" />
                          Gestão de Crédito
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Habilita o módulo de venda a prazo: consulta de crédito (RedeBE), motor de decisão, biometria por IA, contrato digital e geração de parcelas em contas a receber.
                        </p>
                      </div>
                      <Switch checked={creditModuleEnabled} onCheckedChange={setCreditModuleEnabled} />
                    </div>
                  </div>
                  <div className="rounded-lg border border-border p-4 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <Label className="text-base flex items-center gap-2">
                          <Wrench className="w-4 h-4" />
                          Banco Digital
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Habilita o módulo de Banco Digital (BaaS Unida): conexões bancárias, contas digitais e operações via API. Quando ativo, surge o item "Banco Digital" no menu lateral desta empresa.
                        </p>
                      </div>
                      <Switch checked={bankDigitalModuleEnabled} onCheckedChange={setBankDigitalModuleEnabled} />
                    </div>
                  </div>
                </TabsContent>
              )}
            </div>
          </Tabs>
        )}

        <DialogFooter className="flex-shrink-0 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {showList ? 'Fechar' : 'Cancelar'}
          </Button>
          {!showList && (
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
