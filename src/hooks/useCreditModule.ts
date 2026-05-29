import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ScoreBand {
  min_score: number;
  max_score: number;
  classes?: string[];
  decision: 'approved' | 'manual' | 'rejected';
  percent_teto: number;
  max_parcelas: number;
}

export type LetraAE = 'A' | 'B' | 'C' | 'D' | 'E';

export interface CreditRules {
  id?: string;
  company_id: string;
  max_protestos: number;
  max_pendencias_financeiras: number;
  max_ccf_total: number;
  max_alertas_restricoes: number;
  min_idade_pf: number;
  min_meses_cnpj: number;
  max_dias_inadimplencia_interna: number;
  teto_credito: number;
  score_bands: ScoreBand[];
  juros_mensal_pct: number;
  multa_atraso_pct: number;
  mora_diaria_pct: number;
  parcela_minima: number;
  ia_similarity_threshold: number;
  ia_require_liveness: boolean;
  contract_clauses: string | null;
  bolsa_familia_block: boolean;
  max_dependentes_bolsa_familia: number;
  /** Máximo % de risco de inadimplência aceito (1..100, 1=melhor, 100=pior). Default 30. */
  max_probabilidade_inadimplencia: number;
  texto_pagamento_block_levels: string[];
  // Bureau analysis cut-offs (novo nó "resumo" do RedeBE)
  min_score_analise: number;
  use_bureau_limits: boolean;
  min_nivel_confianca_levels: string[];
  /** Lista (legada) de buckets fixos a bloquear. */
  sugestao_negocio_block_levels: string[];
  /** Lista dinâmica de buckets de sugestão de negócio a bloquear (interpretação dinâmica do texto). */
  sugestao_negocio_block_buckets: string[];
  consulta_price: number;
  // Cortes ordinais A..E (pior letra aceita)
  max_classificacao_score: LetraAE;
  max_faturas_em_atraso: LetraAE;
  max_contratos_recentes: LetraAE;
}

export const DEFAULT_RULES: Omit<CreditRules, 'company_id'> = {
  max_protestos: 0,
  max_pendencias_financeiras: 0,
  max_ccf_total: 0,
  max_alertas_restricoes: 0,
  min_idade_pf: 18,
  min_meses_cnpj: 6,
  max_dias_inadimplencia_interna: 30,
  teto_credito: 10000,
  score_bands: [
    { min_score: 700, max_score: 1000, classes: ['A', 'B'], decision: 'approved', percent_teto: 100, max_parcelas: 12 },
    { min_score: 550, max_score: 699, classes: ['C'], decision: 'approved', percent_teto: 60, max_parcelas: 6 },
    { min_score: 400, max_score: 549, classes: ['D'], decision: 'manual', percent_teto: 30, max_parcelas: 3 },
    { min_score: 0, max_score: 399, classes: ['E', 'F', 'G', 'H'], decision: 'rejected', percent_teto: 0, max_parcelas: 0 },
  ],
  juros_mensal_pct: 3.5,
  multa_atraso_pct: 2.0,
  mora_diaria_pct: 0.033,
  parcela_minima: 50,
  ia_similarity_threshold: 80,
  ia_require_liveness: true,
  contract_clauses: null,
  bolsa_familia_block: false,
  max_dependentes_bolsa_familia: 0,
  max_probabilidade_inadimplencia: 30,
  texto_inadimplencia_block_levels: [],
  min_score_analise: 0,
  use_bureau_limits: false,
  min_nivel_confianca_levels: [],
  sugestao_negocio_block_levels: [],
  sugestao_negocio_block_buckets: ['nao_recomendar'],
  consulta_price: 0,
  max_classificacao_score: 'C',
  max_faturas_em_atraso: 'C',
  max_contratos_recentes: 'E',
};

export interface CreditApplication {
  id: string;
  company_id: string;
  client_supplier_id: string | null;
  documento: string;
  tipo_documento: 'CPF' | 'CNPJ';
  nome: string | null;
  current_step: number;
  status: string;
  score: number | null;
  classification: string | null;
  approved_limit: number | null;
  decision: 'approved' | 'manual' | 'rejected' | null;
  decision_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  probabilidade_inadimplencia?: number | null;
  texto_score_bucket?: string | null;
  bureau_analysis?: BureauAnalysis | null;
}

export interface ScoreBreakdown {
  score: number | null;
  score_analise: number | null;
  score_rating: number | null;
  media: number | null;
}

export interface BureauAnalysis {
  score_analise: number | null;
  max_parcelas: number | null;
  parcela_maxima: number | null;
  limite_sugerido: number | null;
  nivel_de_confianca_raw: string | null;
  nivel_de_confianca_bucket: string | null;
  nivel_de_confianca_label: string | null;
  descricao_rating: string | null;
  observacao_credito: string | null;
  sugestao_de_negocio_raw: string | null;
  sugestao_de_negocio_bucket: string | null;
  sugestao_de_negocio_label: string | null;
  score_breakdown?: ScoreBreakdown | null;
  classificacao_score_letra?: string | null;
  faturas_em_atraso_letra?: string | null;
  contratos_recentes_letra?: string | null;
  faturas_em_atraso_raw?: string | null;
  contratos_recentes_raw?: string | null;
}

