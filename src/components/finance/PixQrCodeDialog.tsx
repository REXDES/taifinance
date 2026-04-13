import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Copy, Send, Loader2, QrCode, AlertCircle } from 'lucide-react';
import { generatePixPayload, type PixParams } from '@/lib/pixUtils';

interface PixQrCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  record: {
    id: string;
    description: string;
    amount: number | null;
    is_amount_pending: boolean;
    client_supplier?: { name: string; id: string } | null;
  } | null;
}

interface CompanyPixConfig {
  pix_key: string | null;
  pix_key_type: string | null;
  pix_holder_name: string | null;
  pix_city: string | null;
  name: string;
}

export function PixQrCodeDialog({ open, onOpenChange, companyId, record }: PixQrCodeDialogProps) {
  const [pixConfig, setPixConfig] = useState<CompanyPixConfig | null>(null);
  const [clientPhone, setClientPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [pixPayload, setPixPayload] = useState<string>('');

  useEffect(() => {
    if (open && companyId) {
      loadData();
    }
  }, [open, companyId, record]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: company } = await supabase
        .from('companies')
        .select('name, pix_key, pix_key_type, pix_holder_name, pix_city')
        .eq('id', companyId)
        .single();

      setPixConfig(company as any);

      if (record?.client_supplier?.id) {
        const { data: cs } = await supabase
          .from('clients_suppliers')
          .select('whatsapp_phone')
          .eq('id', record.client_supplier.id)
          .single();
        setClientPhone((cs as any)?.whatsapp_phone || null);
      } else {
        setClientPhone(null);
      }

      if (company && (company as any).pix_key && record && !record.is_amount_pending && record.amount) {
        const params: PixParams = {
          pixKey: (company as any).pix_key,
          pixKeyType: (company as any).pix_key_type || 'random',
          merchantName: (company as any).pix_holder_name || company.name,
          merchantCity: (company as any).pix_city || 'SAO PAULO',
          amount: record.amount,
          txId: record.id.substring(0, 25).replace(/-/g, ''),
        };
        setPixPayload(generatePixPayload(params));
      } else {
        setPixPayload('');
      }
    } catch (error) {
      console.error('Error loading PIX data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pixPayload);
      toast.success('Código PIX copiado!');
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const handleSendWhatsApp = async () => {
    if (!clientPhone || !pixPayload || !record) return;

    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-pix-whatsapp', {
        body: {
          phone: clientPhone,
          pixCode: pixPayload,
          description: record.description,
          amount: record.amount,
          companyName: pixConfig?.name || '',
        },
      });

      if (error) throw error;
      toast.success('Cobrança enviada por WhatsApp!');
    } catch (error) {
      console.error('Error sending PIX via WhatsApp:', error);
      toast.error('Erro ao enviar por WhatsApp');
    } finally {
      setSending(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const hasPixConfig = pixConfig?.pix_key && pixConfig?.pix_holder_name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            Cobrança PIX
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !hasPixConfig ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <AlertCircle className="w-10 h-10 text-amber-500" />
            <p className="text-sm text-muted-foreground">
              Configure os dados PIX da empresa nas Configurações antes de gerar cobranças.
            </p>
          </div>
        ) : !record || record.is_amount_pending ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <AlertCircle className="w-10 h-10 text-amber-500" />
            <p className="text-sm text-muted-foreground">
              Não é possível gerar PIX para contas com valor a definir.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Payment details */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Descrição:</span>
                <span className="font-medium text-foreground">{record.description}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valor:</span>
                <span className="font-bold text-foreground">{formatCurrency(record.amount!)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Beneficiário:</span>
                <span className="font-medium text-foreground">{pixConfig.pix_holder_name}</span>
              </div>
              {record.client_supplier?.name && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cliente:</span>
                  <span className="font-medium text-foreground">{record.client_supplier.name}</span>
                </div>
              )}
            </div>

            {/* QR Code */}
            {pixPayload && (
              <div className="flex flex-col items-center gap-4">
                <div className="bg-white p-4 rounded-lg">
                  <QRCodeSVG value={pixPayload} size={200} />
                </div>

                {/* Pix Copia e Cola */}
                <div className="w-full">
                  <p className="text-xs text-muted-foreground mb-1">Pix Copia e Cola (clique para copiar):</p>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="w-full text-left bg-muted hover:bg-muted/80 rounded p-2 text-xs break-all font-mono max-h-20 overflow-y-auto text-primary underline cursor-pointer transition-colors"
                    title="Clique para copiar"
                  >
                    {pixPayload}
                  </button>
                </div>

                {/* Actions */}
                <div className="flex gap-2 w-full">
                  <Button variant="outline" className="flex-1" onClick={handleCopy}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar
                  </Button>
                  {clientPhone && (
                    <Button className="flex-1" onClick={handleSendWhatsApp} disabled={sending}>
                      {sending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 mr-2" />
                      )}
                      Enviar WhatsApp
                    </Button>
                  )}
                </div>

                {!clientPhone && record.client_supplier?.name && (
                  <p className="text-xs text-amber-600 text-center">
                    WhatsApp não cadastrado para {record.client_supplier.name}. 
                    Cadastre na página de Clientes/Fornecedores.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
