import { useState, useRef } from 'react';
import { format } from 'date-fns';
import { Clipboard, Scan, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { decodeBoleto, formatLinhaDigitavel } from '@/lib/boleto';

interface AddBoletoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    barcode: string;
    description: string | null;
    recipient: string | null;
    amount: number | null;
    due_date: string | null;
    bank_code: string | null;
    bank_name: string | null;
    notes: string | null;
    status: 'pending';
  }) => Promise<boolean>;
}

interface DecodeState {
  status: 'idle' | 'success' | 'error';
  message?: string;
}

export function AddBoletoDialog({ open, onOpenChange, onSubmit }: AddBoletoDialogProps) {
  const [barcode, setBarcode] = useState('');
  const [description, setDescription] = useState('');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [notes, setNotes] = useState('');
  const [decodeState, setDecodeState] = useState<DecodeState>({ status: 'idle' });
  const [loading, setLoading] = useState(false);
  const barcodeRef = useRef<HTMLInputElement>(null);

  const handleDecode = () => {
    if (!barcode.trim()) return;
    const result = decodeBoleto(barcode);

    if (!result.isValid) {
      setDecodeState({ status: 'error', message: result.error });
      return;
    }

    if (result.amount !== null) setAmount(result.amount.toFixed(2).replace('.', ','));
    if (result.dueDate) setDueDate(format(result.dueDate, 'yyyy-MM-dd'));
    setBankName(result.bankName);
    setBankCode(result.bankCode);

    setDecodeState({
      status: 'success',
      message: `${result.bankName}${result.amount !== null ? '' : ' · Valor em aberto'}${!result.dueDate ? ' · Sem vencimento' : ''}`,
    });
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setBarcode(text.trim());
      setDecodeState({ status: 'idle' });
    } catch {
      barcodeRef.current?.focus();
    }
  };

  const handleBarcodeChange = (value: string) => {
    setBarcode(value);
    setDecodeState({ status: 'idle' });
  };

  const parseAmount = (v: string): number | null => {
    const cleaned = v.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
  };

  const handleSubmit = async () => {
    if (!barcode.trim()) return;
    setLoading(true);
    const ok = await onSubmit({
      barcode: barcode.trim(),
      description: description.trim() || null,
      recipient: recipient.trim() || null,
      amount: parseAmount(amount),
      due_date: dueDate || null,
      bank_code: bankCode || null,
      bank_name: bankName || null,
      notes: notes.trim() || null,
      status: 'pending',
    });
    setLoading(false);
    if (ok) handleClose();
  };

  const handleClose = () => {
    setBarcode('');
    setDescription('');
    setRecipient('');
    setAmount('');
    setDueDate('');
    setBankName('');
    setBankCode('');
    setNotes('');
    setDecodeState({ status: 'idle' });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Adicionar Boleto</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Barcode input */}
          <div className="space-y-2">
            <Label>Código de barras / Linha digitável *</Label>
            <div className="flex gap-2">
              <Input
                ref={barcodeRef}
                value={barcode}
                onChange={e => handleBarcodeChange(e.target.value)}
                placeholder="Cole ou digite o código..."
                className="font-mono text-sm"
                onKeyDown={e => e.key === 'Enter' && handleDecode()}
              />
              <Button type="button" variant="outline" size="icon" onClick={handlePaste} title="Colar da área de transferência">
                <Clipboard className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1.5"
                onClick={handleDecode}
                disabled={!barcode.trim()}
              >
                <Scan className="w-4 h-4" />
                Decodificar
              </Button>
              {decodeState.status === 'success' && (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {decodeState.message}
                </span>
              )}
              {decodeState.status === 'error' && (
                <span className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {decodeState.message}
                </span>
              )}
            </div>
          </div>

          {/* Main fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label>Descrição</Label>
              <Input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Ex: Aluguel março, Internet..."
              />
            </div>

            <div className="space-y-2">
              <Label>Beneficiário / Cedente</Label>
              <Input
                value={recipient}
                onChange={e => setRecipient(e.target.value)}
                placeholder="Nome da empresa/pessoa"
              />
            </div>

            <div className="space-y-2">
              <Label>Banco</Label>
              <Input
                value={bankName}
                onChange={e => setBankName(e.target.value)}
                placeholder="Preenchido automaticamente"
              />
            </div>

            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
              />
            </div>

            <div className="space-y-2">
              <Label>Vencimento</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Informações adicionais..."
              rows={2}
            />
          </div>

          {/* Preview */}
          {barcode && decodeState.status === 'success' && (
            <div className="rounded-md bg-muted/50 border border-border p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Prévia</p>
              <p className="text-xs font-mono text-muted-foreground break-all">{formatLinhaDigitavel(barcode)}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 mt-4">
          <Button variant="outline" onClick={handleClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading || !barcode.trim()}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar boleto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
