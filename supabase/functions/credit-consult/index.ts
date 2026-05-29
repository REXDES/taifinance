// Edge function: credit-consult
// Calls RedeBE API (Crédito Essencial Positivo), runs decision engine, persists consultation.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REDEBE_ENDPOINT = "https://consultas.redebe.com.br/api/v1/credito/credito-essencial-positivo";

interface RedeBESummary {
  score?: string;
  classificacao_score?: string;
  probabilidade_inadimplencia?: string;
  texto_score?: string;
  situacao_cpf?: string;
  nome?: string;
  data_nascimento?: string;
  quantidade_pendencias_financeiras?: string;
  valor_total_pendencias_financeiras?: string;
  quantidade_protestos?: string;
  valor_total_protestos?: string;
  quantidade_acoes_civeis?: string;
  quantidade_alertas_restricoes?: string;
  quantidade_ccf_bacen?: string;
  quantidade_ccf_varejo?: string;
  qtd_dependentes_bolsa_familia?: string;
  // Resumo analítico
  score_analise?: string;
  score_rating?: string;
  max_parcelas?: string;
  parcela_maxima?: string;
  limite_sugerido?: string;
  nivel_de_confianca?: string;
  descricao_rating?: string;
  observacao_credito?: string;
  sugestao_de_negocio?: string;
  faturas_em_atraso?: string;
  contratos_recentes?: string;
}

interface ScoreBand {
  min_score: number;
  max_score: number;
  classes?: string[];
  decision: "approved" | "manual" | "rejected";
  percent_teto: number;
  max_parcelas: number;
}

interface CreditRules {
  max_protestos: number;
  max_pendencias_financeiras: number;
  max_ccf_total: number;
  max_alertas_restricoes: number;
  min_idade_pf: number;
  min_meses_cnpj: number;
  teto_credito: number;
  score_bands: ScoreBand[];
  bolsa_familia_block?: boolean;
  max_dependentes_bolsa_familia?: number;
  /** Máx. % de risco de inadimplência aceito (1..100, 1=melhor pagador, 100=pior). */
  max_probabilidade_inadimplencia?: number;
  texto_inadimplencia_block_levels?: string[];
  // Bureau analysis cut-offs
  min_score_analise?: number;
  use_bureau_limits?: boolean;
  min_nivel_confianca_levels?: string[];
  sugestao_negocio_block_levels?: string[];
  sugestao_negocio_block_buckets?: string[];
  // Cortes A..E (pior letra aceita)
  max_classificacao_score?: string;
  max_faturas_em_atraso?: string;
  max_contratos_recentes?: string;
}

// A=1 melhor, E=5 pior
function letterRank(l?: string | null): number | null {
  if (!l) return null;
  const c = String(l).trim().toUpperCase().charAt(0);
  const idx = ['A', 'B', 'C', 'D', 'E'].indexOf(c);
  return idx >= 0 ? idx + 1 : null;
}
function extractLetraAE(raw: any): string | null {
  if (raw == null) return null;
  const s = String(raw).trim().toUpperCase();
  const m = s.match(/\b([A-E])\b/);
  return m ? m[1] : null;
}

// ---- Bureau "resumo" analytical helpers ----
function toNumberLoose(v: any): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  // strip currency / thousand separators, keep last decimal comma/dot
  const cleaned = s.replace(/[R$\s]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}
