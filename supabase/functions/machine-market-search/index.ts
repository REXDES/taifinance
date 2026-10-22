import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const FC = "https://connector-gateway.lovable.dev/firecrawl/v2";

async function search(query: string, lovKey: string, fcKey: string) {
  const r = await fetch(`${FC}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovKey}`, "X-Connection-Api-Key": fcKey },
    body: JSON.stringify({ query, limit: 8, lang: "pt", country: "br", scrapeOptions: { formats: ["markdown"], onlyMainContent: true } }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Pesquisa falhou [${r.status}]: ${text.slice(0, 300)}`);
  const d = JSON.parse(text);
  const items = Array.isArray(d.data) ? d.data : (d.data?.web ?? []);
  return items as { url: string; title?: string; description?: string; markdown?: string }[];
}

async function extract(mode: "price" | "auction", pages: any[], lovKey: string, ctx: string) {
  const content = pages.map((p, i) => `### Fonte ${i + 1}: ${p.url}\n${p.title ?? ""}\n${(p.markdown ?? p.description ?? "").slice(0, 3500)}`).join("\n\n");
  const system = mode === "price"
    ? "Extraia anúncios de VENDA DIRETA de máquinas (não leilão) com preço em reais. Ignore leilões e lances. Retorne só itens com preço explícito."
    : "Extraia lotes de LEILÃO de máquinas (somente leilões; ignore anúncios de venda com preço fixo). Informe lance atual ou lance inicial em reais, data do leilão e local quando houver. RETORNE SOMENTE leilões que ainda vão acontecer: a data do leilão deve ser igual ou posterior a hoje. Descarte leilões já realizados, encerrados, arrematados ou com data no passado. Se o lote não indicar data, só inclua se o texto deixar claro que ainda vai acontecer (ex.: 'inscrições abertas', 'próximo leilão'); caso contrário, descarte.";
  const hoje = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${lovKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3.8-flash",
      messages: [{ role: "system", content: system }, { role: "user", content: `Busca: ${ctx}\n\n${content}` }],
      tools: [{ type: "function", function: { name: "items", parameters: { type: "object", properties: { items: { type: "array", items: { type: "object", properties: {
        title: { type: "string" }, brand: { type: "string" }, model: { type: "string" }, year: { type: "number" }, hours: { type: "number" },
        price: { type: "number", description: "preço ou lance em reais" }, auction_date: { type: "string" }, location: { type: "string" }, url: { type: "string" },
      }, required: ["title", "url"] } } }, required: ["items"] } } }],
      tool_choice: { type: "function", function: { name: "items" } },
    }),
  });
  if (r.status === 429) throw new Error("Muitas pesquisas seguidas. Aguarde um pouco.");
  if (r.status === 402) throw new Error("Créditos de IA esgotados no workspace.");
  if (!r.ok) throw new Error(`IA falhou [${r.status}]: ${(await r.text()).slice(0, 300)}`);
  const d = await r.json();
  const args = d.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  try { return (JSON.parse(args || "{}").items ?? []) as any[]; } catch { return []; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const lovKey = Deno.env.get("LOVABLE_API_KEY"); const fcKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!lovKey || !fcKey) return json({ error: "Pesquisa na internet não configurada" }, 500);
    const auth = req.headers.get("Authorization") ?? "";
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return json({ error: "Não autenticado" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body.action; const companyId = String(body.company_id ?? "");
    const query = String(body.query ?? "").trim().slice(0, 200);
    if (!["price_research", "auction_search"].includes(action) || !companyId || !query) return json({ error: "Parâmetros inválidos" }, 400);
    const { data: ok } = await sb.rpc("has_company_access", { _user_id: u.user.id, _company_id: companyId });
    if (!ok) return json({ error: "Sem acesso à empresa" }, 403);

    const sites = String(body.sites ?? "").split(/[,\s]+/).filter(Boolean).slice(0, 5);
    const siteQ = sites.length ? " (" + sites.map((s) => `site:${s}`).join(" OR ") + ")" : "";
    const q = action === "price_research"
      ? `${query} à venda preço -leilão${siteQ}`
      : `leilão ${query} lance${siteQ || " (site:superbid.net OR site:sodresantoro.com.br OR site:megaleiloes.com.br OR site:mgl.com.br)"}`;
    const pages = await search(q, lovKey, fcKey);
    const items = await extract(action === "price_research" ? "price" : "auction", pages, lovKey, query);
    return json({ items: items.filter((i) => i.url) });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Erro" }, 500);
  }
});
