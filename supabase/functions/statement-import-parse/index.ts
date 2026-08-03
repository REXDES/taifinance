import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "openai/gpt-5.6-sol";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callAI(params: {
  apiKey: string;
  system: string;
  userContent: unknown[];
  schemaName: string;
  schema: Record<string, unknown>;
}) {
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      input: [
        { role: "system", content: [{ type: "input_text", text: params.system }] },
        { role: "user", content: params.userContent },
      ],
      text: {
        format: {
          type: "json_schema",
          name: params.schemaName,
          strict: true,
          schema: params.schema,
        },
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("AI gateway error", res.status, detail);
    const err = new Error(detail);
    (err as any).status = res.status;
    throw err;
  }

  const data = await res.json();
  let text: string | undefined = data.output_text;
  if (!text && Array.isArray(data.output)) {
    for (const item of data.output) {
      for (const part of item?.content ?? []) {
        if (typeof part?.text === "string") {
          text = (text ?? "") + part.text;
        }
      }
    }
  }
  if (!text) {
    console.error("AI response without text", JSON.stringify(data).slice(0, 2000));
    throw new Error("Resposta da IA sem conteúdo");
  }
  return JSON.parse(text);
}

const extractSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    bank_name: { type: ["string", "null"] },
    period_start: { type: ["string", "null"], description: "AAAA-MM-DD" },
    period_end: { type: ["string", "null"], description: "AAAA-MM-DD" },
    opening_balance: { type: ["number", "null"] },
    closing_balance: { type: ["number", "null"] },
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          date: { type: "string", description: "AAAA-MM-DD" },
          description: { type: "string" },
          amount: { type: "number", description: "sempre positivo" },
          type: { type: "string", enum: ["income", "expense"] },
          running_balance: { type: ["number", "null"] },
          external_id: { type: ["string", "null"] },
        },
        required: ["date", "description", "amount", "type", "running_balance", "external_id"],
      },
    },
  },
  required: ["bank_name", "period_start", "period_end", "opening_balance", "closing_balance", "lines"],
};

const suggestSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          line_index: { type: "integer" },
          description: { type: "string" },
          account_id: { type: ["string", "null"] },
          category_id: { type: ["string", "null"] },
          subcategory_id: { type: ["string", "null"] },
          confidence: { type: "number", description: "0 a 1" },
          reasoning: { type: ["string", "null"] },
        },
        required: ["line_index", "description", "account_id", "category_id", "subcategory_id", "confidence", "reasoning"],
      },
    },
  },
  required: ["suggestions"],
};

const receiptSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    details: { type: "string", description: "Resumo detalhado do comprovante (pagador, favorecido, documento, finalidade, valor, data)" },
    description: { type: "string", description: "Descrição curta e clara para o lançamento" },
    category_id: { type: ["string", "null"] },
    subcategory_id: { type: ["string", "null"] },
    tag_ids: { type: "array", items: { type: "string" } },
    confidence: { type: "number", description: "0 a 1" },
  },
  required: ["details", "description", "category_id", "subcategory_id", "tag_ids", "confidence"],
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "Configuração de IA não encontrada" }, 500);

    const body = await req.json();
    const action = body?.action;

    if (action === "extract") {
      const { format, text, fileBase64, mimeType, fileName } = body;
      if (!text && !fileBase64) return json({ error: "Arquivo vazio" }, 400);

      const system = `Você é um especialista em extratos bancários brasileiros.
Leia o conteúdo enviado (formato: ${format || "desconhecido"}) e devolva TODOS os lançamentos encontrados, em ordem cronológica.

REGRAS:
- Datas sempre no formato AAAA-MM-DD. Se o extrato usar DD/MM/AAAA, converta. Se o ano não aparecer na linha, use o ano do período do extrato.
- "amount" sempre POSITIVO; use "type" = "expense" para débitos/saídas e "income" para créditos/entradas.
- Não invente lançamentos e não omita nenhum. Ignore linhas de cabeçalho, rodapé, totais e "SALDO ANTERIOR"/"SALDO DO DIA"/"SALDO FINAL" — mas use esses valores para preencher opening_balance e closing_balance.
- "running_balance" é o saldo mostrado na própria linha, quando existir.
- "external_id" é o identificador único do lançamento (ex.: FITID em OFX), quando existir.
- description: mantenha o histórico ORIGINAL do banco, sem reescrever.`;

      const userContent: unknown[] = [];
      if (fileBase64) {
        userContent.push({
          type: "input_file",
          filename: fileName || "extrato.pdf",
          file_data: `data:${mimeType || "application/pdf"};base64,${fileBase64}`,
        });
        userContent.push({ type: "input_text", text: "Extraia os lançamentos deste extrato." });
      } else {
        userContent.push({
          type: "input_text",
          text: `Conteúdo do extrato (${fileName || "arquivo"}):\n\n${String(text).slice(0, 400000)}`,
        });
      }

      const result = await callAI({ apiKey, system, userContent, schemaName: "extrato", schema: extractSchema });
      return json(result);
    }

    if (action === "suggest") {
      const { lines, accounts, categories, history, defaultAccountId } = body;
      if (!Array.isArray(lines) || lines.length === 0) return json({ suggestions: [] });

      const accountsCtx = (accounts || [])
        .map((a: any) => `- ${a.name} (id: ${a.id})`)
        .join("\n") || "(nenhuma)";

      const categoriesCtx = (categories || [])
        .map((c: any) => {
          const subs = (c.subcategories || []).map((s: any) => `    - ${s.name} (id: ${s.id})`).join("\n");
          return `- ${c.name} [${c.type}] (id: ${c.id})\n${subs || "    (sem subcategorias)"}`;
        })
        .join("\n") || "(nenhuma)";

      const historyCtx = (history || [])
        .slice(0, 200)
        .map((h: any) => `- "${h.description}" => conta ${h.account_id || "-"} | categoria ${h.category_id || "-"} | subcategoria ${h.subcategory_id || "-"}`)
        .join("\n") || "(sem histórico)";

      const system = `Você classifica lançamentos de extrato bancário para conciliação contábil no Brasil.

CONTAS DISPONÍVEIS:
${accountsCtx}

CATEGORIAS E SUBCATEGORIAS DISPONÍVEIS:
${categoriesCtx}

HISTÓRICO DE LANÇAMENTOS JÁ CONCILIADOS DESTA EMPRESA (aprenda os padrões daqui):
${historyCtx}

REGRAS:
1. Aprenda primeiro pelo histórico: se o histórico do banco for parecido com algo já conciliado, repita a mesma categoria/subcategoria (confiança alta, 0.85-1).
2. Só use IDs que existem nas listas acima. Se nada se encaixa, devolva null no campo — nunca invente id.
3. Prefira sempre indicar subcategoria quando a categoria escolhida tiver subcategorias compatíveis.
4. account_id: use ${defaultAccountId ? `"${defaultAccountId}" (conta do extrato) na maioria dos casos` : "a conta mais provável"}.
5. description: reescreva o histórico do banco em português claro e curto (ex.: "PIX ENVIADO 12/03 JOAO M" => "PIX enviado - João M").
6. confidence entre 0 e 1, honesto: baixo quando é chute.`;

      const payload = lines
        .map((l: any) => `#${l.line_index} ${l.date} | ${l.type === "income" ? "ENTRADA" : "SAÍDA"} | R$ ${l.amount} | ${l.raw_description}`)
        .join("\n");

      const result = await callAI({
        apiKey,
        system,
        userContent: [{ type: "input_text", text: `Classifique cada linha abaixo (uma sugestão por linha, use o mesmo line_index):\n\n${payload}` }],
        schemaName: "sugestoes",
        schema: suggestSchema,
      });
      return json(result);
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (error: any) {
    const status = error?.status;
    if (status === 429) return json({ error: "Limite de requisições de IA atingido. Tente novamente em alguns segundos." }, 429);
    if (status === 402) return json({ error: "Créditos de IA esgotados. Recarregue sua conta." }, 402);
    console.error("statement-import-parse error", error);
    return json({ error: error?.message || "Erro desconhecido" }, 500);
  }
});
