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
import { Loader2, QrCode, MessageSquare, Building2, Wrench } from 'lucide-react';

interface CompanySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
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

export function CompanySettingsDialog({ open, onOpenChange, companyId }: CompanySettingsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    if (open && companyId) {
      loadSettings();
    }
  }, [open, companyId]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
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
          pix_key: pixKey || null,
          pix_key_type: pixKeyType || null,
          pix_holder_name: pixHolderName || null,
          pix_city: pixCity || null,
          whatsapp_notify_enabled: whatsappNotifyEnabled,
          whatsapp_notify_days_before: whatsappNotifyDaysBefore,
          whatsapp_notify_time: whatsappNotifyTime,
        } as any)
        .eq('id', companyId);

      if (error) throw error;
      toast.success('Configurações salvas com sucesso!');
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Gerenciar Empresa</DialogTitle>
          <DialogDescription>
            Configure os dados cadastrais, PIX e notificações da empresa.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="cadastro" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
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
            </div>
          </Tabs>
        )}

        <DialogFooter className="flex-shrink-0 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
