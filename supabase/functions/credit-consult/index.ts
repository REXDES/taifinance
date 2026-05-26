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
  max_probabilidade_inadimplencia?: number;
  texto_inadimplencia_block_levels?: string[];
}

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

function runDecisionEngine(opts: {
  rules: CreditRules;
  summary: RedeBESummary;
  principal: any;
  tipo_documento: "CPF" | "CNPJ";
}): {
  decision: "approved" | "manual" | "rejected";
  approved_limit: number;
  max_parcelas: number;
  score: number;
  classification: string;
  reason: string;
  knockouts: string[];
} {
  const { rules, summary, principal, tipo_documento } = opts;
  const knockouts: string[] = [];

  // PJ: checar situação ATIVA
  if (tipo_documento === "CNPJ") {
    const situacao = principal?.CREDCADASTRAL?.INFORMACOES_DA_EMPRESA?.SITUACAO || "";
    if (situacao && situacao.toUpperCase() !== "ATIVO" && situacao.toUpperCase() !== "ATIVA") {
      knockouts.push(`CNPJ não está ATIVO (situação: ${situacao})`);
    }
    // Tempo de CNPJ
    const fundacao = principal?.CREDCADASTRAL?.INFORMACOES_DA_EMPRESA?.DATA_FUNDACAO;
    const meses = diffMonths(fundacao);
    if (meses > 0 && meses < rules.min_meses_cnpj) {
      knockouts.push(`CNPJ ativo há ${meses} meses (mínimo: ${rules.min_meses_cnpj})`);
    }
  }

  // Knock-outs por quantidade
  const protestos = toInt(summary.quantidade_protestos);
  if (protestos > rules.max_protestos) {
    knockouts.push(`${protestos} protesto(s) — máximo permitido: ${rules.max_protestos}`);
  }
  const pendencias = toInt(summary.quantidade_pendencias_financeiras);
  if (pendencias > rules.max_pendencias_financeiras) {
    knockouts.push(`${pendencias} pendência(s) financeira(s) — máximo permitido: ${rules.max_pendencias_financeiras}`);
  }
  const ccfTotal = toInt(summary.quantidade_ccf_bacen) + toInt(summary.quantidade_ccf_varejo);
  if (ccfTotal > rules.max_ccf_total) {
    knockouts.push(`${ccfTotal} cheque(s) sem fundo (CCF) — máximo permitido: ${rules.max_ccf_total}`);
  }
  const alertas = toInt(summary.quantidade_alertas_restricoes);
  if (alertas > rules.max_alertas_restricoes) {
    knockouts.push(`${alertas} alerta(s) de restrição — máximo permitido: ${rules.max_alertas_restricoes}`);
  }

  const score = toInt(summary.score);
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
    };
  }

  // Faixa por score
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
      reason: `Score ${score} (classe ${classification}) abaixo dos critérios mínimos`,
      knockouts,
    };
  }

  const limit = Math.round((rules.teto_credito * band.percent_teto) / 100);

  return {
    decision: band.decision,
    approved_limit: limit,
    max_parcelas: band.max_parcelas,
    score,
    classification,
    reason:
      band.decision === "approved"
        ? `Aprovado com base no score ${score} (classe ${classification}) — ${band.percent_teto}% do teto`
        : `Score ${score} (classe ${classification}) requer análise manual`,
    knockouts,
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

    const { documento, company_id, application_id, test_only } = await req.json();

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

    // Consulta RedeBE
    console.log(`[credit-consult] consulting RedeBE for ${tipo_documento} ${documentoLimpo}`);
    const redebeResp = await fetch(REDEBE_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REDEBE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ documento: documentoLimpo }),
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
    const wrapper = Array.isArray(redebeJson) ? redebeJson[0] : redebeJson;
    const redeBlock = wrapper?.RedeBE || wrapper?.data?.RedeBE || wrapper;
    const summary: RedeBESummary = { ...(redeBlock?.resumo || {}) };
    const principal = redeBlock?.retorno?.principal || {};

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

    const result = {
      documento: documentoLimpo,
      tipo_documento,
      nome,
      summary,
      principal,
      engine,
      ignored_adjustments: ignoredAdjustments,
    };

    if (!test_only) {
      // Persiste consulta
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
      };
      const { data: consultRow, error: consultErr } = await supabase
        .from("credit_consultations")
        .insert(insertPayload)
        .select()
        .single();
      if (consultErr) console.error("[credit-consult] insert consultation error", consultErr);

      // Decision log
      await supabase.from("credit_decision_log").insert({
        application_id: application_id || null,
        company_id,
        step: "consult",
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