export const CONFIANCA_OPTIONS = [
  { value: 'muito_baixo', label: 'Muito Baixo' },
  { value: 'baixo', label: 'Baixo' },
  { value: 'medio', label: 'Médio' },
  { value: 'alto', label: 'Alto' },
  { value: 'muito_alto', label: 'Muito Alto' },
];
export const SUGESTAO_OPTIONS = [
  { value: 'nao_recomendar', label: 'Não recomendar' },
  { value: 'recomendar_com_cautela', label: 'Recomendar com cautela / ressalva' },
  { value: 'recomendar', label: 'Recomendar' },
  { value: 'desconhecido', label: 'Desconhecido / não classificado' },
];

export const LETRAS_AE: LetraAE[] = ['A', 'B', 'C', 'D', 'E'];
export const LETRA_LABEL: Record<string, { classificacao: string; faturas: string; contratos: string }> = {
  A: { classificacao: 'A — Ótimo', faturas: 'A — Pontual', contratos: 'A — Relacionamento recente' },
  B: { classificacao: 'B — Bom', faturas: 'B — Atrasos leves', contratos: 'B — Relacionamento ativo' },
  C: { classificacao: 'C — Regular', faturas: 'C — Atrasos moderados', contratos: 'C — Relacionamento médio' },
  D: { classificacao: 'D — Ruim', faturas: 'D — Mau pagador', contratos: 'D — Relacionamento antigo' },
  E: { classificacao: 'E — Péssimo', faturas: 'E — Muito mau pagador', contratos: 'E — Sem relacionamento' },
};

// Textual classification of the score remains "probabilidade de pagamento"
export const PAYMENT_BUCKET_LABEL: Record<string, string> = {
  muito_baixa: 'Muito Baixa',
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  muito_alta: 'Muito Alta',
};
export const PAYMENT_BUCKET_HINT: Record<string, string> = {
  muito_baixa: 'pior',
  baixa: 'ruim',
  media: 'média',
  alta: 'boa',
  muito_alta: 'melhor',
};

/**
 * Converte a probabilidade de INADIMPLÊNCIA do bureau (1..100, % de risco)
 * em probabilidade de PAGAMENTO (= 100 - inadimplência).
 * Ex.: inadimplência 9 → pagamento 91.
 */
export function toPaymentProbability(rawInadimplencia: number | null | undefined): number | null {
  if (rawInadimplencia == null) return null;
  const n = Number(rawInadimplencia);
  if (!Number.isFinite(n)) return null;
  const clamped = Math.max(0, Math.min(100, Math.round(n)));
  return 100 - clamped;
}

export function useCompanyCreditFlag(companyId: string | null) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    if (!companyId) { setEnabled(false); setLoading(false); return; }
    setLoading(true);
    const { data } = await (supabase as any)
      .from('companies')
      .select('credit_module_enabled')
      .eq('id', companyId)
      .maybeSingle();
    setEnabled(!!data?.credit_module_enabled);
    setLoading(false);
  }, [companyId]);
  useEffect(() => { refetch(); }, [refetch]);
  return { enabled, loading, refetch };
}

export function useCreditRules(companyId: string | null) {
  const [rules, setRules] = useState<CreditRules | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!companyId) { setRules(null); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('credit_rules')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();
    if (error) console.error('credit_rules fetch', error);
    if (data) {
      // Garante campos novos com defaults
      setRules({
        ...DEFAULT_RULES,
        ...(data as any),
        company_id: companyId,
      } as CreditRules);
    } else {
      setRules({ ...DEFAULT_RULES, company_id: companyId });
    }
    setLoading(false);
  }, [companyId]);

  useEffect(() => { refetch(); }, [refetch]);

  const save = async (next: CreditRules) => {
    if (!companyId) return false;
    const payload = { ...next, company_id: companyId };
    const { error } = await (supabase as any)
      .from('credit_rules')
      .upsert(payload, { onConflict: 'company_id' });
    if (error) {
      console.error(error);
      toast.error('Erro ao salvar regras: ' + error.message);
      return false;
    }
    toast.success('Regras salvas');
    await refetch();
    return true;
  };

  return { rules, loading, refetch, save };
}

export function useCreditApplications(companyId: string | null) {
  const [applications, setApplications] = useState<CreditApplication[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!companyId) { setApplications([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('credit_applications')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) console.error('credit_applications fetch', error);
    setApplications((data || []) as CreditApplication[]);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { refetch(); }, [refetch]);

  return { applications, loading, refetch };
}

export interface ConsultResult {
  documento: string;
  tipo_documento: 'CPF' | 'CNPJ';
  nome: string;
  summary: Record<string, string>;
  principal: any;
  engine: {
    decision: 'approved' | 'manual' | 'rejected';
    approved_limit: number;
    max_parcelas: number;
    score: number;
    classification: string;
    reason: string;
    knockouts: string[];
  };
  consultation_id?: string;
  ignored_adjustments?: Array<{ category: string; field: string; subtracted: number; before: string; after: string }>;
  pdf_data?: string | null;
  texto_score_bucket?: string | null;
  probabilidade_inadimplencia?: number | null;
  bureau_analysis?: BureauAnalysis | null;
}

export async function consultCredit(params: {
  documento: string;
  company_id: string;
  application_id?: string;
  test_only?: boolean;
  reuse_last?: boolean;
}): Promise<ConsultResult> {
  const { data, error } = await supabase.functions.invoke('credit-consult', { body: params });
  if (error) throw new Error(error.message || 'Erro na consulta');
  if (data?.error) throw new Error(data.error);
  return data as ConsultResult;
}
