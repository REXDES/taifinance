import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { CreditCard, Receipt, TrendingUp, Activity } from 'lucide-react';

interface Props { companyId: string }

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function PaymentsDashboardPage({ companyId }: Props) {
  const [kpi, setKpi] = useState({ txCount: 0, txGross: 0, txNet: 0, chargesPending: 0, chargesPaid: 0, settlementsMonth: 0 });

  useEffect(() => {
    (async () => {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const iso = monthStart.toISOString();

      const [txRes, chgPendRes, chgPaidRes, setRes] = await Promise.all([
        (supabase as any).from('cappta_transactions').select('gross_amount, net_amount').eq('company_id', companyId).gte('captured_at', iso),
        (supabase as any).from('cappta_charges').select('amount', { count: 'exact' }).eq('company_id', companyId).eq('status', 'pending'),
        (supabase as any).from('cappta_charges').select('amount').eq('company_id', companyId).eq('status', 'paid').gte('paid_at', iso),
        (supabase as any).from('cappta_settlements').select('net_amount').eq('company_id', companyId).gte('settlement_date', monthStart.toISOString().slice(0, 10)),
      ]);
      const tx = txRes.data ?? [];
      const chgPaid = chgPaidRes.data ?? [];
      const settle = setRes.data ?? [];
      setKpi({
        txCount: tx.length,
        txGross: tx.reduce((s: number, t: any) => s + Number(t.gross_amount || 0), 0),
        txNet: tx.reduce((s: number, t: any) => s + Number(t.net_amount || 0), 0),
        chargesPending: chgPendRes.data?.reduce((s: number, c: any) => s + Number(c.amount || 0), 0) ?? 0,
        chargesPaid: chgPaid.reduce((s: number, c: any) => s + Number(c.amount || 0), 0),
        settlementsMonth: settle.reduce((s: number, r: any) => s + Number(r.net_amount || 0), 0),
      });
    })();
  }, [companyId]);

  const cards = [
    { title: 'Transações do mês', value: kpi.txCount, icon: <Activity className="w-4 h-4" /> },
    { title: 'Volume bruto (mês)', value: brl(kpi.txGross), icon: <TrendingUp className="w-4 h-4" /> },
    { title: 'Volume líquido (mês)', value: brl(kpi.txNet), icon: <TrendingUp className="w-4 h-4" /> },
    { title: 'Cobranças pendentes', value: brl(kpi.chargesPending), icon: <Receipt className="w-4 h-4" /> },
    { title: 'Cobranças pagas (mês)', value: brl(kpi.chargesPaid), icon: <Receipt className="w-4 h-4" /> },
    { title: 'Liquidações (mês)', value: brl(kpi.settlementsMonth), icon: <CreditCard className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pagamentos — Cappta</h1>
        <p className="text-muted-foreground">Visão geral das operações de pagamento</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Card key={c.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{c.title}</CardTitle>
              {c.icon}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
