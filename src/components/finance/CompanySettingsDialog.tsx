import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { toast } from 'sonner';
import { Loader2, QrCode, MessageSquare } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

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

export function CompanySettingsDialog({ open, onOpenChange, companyId }: CompanySettingsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [pixKey, setPixKey] = useState('');
  const [pixKeyType, setPixKeyType] = useState('');
  const [pixHolderName, setPixHolderName] = useState('');
  const [pixCity, setPixCity] = useState('');

  const [whatsappNotifyEnabled, setWhatsappNotifyEnabled] = useState(false);
  const [whatsappNotifyDaysBefore, setWhatsappNotifyDaysBefore] = useState<number[]>([0]);
  const [whatsappNotifyTime, setWhatsappNotifyTime] = useState('08:00');

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
        .select('pix_key, pix_key_type, pix_holder_name, pix_city, whatsapp_notify_enabled, whatsapp_notify_days_before, whatsapp_notify_time')
        .eq('id', companyId)
        .single();

      if (error) throw error;

      if (data) {
        setPixKey((data as any).pix_key || '');
        setPixKeyType((data as any).pix_key_type || '');
        setPixHolderName((data as any).pix_holder_name || '');
        setPixCity((data as any).pix_city || '');
        setWhatsappNotifyEnabled((data as any).whatsapp_notify_enabled || false);
        setWhatsappNotifyDaysBefore((data as any).whatsapp_notify_days_before || [0]);
        setWhatsappNotifyTime((data as any).whatsapp_notify_time || '08:00');
      }
    } catch (error) {
      console.error('Error loading company settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('companies')
        .update({
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Configurações da Empresa</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-2" style={{ maxHeight: '60vh' }}>
            <div className="space-y-6">
              {/* PIX Settings */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">Dados PIX</h3>
                </div>
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
              </div>

              <Separator />

              {/* WhatsApp Notification Settings */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">Notificações WhatsApp</h3>
                </div>
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
              </div>
            </div>
          </div>
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
