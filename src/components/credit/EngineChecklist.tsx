import { CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import type { CreditRules, BureauAnalysis, LetraAE } from '@/hooks/useCreditModule';
import { CONFIANCA_OPTIONS, SUGESTAO_OPTIONS, LETRA_LABEL } from '@/hooks/useCreditModule';

type Status = 'pass' | 'fail' | 'na';
type Row = { label: string; actual: string; limit: string; status: Status; note?: string };

const LETRA_RANK: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5 };

const CONFIANCA_LABEL = Object.fromEntries(CONFIANCA_OPTIONS.map((o) => [o.value, o.label]));
const SUGESTAO_LABEL = Object.fromEntries(SUGESTAO_OPTIONS.map((o) => [o.value, o.label]));

function toInt(v: any): number {
  const n = parseInt(String(v ?? '').replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}
function toNum(v: any): number | null {
  if (v == null) return null;
  const s = String(v).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export function EngineChecklist({
  summary,
  bureau,
  rules,
  tipoDocumento,
}: {
  summary: Record<string, any>;
  bureau: BureauAnalysis | null | undefined;
  rules: CreditRules | null;
  tipoDocumento: 'CPF' | 'CNPJ';
}) {
  if (!rules) return null;

  const rows: Row[] = [];

  // Quantitative knockouts
  const protestos = toInt(summary.quantidade_protestos);
  rows.push({
    label: 'Protestos',
    actual: String(protestos),
    limit: `máx ${rules.max_protestos}`,
    status: protestos > rules.max_protestos ? 'fail' : 'pass',
  });
  const pend = toInt(summary.quantidade_pendencias_financeiras);
  rows.push({
    label: 'Pendências financeiras',
    actual: String(pend),
    limit: `máx ${rules.max_pendencias_financeiras}`,
    status: pend > rules.max_pendencias_financeiras ? 'fail' : 'pass',
  });
  const ccf = toInt(summary.quantidade_ccf_bacen) + toInt(summary.quantidade_ccf_varejo);
  rows.push({
    label: 'Cheques sem fundo (CCF)',
    actual: String(ccf),
    limit: `máx ${rules.max_ccf_total}`,
    status: ccf > rules.max_ccf_total ? 'fail' : 'pass',
  });
  const alertas = toInt(summary.quantidade_alertas_restricoes);
  rows.push({
    label: 'Alertas de restrição',
    actual: String(alertas),
    limit: `máx ${rules.max_alertas_restricoes}`,
    status: alertas > rules.max_alertas_restricoes ? 'fail' : 'pass',
  });

  // Bolsa família
  if (rules.bolsa_familia_block) {
    const dep = toInt(summary.qtd_dependentes_bolsa_familia);
    rows.push({
      label: 'Bolsa Família (dependentes)',
      actual: String(dep),
      limit: `máx ${rules.max_dependentes_bolsa_familia ?? 0}`,
      status: dep > (rules.max_dependentes_bolsa_familia ?? 0) ? 'fail' : 'pass',
    });
  }

  // Probabilidade de inadimplência
  const probRaw = toNum(summary.probabilidade_inadimplencia);
  const prob = probRaw != null ? Math.max(0, Math.min(100, Math.round(probRaw))) : null;
  const maxRisk = rules.max_probabilidade_inadimplencia ?? 100;
  rows.push({
    label: 'Risco de inadimplência',
    actual: prob != null ? `${prob}%` : '—',
    limit: `máx ${maxRisk}%`,
    status: prob == null ? 'na' : prob > maxRisk ? 'fail' : 'pass',
    note: prob != null ? `${100 - prob}% pagam` : undefined,
  });

  // Score analítico do bureau
  const scoreAnal = toNum(summary.score_analise);
  if ((rules.min_score_analise ?? 0) > 0) {
    rows.push({
      label: 'Score analítico (bureau)',
      actual: scoreAnal != null ? String(scoreAnal) : '—',
      limit: `mín ${rules.min_score_analise}`,
      status: scoreAnal == null ? 'na' : scoreAnal < rules.min_score_analise ? 'fail' : 'pass',
    });
  }

  // Nível de confiança
  const confBucket = bureau?.nivel_de_confianca_bucket || null;
  const blockConf = rules.min_nivel_confianca_levels || [];
  if (blockConf.length > 0) {
    rows.push({
      label: 'Nível de confiança',
      actual: confBucket ? CONFIANCA_LABEL[confBucket] || confBucket : '—',
      limit: `bloqueia: ${blockConf.map((b) => CONFIANCA_LABEL[b] || b).join(', ')}`,
      status: !confBucket ? 'na' : blockConf.includes(confBucket) ? 'fail' : 'pass',
    });
  }

  // Sugestão de negócio
  const sugBucket = bureau?.sugestao_de_negocio_bucket || null;
  const blockSug = Array.from(new Set([
    ...(rules.sugestao_negocio_block_levels || []),
    ...(rules.sugestao_negocio_block_buckets || []),
  ]));
  rows.push({
    label: 'Sugestão de negócio',
    actual: sugBucket ? SUGESTAO_LABEL[sugBucket] || sugBucket : (bureau?.sugestao_de_negocio_raw || '—'),
    limit: blockSug.length ? `bloqueia: ${blockSug.map((b) => SUGESTAO_LABEL[b] || b).join(', ')}` : '—',
    status: !sugBucket || blockSug.length === 0 ? 'na' : blockSug.includes(sugBucket) ? 'fail' : 'pass',
  });

  // Cortes A..E
  const evalLetra = (label: string, letra: string | null | undefined, maxLetra: LetraAE | undefined, kind: 'classificacao' | 'faturas' | 'contratos') => {
    if (!maxLetra) return;
    const L = (letra || '').toUpperCase();
    const r = LETRA_RANK[L];
    const max = LETRA_RANK[maxLetra];
    const actualLabel = L ? (LETRA_LABEL[L]?.[kind] || L) : '—';
    const maxLabel = LETRA_LABEL[maxLetra]?.[kind] || maxLetra;
    rows.push({
      label,
      actual: actualLabel,
      limit: `máx ${maxLabel}`,
      status: !r ? 'na' : r > max ? 'fail' : 'pass',
    });
  };
  evalLetra('Classificação do score', bureau?.classificacao_score_letra || summary.classificacao_score, rules.max_classificacao_score, 'classificacao');
  evalLetra('Faturas em atraso', bureau?.faturas_em_atraso_letra || summary.faturas_em_atraso, rules.max_faturas_em_atraso, 'faturas');
  evalLetra('Contratos recentes', bureau?.contratos_recentes_letra || summary.contratos_recentes, rules.max_contratos_recentes, 'contratos');

  // Idade / tempo de CNPJ poderiam ser adicionados aqui se summary expuser os dados.

  const fails = rows.filter((r) => r.status === 'fail').length;
  const passes = rows.filter((r) => r.status === 'pass').length;

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="text-sm font-semibold">Análise completa</div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" /> {passes} ok
          </span>
          <span className="flex items-center gap-1 text-destructive">
            <XCircle className="w-3.5 h-3.5" /> {fails} falha(s)
          </span>
        </div>
      </div>
      <ul className="divide-y">
        {rows.map((r, i) => (
          <li key={i} className="flex items-start gap-3 px-3 py-2 text-xs">
            <div className="mt-0.5">
              {r.status === 'pass' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              {r.status === 'fail' && <XCircle className="w-4 h-4 text-destructive" />}
              {r.status === 'na' && <MinusCircle className="w-4 h-4 text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-foreground">{r.label}</div>
              <div className="text-muted-foreground">
                Atual: <span className="text-foreground">{r.actual}</span>
                {r.note ? <span className="ml-2">({r.note})</span> : null}
              </div>
            </div>
            <div className="text-right text-muted-foreground whitespace-nowrap">{r.limit}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
