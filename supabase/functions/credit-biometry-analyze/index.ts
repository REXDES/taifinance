import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mime: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error("Invalid data URL");
  const mime = m[1];
  const b64 = m[2];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, mime };
}

async function uploadImage(path: string, dataUrl: string) {
  const { bytes, mime } = dataUrlToBytes(dataUrl);
  const { error } = await admin.storage.from("credit-documents").upload(path, bytes, { contentType: mime, upsert: true });
  if (error) throw error;
  return path;
}

async function analyzeWithAI(selfie: string, docFront: string, docBack: string | null) {
  if (!LOVABLE_API_KEY) {
    return { similarity: 0, liveness: false, ocr: {}, reasoning: "LOVABLE_API_KEY ausente — análise pulada" };
  }
  const messages = [{
    role: "user",
    content: [
      { type: "text", text: `Você é um sistema de verificação biométrica para crédito.
Analise as imagens e retorne JSON estrito:
{
  "similarity": <0-100 inteiro: quão parecida a selfie é da foto no documento>,
  "liveness": <true|false: a selfie parece de pessoa real e ao vivo, sem fraude/foto-de-foto>,
  "ocr": { "nome": "...", "documento": "...", "data_nascimento": "..." },
  "reasoning": "explicação curta em PT-BR"
}
Não inclua texto fora do JSON.` },
      { type: "image_url", image_url: { url: selfie } },
      { type: "image_url", image_url: { url: docFront } },
      ...(docBack ? [{ type: "image_url", image_url: { url: docBack } }] : []),
    ],
  }];

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI gateway error ${res.status}: ${t}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || "{}";
  const cleaned = content.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return {
      similarity: Math.max(0, Math.min(100, Number(parsed.similarity) || 0)),
      liveness: !!parsed.liveness,
      ocr: parsed.ocr || {},
      reasoning: parsed.reasoning || "",
    };
  } catch {
    return { similarity: 0, liveness: false, ocr: {}, reasoning: "Falha ao parsear resposta da IA: " + content };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { token, selfie_b64, doc_front_b64, doc_back_b64 } = await req.json();
    if (!token || !selfie_b64 || !doc_front_b64) {
      return new Response(JSON.stringify({ error: "Parâmetros obrigatórios: token, selfie_b64, doc_front_b64" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: bio, error: bioErr } = await admin.from("credit_biometry").select("*").eq("public_token", token).maybeSingle();
    if (bioErr || !bio) return new Response(JSON.stringify({ error: "Biometria não encontrada" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    await admin.from("credit_biometry").update({ status: "analyzing" }).eq("id", bio.id);

    const base = `biometry/${bio.application_id}/${bio.id}`;
    const selfiePath = await uploadImage(`${base}/selfie.jpg`, selfie_b64);
    const docFrontPath = await uploadImage(`${base}/doc-front.jpg`, doc_front_b64);
    const docBackPath = doc_back_b64 ? await uploadImage(`${base}/doc-back.jpg`, doc_back_b64) : null;

    const ai = await analyzeWithAI(selfie_b64, doc_front_b64, doc_back_b64);

    const { data: rules } = await admin.from("credit_rules").select("ia_similarity_threshold, ia_require_liveness").eq("company_id", bio.company_id).maybeSingle();
    const threshold = rules?.ia_similarity_threshold ?? 80;
    const requireLiveness = rules?.ia_require_liveness ?? true;

    const passes = ai.similarity >= threshold && (!requireLiveness || ai.liveness);
    const status = passes ? "approved" : "rejected";
    const rejection = passes ? null
      : `Similaridade ${ai.similarity}% (mín. ${threshold}%)${requireLiveness && !ai.liveness ? " · Liveness não confirmado" : ""}`;

    await admin.from("credit_biometry").update({
      selfie_url: selfiePath,
      doc_front_url: docFrontPath,
      doc_back_url: docBackPath,
      similarity_score: ai.similarity,
      liveness_passed: ai.liveness,
      ocr_data: ai.ocr,
      ai_analysis: ai,
      status,
      rejection_reason: rejection,
      completed_at: new Date().toISOString(),
    }).eq("id", bio.id);

    if (passes) {
      await admin.from("credit_applications").update({ current_step: 4 }).eq("id", bio.application_id).lt("current_step", 4);
    }

    return new Response(JSON.stringify({ success: true, status, similarity: ai.similarity, liveness: ai.liveness }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("biometry analyze error", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
