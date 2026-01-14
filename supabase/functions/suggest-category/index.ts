import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Category {
  id: string;
  name: string;
  type: string;
  subcategories: { id: string; name: string }[];
}

interface SuggestRequest {
  description: string;
  type: "expense" | "income";
  categories: Category[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "Configuração de IA não encontrada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { description, type, categories }: SuggestRequest = await req.json();

    if (!description || !type || !categories) {
      return new Response(
        JSON.stringify({ error: "Dados obrigatórios ausentes" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing category suggestion for:", { description, type, categoriesCount: categories.length });

    // Build categories context for the AI
    const categoriesContext = categories
      .filter(c => c.type === type || c.type === "both")
      .map(c => {
        const subs = c.subcategories?.map(s => `  - ${s.name} (id: ${s.id})`).join("\n") || "  (sem subcategorias)";
        return `• ${c.name} (id: ${c.id}):\n${subs}`;
      })
      .join("\n\n");

    const systemPrompt = `Você é um assistente financeiro especializado em categorização de despesas e receitas no Brasil.

O usuário vai descrever uma ${type === "expense" ? "despesa" : "receita"} e você deve sugerir a categoria e subcategoria mais adequadas.

CATEGORIAS E SUBCATEGORIAS DISPONÍVEIS:
${categoriesContext || "Nenhuma categoria cadastrada."}

REGRAS:
1. Se encontrar uma categoria/subcategoria adequada, retorne-a usando a função suggest_category
2. Se NÃO encontrar uma adequada, sugira nomes para criar uma nova categoria e/ou subcategoria
3. Sempre forneça uma explicação clara e curta do porquê da sugestão
4. A confiança deve ser:
   - "alta": quando a correspondência é óbvia
   - "media": quando há correspondência parcial
   - "baixa": quando é uma suposição ou não há correspondência clara`;

    const userPrompt = `Analise esta ${type === "expense" ? "despesa" : "receita"} e sugira a melhor categoria e subcategoria:

"${description}"`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_category",
              description: "Retorna a sugestão de categoria e subcategoria para o lançamento financeiro",
              parameters: {
                type: "object",
                properties: {
                  found: {
                    type: "boolean",
                    description: "true se encontrou uma categoria/subcategoria adequada existente, false se sugere criar nova"
                  },
                  category_id: {
                    type: "string",
                    description: "ID da categoria existente sugerida (apenas se found=true)"
                  },
                  category_name: {
                    type: "string",
                    description: "Nome da categoria existente sugerida (apenas se found=true)"
                  },
                  subcategory_id: {
                    type: "string",
                    description: "ID da subcategoria existente sugerida (apenas se found=true e houver subcategoria)"
                  },
                  subcategory_name: {
                    type: "string",
                    description: "Nome da subcategoria existente sugerida (apenas se found=true e houver subcategoria)"
                  },
                  suggested_category_name: {
                    type: "string",
                    description: "Nome sugerido para nova categoria (apenas se found=false)"
                  },
                  suggested_subcategory_name: {
                    type: "string",
                    description: "Nome sugerido para nova subcategoria (apenas se found=false)"
                  },
                  confidence: {
                    type: "string",
                    enum: ["alta", "media", "baixa"],
                    description: "Nível de confiança na sugestão"
                  },
                  explanation: {
                    type: "string",
                    description: "Explicação curta do porquê desta sugestão"
                  }
                },
                required: ["found", "confidence", "explanation"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "suggest_category" } }
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const errorText = await response.text();
      console.error("AI gateway error:", status, errorText);

      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Por favor, recarregue sua conta." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Erro ao processar sugestão" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    console.log("AI response:", JSON.stringify(result, null, 2));

    // Extract the tool call result
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function?.name !== "suggest_category") {
      console.error("Unexpected AI response format:", result);
      return new Response(
        JSON.stringify({ error: "Resposta inesperada da IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const suggestion = JSON.parse(toolCall.function.arguments);
    console.log("Parsed suggestion:", suggestion);

    return new Response(
      JSON.stringify(suggestion),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in suggest-category:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