function classifyConfianca(v: string | undefined | null): string | null {
  if (!v) return null;
  const s = String(v).toLowerCase();
  if (/muito\s+alt/.test(s)) return 'muito_alto';
  if (/muito\s+baix/.test(s)) return 'muito_baixo';
  if (/\balt/.test(s)) return 'alto';
  if (/\bbaix/.test(s)) return 'baixo';
  if (/\bm[eé]di/.test(s)) return 'medio';
  return null;
}
function classifySugestao(v: string | undefined | null): string | null {
  if (!v) return null;
  const s = String(v).toLowerCase().trim();
  if (!s) return null;
  if (/n[aã]o\s+recomend|negar|recus|reprov|inviab|n[aã]o\s+aprov/.test(s)) return 'nao_recomendar';
  if (/cautel|atenç|ressalva|analis[ae]\s+manual|aprov.*restri|com\s+restri|moderad/.test(s)) return 'recomendar_com_cautela';
  if (/recomend|aprov|liber|via?vel|positiv/.test(s)) return 'recomendar';
  return 'desconhecido';
}
const CONFIANCA_LABEL: Record<string, string> = {
  muito_baixo: 'Muito Baixo', baixo: 'Baixo', medio: 'Médio', alto: 'Alto', muito_alto: 'Muito Alto',
};
const SUGESTAO_LABEL: Record<string, string> = {
  recomendar: 'Recomendar',
  recomendar_com_cautela: 'Recomendar com cautela / ressalva',
  nao_recomendar: 'Não recomendar',
  desconhecido: 'Não classificado',
};

// Classify the score "texto" into a probability bucket
function classifyTextoInadimplencia(t: string | undefined | null): string | null {
  if (!t) return null;
  const s = String(t).toLowerCase();
  if (/muito\s+alta/.test(s)) return 'muito_alta';
  if (/muito\s+baixa/.test(s)) return 'muito_baixa';
  if (/\balta\b/.test(s)) return 'alta';
  if (/\bbaixa\b/.test(s)) return 'baixa';
  if (/\bm[eé]dia\b/.test(s)) return 'media';
  return null;
}

