import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { nectaCall } from '@/hooks/useNectaApi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Loader2, RefreshCw, AlertTriangle, Send } from 'lucide-react';
import { PaymentsBrandName } from '@/contexts/ModuleBrandingContext';

interface Props { companyId: string }

const brl = (v: number | null | undefined) =>
  (Number(v ?? 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v: number | null | undefined) => (v == null ? '—' : `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`);

/* ---------------- Minhas Taxas ---------------- */
export function NectaFeesPage({ companyId }: Props) {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any).from('necta_fee_plans').select('*')
        .or(`company_id.eq.${companyId},and(company_id.is.null,is_default.eq.true)`)
        .order('is_default', { ascending: true });
      // Plano específico da empresa tem prioridade sobre o padrão.
      const own = (data ?? []).filter((p: any) => p.company_id === companyId);
      setPlans(own.length ? own : (data ?? []));
      setLoading(false);
    })();
  }, [companyId]);

  const rows: Array<[string, keyof any, 'pct']> = [
    ['PIX', 'pix_fee', 'pct'], ['Boleto', 'bank_slip_fee', 'pct'], ['Cartão de débito', 'debit_fee', 'pct'],
    ['Cartão de crédito à vista', 'credit_fee', 'pct'], ['Cartão de crédito parcelado', 'credit_installment_fee', 'pct'],
    ['Antecipação', 'anticipation_fee', 'pct'],
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Minhas Taxas</h1>
        <p className="text-sm text-muted-foreground">Taxas cobradas pelo <PaymentsBrandName /> em cada forma de recebimento</p>
      </div>
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : plans.length === 0 ? (
        <Alert><AlertTriangle className="h-4 w-4" /><AlertDescription>Nenhum plano de taxas definido para sua empresa ainda. Fale com o administrador.</AlertDescription></Alert>
      ) : plans.map(p => (
        <Card key={p.id}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">{p.name}{p.company_id == null && <Badge variant="outline">Padrão</Badge>}</CardTitle>
            {p.description && <CardDescription>{p.description}</CardDescription>}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Forma de recebimento</TableHead><TableHead className="text-right">Taxa</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map(([label, key]) => (
                  <TableRow key={String(key)}><TableCell>{label}</TableCell><TableCell className="text-right font-medium">{pct(p[key as string])}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ---------------- Maquininhas ---------------- */
export function NectaPosPage({ companyId }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: pos }, { data: sales }] = await Promise.all([
      (supabase as any).from('necta_pos').select('*').eq('company_id', companyId).order('created_at'),
      (supabase as any).from('necta_sales').select('amount, status, created_at, paid_at, raw')
        .eq('company_id', companyId).in('method', ['credit_card', 'debit_card', 'card', 'pos'])
        .order('created_at', { ascending: false }).limit(500),
    ]);
    const list = (pos ?? []).map((p: any) => {
      const keys = [p.necta_pos_id, p.serial_number].filter(Boolean).map(String);
      const mine = (sales ?? []).filter((s: any) => keys.length && keys.some(k => JSON.stringify(s.raw ?? {}).includes(k)));
      const paid = mine.filter((s: any) => s.status === 'paid');
      return {
        ...p,
        lastSale: mine[0]?.paid_at ?? mine[0]?.created_at ?? null,
        salesCount: paid.length,
        volume: paid.reduce((a: number, s: any) => a + Number(s.amount || 0), 0),
      };
    });
    setItems(list);
    setLoading(false);
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  const statusBadge = (s: string, bound: boolean) => {
    const active = bound || ['active', 'bound', 'in_use'].includes(String(s).toLowerCase());
    return <Badge variant={active ? 'default' : 'outline'}>{active ? 'Em operação' : s === 'available' ? 'Disponível' : s}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Maquininhas</h1>
          <p className="text-sm text-muted-foreground">Maquininhas configuradas para sua empresa, situação e uso</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-2" />Atualizar</Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Modelo</TableHead><TableHead>Nº de série</TableHead><TableHead>Situação</TableHead>
                <TableHead>Vinculada em</TableHead><TableHead>Última venda</TableHead>
                <TableHead className="text-right">Vendas</TableHead><TableHead className="text-right">Volume</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {items.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>{p.model ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{p.serial_number ?? '—'}</TableCell>
                    <TableCell>{statusBadge(p.status, !!p.establishment_id)}</TableCell>
                    <TableCell>{p.bound_at ? new Date(p.bound_at).toLocaleDateString('pt-BR') : '—'}</TableCell>
                    <TableCell>{p.lastSale ? new Date(p.lastSale).toLocaleString('pt-BR') : 'Sem uso registrado'}</TableCell>
                    <TableCell className="text-right">{p.salesCount}</TableCell>
                    <TableCell className="text-right">{brl(p.volume)}</TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhuma maquininha configurada para sua empresa</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- Transferir saldo ---------------- */
export function NectaTransferPage({ companyId }: Props) {
  const [profile, setProfile] = useState<any>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: prof }, { data: acc }] = await Promise.all([
        (supabase as any).from('necta_establishments').select('*').eq('company_id', companyId).eq('is_own_profile', true).maybeSingle(),
        (supabase as any).from('accounts').select('current_balance, source, is_mirror').eq('company_id', companyId),
      ]);
      setProfile(prof);
      const mirror = (acc ?? []).find((a: any) => a.source === 'necta' || a.is_mirror);
      setBalance(mirror ? Number(mirror.current_balance) : null);
      setLoading(false);
    })();
  }, [companyId]);

  const missing: string[] = [];
  if (!profile?.bank_code) missing.push('banco');
  if (!profile?.bank_agency) missing.push('agência');
  if (!profile?.bank_account) missing.push('conta');
  if (!profile?.bank_account_holder && !profile?.legal_name) missing.push('titular');
  if (!profile?.bank_account_document && !profile?.document) missing.push('documento do titular');

  const send = async () => {
    const v = Number(amount.replace(',', '.'));
    if (!v || v <= 0) { toast.error('Informe um valor válido'); return; }
    if (balance != null && v > balance) { toast.error('Valor maior que o saldo disponível'); return; }
    setSending(true);
    try {
      await nectaCall('/transfers', 'POST', {
        amount: Math.round(v * 100) / 100,
        bankAccount: {
          bankCode: profile.bank_code, agency: profile.bank_agency, account: profile.bank_account,
          accountType: profile.bank_account_type ?? 'CHECKING',
          holderName: profile.bank_account_holder || profile.legal_name,
          holderDocument: String(profile.bank_account_document || profile.document).replace(/\D/g, ''),
        },
      }, undefined, companyId);
      toast.success('Transferência solicitada');
      setAmount('');
    } catch (e) {
      toast.error('O gateway não aceitou a transferência', { description: (e as Error).message });
    }
    setSending(false);
  };

  if (loading) return <Loader2 className="h-5 w-5 animate-spin" />;

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Transferir saldo</h1>
        <p className="text-sm text-muted-foreground">Envie o saldo da Conta <PaymentsBrandName /> para a conta bancária da sua empresa</p>
      </div>
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Saldo disponível</p>
            <p className="text-2xl font-bold">{balance == null ? '—' : brl(balance)}</p>
          </div>
          {missing.length > 0 ? (
            <Alert variant="destructive"><AlertTriangle className="h-4 w-4" />
              <AlertDescription>Complete os dados bancários no perfil da empresa (Gerenciar Empresa → Cadastro): {missing.join(', ')}.</AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="rounded-md border p-3 text-sm space-y-1">
                <p className="font-medium">Conta de destino</p>
                <p>{profile.bank_name ?? profile.bank_code} — Ag. {profile.bank_agency} · Conta {profile.bank_account}</p>
                <p className="text-muted-foreground">{profile.bank_account_holder || profile.legal_name}</p>
              </div>
              <div><Label>Valor (R$)</Label><Input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" /></div>
              <Button onClick={send} disabled={sending}>
                {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}Transferir
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
