import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const FC = "https://connector-gateway.lovable.dev/firecrawl/v2";

async function search(query: string, lovKey: string, fcKey: string, limit = 8): Promise<any[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try { return await searchOnce(query, lovKey, fcKey, limit); }
    catch (e) {
      console.error("search attempt", attempt + 1, e);
      if (/\[(40[0-4])\]/.test(String(e))) throw e;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1000));
    }
  }
  return [];
}

async function searchOnce(query: string, lovKey: string, fcKey: string, limit: number) {
  const r = await fetch(`${FC}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovKey}`, "X-Connection-Api-Key": fcKey },
    body: JSON.stringify({ query, limit, lang: "pt", country: "br", scrapeOptions: { formats: ["markdown"], onlyMainContent: true } }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Pesquisa falhou [${r.status}]: ${text.slice(0, 300)}`);
  const d = JSON.parse(text);
  const items = Array.isArray(d.data) ? d.data : (d.data?.web ?? []);
  return items as { url: string; title?: string; description?: string; markdown?: string }[];
}

async function scrape(url: string, lovKey: string, fcKey: string) {
  const r = await fetch(`${FC}/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovKey}`, "X-Connection-Api-Key": fcKey },
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true, waitFor: 3000 }),
  });
  if (!r.ok) { console.error("scrape", url, r.status, (await r.text()).slice(0, 200)); return null; }
  const d = await r.json();
  let md: string | undefined = d.markdown ?? d.data?.markdown;
  if (md) md = md.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\\\\/g, "").replace(/\n\s*\n+/g, "\n");
  return md ? { url, title: d.metadata?.title ?? d.data?.metadata?.title, markdown: md, listing: true } : null;
}

function pageUrl(base: string, n: number) {
  const u = new URL(base);
  if (n > 1) u.searchParams.set("pageNumber", String(n));
  return u.toString();
}

async function extract(mode: "price" | "auction", pages: any[], lovKey: string, ctx: string) {
  const content = pages.map((p, i) => `### Fonte ${i + 1}: ${p.url}\n${p.title ?? ""}\n${(p.markdown ?? p.description ?? "").slice(0, p.listing ? 20000 : 3500)}`).join("\n\n");
  const system = mode === "price"
    ? "Extraia anúncios de VENDA DIRETA de máquinas (não leilão) com preço em reais. Ignore leilões e lances. Retorne só itens com preço explícito."
    : "Extraia lotes de LEILÃO de máquinas (somente leilões; ignore anúncios de venda com preço fixo). Informe lance atual ou lance inicial em reais, data do leilão e local quando houver. RETORNE SOMENTE leilões que ainda vão acontecer: a data do leilão deve ser igual ou posterior a hoje. Descarte leilões já realizados, encerrados, arrematados ou com data no passado. Se o lote não indicar data, só inclua se o texto deixar claro que ainda vai acontecer (ex.: 'inscrições abertas', 'próximo leilão'); caso contrário, descarte. Leilões de HOJE contam. Datas como 'Hoje - 13:01' significam a data de hoje; datas sem ano como '29/10 - 13:17' são do ano corrente (ou do próximo, se já passaram). Extraia TODOS os lotes de máquinas compatíveis com o tipo pesquisado (o termo de busca é uma referência ampla, não um filtro exato de marca/modelo); traga até 25 lotes. Devolva auction_date SEMPRE no formato AAAA-MM-DD. Em páginas de listagem com vários lotes, extraia cada lote separadamente com o link do lote. Ignore ofertas marcadas como 'Mercado balcão', 'Compre já' ou 'Venda direta' (essas não são leilão).";
  const hoje = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${lovKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3.8-flash",
      messages: [{ role: "system", content: system }, { role: "user", content: `Data de hoje: ${hoje} (horário de São Paulo)\n\nBusca: ${ctx}\n\n${content}` }],
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

    const raw = String(body.sites ?? "").split(/[,\s]+/).filter(Boolean);
    const urls = raw.filter((x) => /^https?:\/\//i.test(x)).slice(0, 3);
    const sites = raw.filter((x) => !/^https?:\/\//i.test(x)).slice(0, 5);
    const siteQ = sites.length ? " (" + sites.map((s) => `site:${s}`).join(" OR ") + ")" : "";
    const q = action === "price_research"
      ? `${query} à venda preço -leilão${siteQ}`
      : `leilão ${query} lance${siteQ || " (site:superbid.net OR site:sodresantoro.com.br OR site:megaleiloes.com.br OR site:mgl.com.br)"} -realizado -encerrado -histórico`;
    const exclude = new Set((Array.isArray(body.exclude_urls) ? body.exclude_urls : []).map(String).slice(0, 500));
    const pages: any[] = [];
    if (action === "auction_search") {
      const jobs: Promise<any>[] = urls.flatMap((u) => [1, 2, 3].map((n) => scrape(pageUrl(u, n), lovKey, fcKey)));
      jobs.push(search(q, lovKey, fcKey, 15).catch((e) => { console.error(e); return []; }));
      for (const r of await Promise.all(jobs)) { if (Array.isArray(r)) pages.push(...r); else if (r) pages.push(r); }
    } else pages.push(...(await search(q, lovKey, fcKey)));
    // processa em lotes para não estourar a leitura da IA
    const groups: any[][] = [];
    for (let i = 0; i < pages.length; i += 5) groups.push(pages.slice(i, i + 5));
    const extracted = (await Promise.all(groups.map((g) => extract(action === "price_research" ? "price" : "auction", g, lovKey, query).catch((e) => { console.error(e); return []; })))).flat();
    const seen = new Set<string>();
    const items = extracted.filter((i: any) => i.url && !exclude.has(i.url) && !seen.has(i.url) && seen.add(i.url));
    console.log("found", extracted.length, "new", items.length, "pages", pages.length);
    return json({ items: action === "auction_search" ? items.slice(0, 10) : items });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Erro" }, 500);
  }
});