function toInt(s: string | undefined | null): number {
  if (!s) return 0;
  const n = parseInt(String(s).replace(/\D/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

function onlyDigits(s: string): string {
  return (s || "").replace(/\D/g, "");
}

function diffMonths(dateStr: string | undefined | null): number {
  // dateStr from RedeBE: "DD/MM/YYYY"
  if (!dateStr) return 0;
  const m = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return 0;
  const d = new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00`);
  const now = new Date();
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
}

function computeScoreBreakdown(summary: RedeBESummary): {
  score: number | null;
  score_analise: number | null;
  score_rating: number | null;
  media: number | null;
} {
  const s = toNumberLoose(summary.score);
  const sa = toNumberLoose(summary.score_analise);
  const sr = toNumberLoose(summary.score_rating);
  const vals = [s, sa, sr].filter((v): v is number => v != null && Number.isFinite(v));
  const media = vals.length > 0 ? Math.round(vals.reduce((acc, v) => acc + v, 0) / vals.length) : null;
  return {
    score: s != null ? Math.round(s) : null,
    score_analise: sa != null ? Math.round(sa) : null,
    score_rating: sr != null ? Math.round(sr) : null,
    media,
  };
}

function runDecisionEngine(opts: {
  rules: CreditRules;
  summary: RedeBESummary;
  principal: any;
  tipo_documento: "CPF" | "CNPJ";
  overriddenCriteria?: Set<string>;
}): {
  decision: "approved" | "manual" | "rejected";
  approved_limit: number;
  max_parcelas: number;
  score: number;
  classification: string;
  reason: string;
  knockouts: string[];
  score_breakdown: ReturnType<typeof computeScoreBreakdown>;
} {
  const { rules, summary, principal, tipo_documento } = opts;
  const overridden = opts.overriddenCriteria || new Set<string>();
  const knockouts: string[] = [];
  const pushKO = (criterion: string, msg: string) => {
    if (overridden.has(criterion)) return;
    knockouts.push(msg);
  };

  // PJ: checar situação ATIVA
  if (tipo_documento === "CNPJ") {
    const situacao = principal?.CREDCADASTRAL?.INFORMACOES_DA_EMPRESA?.SITUACAO || "";
    if (situacao && situacao.toUpperCase() !== "ATIVO" && situacao.toUpperCase() !== "ATIVA") {
      pushKO('cnpj_situacao', `CNPJ não está ATIVO (situação: ${situacao})`);
    }
    const fundacao = principal?.CREDCADASTRAL?.INFORMACOES_DA_EMPRESA?.DATA_FUNDACAO;
    const meses = diffMonths(fundacao);
    if (meses > 0 && meses < rules.min_meses_cnpj) {
      pushKO('cnpj_meses', `CNPJ ativo há ${meses} meses (mínimo: ${rules.min_meses_cnpj})`);
    }
  }

  // Knock-outs por quantidade
  const protestos = toInt(summary.quantidade_protestos);
  if (protestos > rules.max_protestos) {
    pushKO('protestos', `${protestos} protesto(s) — máximo permitido: ${rules.max_protestos}`);
  }
  const pendencias = toInt(summary.quantidade_pendencias_financeiras);
  if (pendencias > rules.max_pendencias_financeiras) {
    pushKO('pendencias_financeiras', `${pendencias} pendência(s) financeira(s) — máximo permitido: ${rules.max_pendencias_financeiras}`);
  }
  const ccfTotal = toInt(summary.quantidade_ccf_bacen) + toInt(summary.quantidade_ccf_varejo);
  if (ccfTotal > rules.max_ccf_total) {
    pushKO('ccf', `${ccfTotal} cheque(s) sem fundo (CCF) — máximo permitido: ${rules.max_ccf_total}`);
  }
  const alertas = toInt(summary.quantidade_alertas_restricoes);
  if (alertas > rules.max_alertas_restricoes) {
    pushKO('alertas_restricoes', `${alertas} alerta(s) de restrição — máximo permitido: ${rules.max_alertas_restricoes}`);
  }

  // Bolsa Família
  const depBF = toInt(summary.qtd_dependentes_bolsa_familia);
  if (rules.bolsa_familia_block && depBF > (rules.max_dependentes_bolsa_familia ?? 0)) {
    pushKO('bolsa_familia', `Beneficiário do Bolsa Família (${depBF} dependente(s)) — máximo permitido: ${rules.max_dependentes_bolsa_familia ?? 0}`);
  }

  // Probabilidade de INADIMPLÊNCIA
  const probRaw = toNumberLoose(summary.probabilidade_inadimplencia);
  const probNum = probRaw != null ? Math.max(0, Math.min(100, Math.round(probRaw))) : null;
  const maxRisk = rules.max_probabilidade_inadimplencia ?? 100;
  if (probNum != null && probNum > maxRisk) {
    pushKO('probabilidade_inadimplencia', `Risco de inadimplência ${probNum}% acima do máximo permitido (${maxRisk}%)`);
  }

  // Texto interpretativo do score
  const blockLevels = rules.texto_inadimplencia_block_levels || [];
  if (blockLevels.length > 0) {
    const bucket = classifyTextoInadimplencia(summary.texto_score);
    if (bucket && blockLevels.includes(bucket)) {
      pushKO('texto_score', `Análise textual do score indica probabilidade "${bucket.replace('_',' ')}" de pagamento`);
    }
  }

  // ---- Knockouts: análise do bureau (nó "resumo") ----
  const scoreAnalise = toNumberLoose(summary.score_analise);
  const minScoreAnalise = rules.min_score_analise ?? 0;
  if (minScoreAnalise > 0 && scoreAnalise != null && scoreAnalise < minScoreAnalise) {
    pushKO('score_analise', `Score analítico do bureau ${scoreAnalise} abaixo do mínimo (${minScoreAnalise})`);
  }
  const confiancaBucket = classifyConfianca(summary.nivel_de_confianca);
  const blockConf = rules.min_nivel_confianca_levels || [];
  if (blockConf.length > 0 && confiancaBucket && blockConf.includes(confiancaBucket)) {
    pushKO('nivel_de_confianca', `Nível de confiança do bureau "${CONFIANCA_LABEL[confiancaBucket] || confiancaBucket}" não atende ao critério mínimo`);
  }
  const sugestaoBucket = classifySugestao(summary.sugestao_de_negocio);
  const blockSug = Array.from(new Set([
    ...(rules.sugestao_negocio_block_levels || []),
    ...(rules.sugestao_negocio_block_buckets || []),
  ]));
  if (blockSug.length > 0 && sugestaoBucket && blockSug.includes(sugestaoBucket)) {
    pushKO('sugestao_negocio', `Sugestão de negócio do bureau: "${SUGESTAO_LABEL[sugestaoBucket] || sugestaoBucket}" — ${summary.sugestao_de_negocio || ''}`.trim());
  }

  // ---- Knockouts ordinais A..E ----
  const evalLetra = (criterion: string, label: string, raw: any, maxLetra?: string) => {
    if (!maxLetra) return;
    const letra = extractLetraAE(raw);
    if (!letra) return;
    const r = letterRank(letra)!;
    const max = letterRank(maxLetra);
    if (max != null && r > max) {
      pushKO(criterion, `${label}: ${letra} pior que o máximo aceito (${maxLetra})`);
    }
  };
  evalLetra('classificacao_score', 'Classificação do score', summary.classificacao_score, rules.max_classificacao_score);
  evalLetra('faturas_em_atraso', 'Faturas em atraso', summary.faturas_em_atraso, rules.max_faturas_em_atraso);
  evalLetra('contratos_recentes', 'Contratos recentes', summary.contratos_recentes, rules.max_contratos_recentes);


  // Score usado pela régua = MÉDIA dos scores disponíveis
  const breakdown = computeScoreBreakdown(summary);
  const score = breakdown.media ?? (breakdown.score ?? 0);
  const classification = (summary.classificacao_score || "").toUpperCase();

  if (knockouts.length > 0) {
    return {
      decision: "rejected",
      approved_limit: 0,
      max_parcelas: 0,
      score,
      classification,
      reason: knockouts.join("; "),
      knockouts,
      score_breakdown: breakdown,
    };
  }

  // Faixa por score (média)
  const band =
    rules.score_bands.find(
      (b) =>
        score >= b.min_score &&
        score <= b.max_score &&
        (!b.classes || b.classes.length === 0 || b.classes.includes(classification))
    ) ||
    rules.score_bands.find((b) => score >= b.min_score && score <= b.max_score);

  if (!band || band.decision === "rejected") {
    return {
      decision: "rejected",
      approved_limit: 0,
      max_parcelas: 0,
      score,
      classification,
      reason: `Score médio ${score} (classe ${classification}) abaixo dos critérios mínimos`,
      knockouts,
      score_breakdown: breakdown,
    };
  }

  let limit = Math.round((rules.teto_credito * band.percent_teto) / 100);
  let parcelas = band.max_parcelas;
  let bureauCapApplied = "";

  if (rules.use_bureau_limits) {
    const limBureau = toNumberLoose(summary.limite_sugerido);
    const parcBureau = toNumberLoose(summary.max_parcelas);
    if (limBureau != null && limBureau > 0 && limBureau < limit) {
      limit = Math.round(limBureau);
      bureauCapApplied += ` Limite reduzido para R$ ${limit.toLocaleString('pt-BR')} (sugerido pelo bureau).`;
    }
    if (parcBureau != null && parcBureau > 0 && parcBureau < parcelas) {
      parcelas = Math.floor(parcBureau);
      bureauCapApplied += ` Parcelas reduzidas para ${parcelas}x (máximo do bureau).`;
    }
  }

  return {
    decision: band.decision,
    approved_limit: limit,
    max_parcelas: parcelas,
    score,
    classification,
    reason:
      (band.decision === "approved"
        ? `Aprovado com base no score médio ${score} (classe ${classification}) — ${band.percent_teto}% do teto`
        : `Score médio ${score} (classe ${classification}) requer análise manual`) + bureauCapApplied,
    knockouts,
    score_breakdown: breakdown,
  };
}

// Build the interpreted bureau analysis object used both for display and persistence.
function buildBureauAnalysis(summary: RedeBESummary) {
  const confiancaBucket = classifyConfianca(summary.nivel_de_confianca);
  const sugestaoBucket = classifySugestao(summary.sugestao_de_negocio);
  return {
    score_analise: toNumberLoose(summary.score_analise),
    max_parcelas: toNumberLoose(summary.max_parcelas),
    parcela_maxima: toNumberLoose(summary.parcela_maxima),
    limite_sugerido: toNumberLoose(summary.limite_sugerido),
    nivel_de_confianca_raw: summary.nivel_de_confianca || null,
    nivel_de_confianca_bucket: confiancaBucket,
    nivel_de_confianca_label: confiancaBucket ? CONFIANCA_LABEL[confiancaBucket] : null,
    descricao_rating: summary.descricao_rating || null,
    observacao_credito: summary.observacao_credito || null,
    sugestao_de_negocio_raw: summary.sugestao_de_negocio || null,
    sugestao_de_negocio_bucket: sugestaoBucket,
    sugestao_de_negocio_label: sugestaoBucket ? SUGESTAO_LABEL[sugestaoBucket] : null,
    score_breakdown: computeScoreBreakdown(summary),
    classificacao_score_letra: extractLetraAE(summary.classificacao_score),
    faturas_em_atraso_letra: extractLetraAE(summary.faturas_em_atraso),
    contratos_recentes_letra: extractLetraAE(summary.contratos_recentes),
    faturas_em_atraso_raw: summary.faturas_em_atraso || null,
    contratos_recentes_raw: summary.contratos_recentes || null,
  };
}


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const REDEBE_API_TOKEN = Deno.env.get("REDEBE_API_TOKEN");
    if (!REDEBE_API_TOKEN) {
      return new Response(
        JSON.stringify({ error: "REDEBE_API_TOKEN não configurado. Configure o token nas Configurações do projeto." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { documento, company_id, application_id, test_only, reuse_last } = await req.json();

    if (!documento || !company_id) {
      return new Response(
        JSON.stringify({ error: "documento e company_id são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const documentoLimpo = onlyDigits(documento);
    if (documentoLimpo.length !== 11 && documentoLimpo.length !== 14) {
      return new Response(
        JSON.stringify({ error: "Documento inválido (use CPF com 11 dígitos ou CNPJ com 14)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const tipo_documento: "CPF" | "CNPJ" = documentoLimpo.length === 11 ? "CPF" : "CNPJ";

    // Service-role client to verify access + write
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Verifica acesso à empresa
    const { data: hasAccess } = await supabase.rpc("has_company_access", {
      _user_id: userId,
      _company_id: company_id,
    });
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Sem acesso à empresa" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Carrega regras (ou usa default se ainda não criadas)
    const { data: rulesRow } = await supabase
      .from("credit_rules")
      .select("*")
      .eq("company_id", company_id)
      .maybeSingle();

    const rules: CreditRules = rulesRow
      ? (rulesRow as any)
      : {
          max_protestos: 0,
          max_pendencias_financeiras: 0,
          max_ccf_total: 0,
          max_alertas_restricoes: 0,
          min_idade_pf: 18,
          min_meses_cnpj: 6,
          teto_credito: 10000,
          score_bands: [
            { min_score: 700, max_score: 1000, classes: ["A", "B"], decision: "approved", percent_teto: 100, max_parcelas: 12 },
            { min_score: 550, max_score: 699, classes: ["C"], decision: "approved", percent_teto: 60, max_parcelas: 6 },
            { min_score: 400, max_score: 549, classes: ["D"], decision: "manual", percent_teto: 30, max_parcelas: 3 },
            { min_score: 0, max_score: 399, classes: ["E", "F", "G", "H"], decision: "rejected", percent_teto: 0, max_parcelas: 0 },
          ],
        };

    // Consulta RedeBE — OU reaproveita última consulta (modo reuse_last)
    let wrapper: any;
    let reusedConsultationId: string | null = null;
    if (reuse_last) {
      let q = supabase
        .from("credit_consultations")
        .select("id, application_id, raw_response")
        .eq("company_id", company_id)
        .eq("documento", documentoLimpo)
        .order("created_at", { ascending: false })
        .limit(1);
      if (application_id) q = q.eq("application_id", application_id) as any;
      let { data: lastConsult } = await q.maybeSingle();
      // fallback: if filtering by application_id returned nothing, try without
      if (!lastConsult && application_id) {
        const { data: any2 } = await supabase
          .from("credit_consultations")
          .select("id, application_id, raw_response")
          .eq("company_id", company_id)
          .eq("documento", documentoLimpo)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        lastConsult = any2 as any;
      }
      if (!lastConsult?.raw_response) {
        return new Response(
          JSON.stringify({ error: "Nenhuma consulta anterior encontrada para reavaliar. Realize uma nova consulta." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const raw = (lastConsult as any).raw_response;
      wrapper = Array.isArray(raw) ? raw[0] : raw;
      reusedConsultationId = (lastConsult as any).id ?? null;
      console.log(`[credit-consult] reuse_last for ${documentoLimpo}`);
    } else {
      console.log(`[credit-consult] consulting RedeBE for ${tipo_documento} ${documentoLimpo}`);
      const redebeResp = await fetch(REDEBE_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${REDEBE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ documento: documentoLimpo, include_pdf: true }),
      });

      const redebeBodyText = await redebeResp.text();
      let redebeJson: any;
      try {
        redebeJson = JSON.parse(redebeBodyText);
      } catch {
        console.error("[credit-consult] RedeBE non-JSON:", redebeBodyText);
        return new Response(
          JSON.stringify({ error: "RedeBE retornou resposta inválida", details: redebeBodyText.slice(0, 500) }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!redebeResp.ok) {
        console.error("[credit-consult] RedeBE error", redebeResp.status, redebeJson);
        return new Response(
          JSON.stringify({ error: `RedeBE retornou status ${redebeResp.status}`, details: redebeJson }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // RedeBE responde como array; pegar [0]
      wrapper = Array.isArray(redebeJson) ? redebeJson[0] : redebeJson;
    }
    const redeBlock = wrapper?.RedeBE || wrapper?.data?.RedeBE || wrapper;
    const summary: RedeBESummary = { ...(redeBlock?.resumo || {}) };
    const principal = redeBlock?.retorno?.principal || {};

    // Backfill summary fields from principal/raw if not present in resumo
    const findFirstDeep = (node: any, predicate: (k: string, v: any) => boolean): any => {
      if (!node || typeof node !== 'object') return undefined;
      if (Array.isArray(node)) {
        for (const item of node) { const r = findFirstDeep(item, predicate); if (r !== undefined) return r; }
        return undefined;
      }
      for (const [k, v] of Object.entries(node)) {
        if (predicate(k, v)) return v;
      }
      for (const v of Object.values(node)) {
        if (v && typeof v === 'object') { const r = findFirstDeep(v, predicate); if (r !== undefined) return r; }
      }
      return undefined;
    };
    if (!summary.texto_score) {
      const t = findFirstDeep(redeBlock, (k, v) =>
        (typeof v === 'string' || typeof v === 'number') &&
        /^TEXTO(_SCORE)?$/i.test(k)
      );
      if (t != null) summary.texto_score = String(t);
    }
    if (!summary.qtd_dependentes_bolsa_familia) {
      const bf = findFirstDeep(redeBlock, (k, v) =>
        (typeof v === 'string' || typeof v === 'number') &&
        /bolsa.*familia|qtd.*dependentes.*bolsa/i.test(k)
      );
      if (bf != null) summary.qtd_dependentes_bolsa_familia = String(bf);
    }
    if (!summary.probabilidade_inadimplencia) {
      const p = findFirstDeep(redeBlock, (k, v) =>
        (typeof v === 'string' || typeof v === 'number') &&
        /probabilidade.*inadimpl/i.test(k)
      );
      if (p != null) summary.probabilidade_inadimplencia = String(p);
    }

    // Backfill novos campos do nó "resumo" (análise do bureau)
    const backfillIfMissing = (field: keyof RedeBESummary, regex: RegExp) => {
      if ((summary as any)[field]) return;
      const v = findFirstDeep(redeBlock, (k, val) =>
        (typeof val === 'string' || typeof val === 'number') && regex.test(k)
      );
      if (v != null) (summary as any)[field] = String(v);
    };
    backfillIfMissing('score_analise', /^score[_\s-]?an[aá]lise$/i);
    backfillIfMissing('max_parcelas', /^max[_\s-]?parcelas$/i);
    backfillIfMissing('parcela_maxima', /^parcela[_\s-]?m[aá]xima$/i);
    backfillIfMissing('limite_sugerido', /^limite[_\s-]?sugerido$/i);
    backfillIfMissing('nivel_de_confianca', /n[ií]vel[_\s-]?de?[_\s-]?confian[cç]a/i);
    backfillIfMissing('descricao_rating', /descri[cç][aã]o[_\s-]?rating/i);
    backfillIfMissing('observacao_credito', /observa[cç][aã]o[_\s-]?cr[eé]dito/i);
    backfillIfMissing('sugestao_de_negocio', /sugest[aã]o[_\s-]?de?[_\s-]?neg[oó]cio/i);
    backfillIfMissing('score_rating', /^score[_\s-]?rating$/i);
    backfillIfMissing('faturas_em_atraso', /fatura.*atras|atraso.*fatura/i);
    backfillIfMissing('contratos_recentes', /contrato.*recent|recent.*contrato/i);



    // ----- Ocorrências ignoradas (alçada aprovada) -----
    // Escopo: 'application' (só esta proposta), 'document' (todas do cliente),
    // 'global' (todas as propostas da empresa).
    const { data: ignoredRowsRaw } = await supabase
      .from("credit_ignored_occurrences")
      .select("category, scope, documento, application_id")
      .eq("company_id", company_id)
      .eq("status", "approved");

    const ignoredRows = (ignoredRowsRaw || []).filter((r: any) => {
      const scope = r.scope || 'document';
      if (scope === 'global') return true;
      if (scope === 'document') return r.documento === documentoLimpo;
      if (scope === 'application') return application_id && r.application_id === application_id;
      return false;
    });

    const CATEGORY_TO_SUMMARY_FIELDS: Record<string, string[]> = {
      "Alertas / Restrições": ["quantidade_alertas_restricoes"],
      "Protestos": ["quantidade_protestos"],
      "Pendências Financeiras": ["quantidade_pendencias_financeiras"],
      "Cheques sem Fundo (CCF)": ["quantidade_ccf_bacen", "quantidade_ccf_varejo"],
      "Ações Cíveis": ["quantidade_acoes_civeis"],
    };
    const ignoredCountByCategory: Record<string, number> = {};
    for (const r of ignoredRows) {
      ignoredCountByCategory[(r as any).category] = (ignoredCountByCategory[(r as any).category] || 0) + 1;
    }
    const ignoredAdjustments: Array<{ category: string; field: string; subtracted: number; before: string; after: string }> = [];
    for (const [cat, count] of Object.entries(ignoredCountByCategory)) {
      const fields = CATEGORY_TO_SUMMARY_FIELDS[cat] || [];
      let remaining = count;
      for (const f of fields) {
        if (remaining <= 0) break;
        const before = parseInt(String((summary as any)[f] ?? "0").replace(/\D/g, ""), 10) || 0;
        const take = Math.min(before, remaining);
        const after = before - take;
        if (take > 0) {
          (summary as any)[f] = String(after);
          ignoredAdjustments.push({ category: cat, field: f, subtracted: take, before: String(before), after: String(after) });
          remaining -= take;
        }
      }
    }

    // Motor de decisão (rodando sobre o summary já ajustado)
    const engine = runDecisionEngine({ rules, summary, principal, tipo_documento });

    // Nome — tenta vários caminhos
    const nome =
      summary.nome ||
      principal?.CREDCADASTRAL?.INFORMACOES_DA_EMPRESA?.RAZAO_SOCIAL ||
      principal?.CREDCADASTRAL?.HEADER?.PARAMETROS?.NOME ||
      principal?.CREDCADASTRAL?.HEADER?.PARAMETROS?.RAZAO_SOCIAL ||
      "";

    // Extract PDF "espelho" from the response, if present.
    // RedeBE typically returns: redebe_pdf_disponivel (bool), redebe_pdf_base64 (string|null), redebe_pdf_nome_arquivo (string|null)
    const pdfBase64 = findFirstDeep(wrapper, (k, v) =>
      typeof v === 'string' && v.length > 100 &&
      /^(redebe_pdf_base64|pdf_base64|pdf)$/i.test(k)
    );
    const pdfUrl = findFirstDeep(wrapper, (k, v) =>
      typeof v === 'string' && v.length > 10 &&
      /^(pdf_url|url_pdf|link_pdf|espelho_url)$/i.test(k)
    );
    const pdfDisponivel = findFirstDeep(wrapper, (k, v) =>
      typeof v === 'boolean' && /^redebe_pdf_disponivel$/i.test(k)
    );
    const pdfData = pdfBase64 ? String(pdfBase64) : (pdfUrl ? String(pdfUrl) : null);
    console.log(`[credit-consult] PDF disponivel=${pdfDisponivel} hasData=${!!pdfData}`);

    // Interpreted payment-probability bucket (from textual score)
    const textoBucket = classifyTextoInadimplencia(summary.texto_score);
    const _probRaw = toNumberLoose(summary.probabilidade_inadimplencia);
    const probInadNum = _probRaw != null ? Math.round(_probRaw) : null;

    // Análise interpretada do bureau (nó "resumo")
    const bureauAnalysis = buildBureauAnalysis(summary);

    const result = {
      documento: documentoLimpo,
      tipo_documento,
      nome,
      summary,
      principal,
      engine,
      ignored_adjustments: ignoredAdjustments,
      pdf_data: pdfData,
      pdf_disponivel: pdfDisponivel ?? null,
      texto_score_bucket: textoBucket,
      probabilidade_inadimplencia: probInadNum,
      bureau_analysis: bureauAnalysis,
    };


    if (!test_only) {
      let consultRow: any = null;
      if (!reuse_last) {
        // Persiste consulta (somente quando há consulta nova ao bureau)
        const insertPayload: any = {
          company_id,
          application_id: application_id || null,
          documento: documentoLimpo,
          provider: "redebe",
          raw_response: wrapper,
          summary,
          score: engine.score,
          classification: engine.classification,
          decision: engine.decision,
          approved_limit: engine.approved_limit,
          decision_reason: engine.reason,
          consulted_by: userId,
          pdf_data: pdfData,
          bureau_analysis: bureauAnalysis,
        };
        const { data: cr, error: consultErr } = await supabase
          .from("credit_consultations")
          .insert(insertPayload)
          .select()
          .single();
        if (consultErr) console.error("[credit-consult] insert consultation error", consultErr);
        consultRow = cr;
      } else if (reusedConsultationId) {
        const updatePayload: any = {
          application_id: application_id || null,
          summary,
          score: engine.score,
          classification: engine.classification,
          decision: engine.decision,
          approved_limit: engine.approved_limit,
          decision_reason: engine.reason,
          pdf_data: pdfData,
          bureau_analysis: bureauAnalysis,
        };
        const { data: cr, error: consultUpdateErr } = await supabase
          .from("credit_consultations")
          .update(updatePayload)
          .eq("id", reusedConsultationId)
          .select()
          .single();
        if (consultUpdateErr) console.error("[credit-consult] reuse_last update consultation error", consultUpdateErr);
        consultRow = cr;
      }

      // Decision log
      await supabase.from("credit_decision_log").insert({
        application_id: application_id || null,
        company_id,
        step: reuse_last ? "reevaluate" : "consult",
        input: { documento: documentoLimpo, tipo_documento },
        output: engine,
        rules_snapshot: rules,
        decision: engine.decision,
        created_by: userId,
      });

      // Atualiza application se passado
      if (application_id) {
        await supabase
          .from("credit_applications")
          .update({
            nome,
            tipo_documento,
            score: engine.score,
            classification: engine.classification,
            approved_limit: engine.approved_limit,
            decision: engine.decision,
            decision_reason: engine.reason,
            status: engine.decision === "rejected" ? "rejected" : "consulted",
            current_step: engine.decision === "rejected" ? 1 : 2,
            probabilidade_inadimplencia: probInadNum,
            texto_score_bucket: textoBucket,
            bureau_analysis: bureauAnalysis,
          })
          .eq("id", application_id);
      }

      (result as any).consultation_id = consultRow?.id;
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[credit-consult] error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
