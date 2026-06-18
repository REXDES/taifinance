// Shared occurrence extraction + canonical key builder.
// Used by CreditApplicationsPage and the credit-ignored report.
// Must match the algorithm replicated in supabase/functions/credit-consult/index.ts.

export const OCCURRENCE_KEY_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: 'Alertas / Restrições', regex: /ALERTA|RESTRIC|CHAVEAMENTO|STATUS_CONSUMIDOR/i },
  { label: 'Protestos', regex: /PROTESTO/i },
  { label: 'Pendências Financeiras', regex: /PENDENCIA/i },
  { label: 'Cheques sem Fundo (CCF)', regex: /\bCCF\b|CHEQUE/i },
  { label: 'Ações Cíveis', regex: /ACAO_CIVE|ACOES_CIVE|AC_CIVEIS/i },
];

export const PRIORITY_FIELDS = ['TITULO', 'TIPO', 'DESCRICAO', 'OBSERVACOES', 'OBSERVACAO', 'MENSAGEM', 'MOTIVO', 'DESCRICAO_TIPO_INFORMACAO'];

export type OccurrenceRecord = Record<string, any>;
export interface OccurrenceGroup { category: string; items: OccurrenceRecord[] }

/**
 * Detecta entradas "positivas" do Cadastro Positivo (ex.: "PARTICIPANTE DO CADASTRO POSITIVO"),
 * que NÃO são ocorrências negativas — não devem aparecer como alerta nem permitir alçada.
 * Se contiver "NÃO PARTICIPANTE" / "NEGAT" / "EXCLU", deixa passar como ocorrência real.
 */
export function isPositiveCadastroEntry(record: OccurrenceRecord): boolean {
  const text = Object.values(record)
    .filter((v) => typeof v === 'string' || typeof v === 'number')
    .map((v) => String(v).toUpperCase())
    .join(' | ');
  if (!/CADASTRO\s*POSITIVO|SCPC\s*POSITIVO|CONSUMIDOR\s*POSITIVO/.test(text)) return false;
  if (/N[ÃA]O\s*PARTICIPANTE|EXCLU[IÍ]D|NEGAT|RECUS|BLOQUEAD/.test(text)) return false;
  return true;
}

export function buildOccurrenceKey(record: OccurrenceRecord): string {
  return JSON.stringify(
    Object.entries(record)
      .filter(([, v]) => v != null && (typeof v === 'string' || typeof v === 'number') && String(v).trim() !== '')
      .map(([k, v]) => [k.toUpperCase(), String(v).trim()])
      .sort(([a], [b]) => (a as string).localeCompare(b as string))
  );
}

function isStatusWrapper(o: OccurrenceRecord): boolean {
  const keys = Object.keys(o).map((k) => k.toUpperCase());
  return keys.length > 0 && keys.length <= 3 && keys.every((k) => /CODIGO|DESCRICAO|MENSAGEM|STATUS/.test(k));
}

function hasNestedRecord(node: any): boolean {
  if (!node || typeof node !== 'object') return false;
  if (Array.isArray(node)) return node.some((v) => v && typeof v === 'object');
  return Object.entries(node).some(([, v]) => {
    if (Array.isArray(v)) return v.some((x) => x && typeof x === 'object');
    if (v && typeof v === 'object') return !isStatusWrapper(v as any);
    return false;
  });
}

function collectLeaves(node: any, out: any[]): void {
  if (node == null) return;
  if (Array.isArray(node)) { node.forEach((v) => collectLeaves(v, out)); return; }
  if (typeof node !== 'object') return;
  if (isStatusWrapper(node)) return;

  if (!hasNestedRecord(node)) {
    const scalarEntries = Object.entries(node).filter(([, v]) =>
      v != null && (typeof v === 'string' || typeof v === 'number') && String(v).trim() !== ''
    );
    if (scalarEntries.length === 0) return;
    const meaningful = scalarEntries.filter(
      ([k, v]) => !/^QUANTIDADE_OCORRENCIA$/i.test(k) || (Number(v) || 0) > 0
    );
    if (meaningful.length === 0) return;
    out.push(node);
    return;
  }
  for (const v of Object.values(node)) {
    if (v && typeof v === 'object') collectLeaves(v, out);
  }
}

export function extractOccurrences(raw: any): OccurrenceGroup[] {
  const buckets: Record<string, OccurrenceRecord[]> = {};

  const visit = (node: any) => {
    if (node == null) return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node)) {
      const matched = OCCURRENCE_KEY_PATTERNS.find((p) => p.regex.test(k));
      if (matched) {
        const found: any[] = [];
        collectLeaves(v, found);
        if (found.length > 0) {
          buckets[matched.label] = (buckets[matched.label] || []).concat(found);
        }
      } else if (v && typeof v === 'object') {
        visit(v);
      }
    }
  };
  visit(raw);

  return Object.entries(buckets)
    .map(([category, items]) => {
      const seen = new Set<string>();
      const deduped = items.filter((item) => {
        // Filtra entradas "positivas" do Cadastro Positivo — não são ocorrências/problemas
        if (isPositiveCadastroEntry(item)) return false;
        const key = buildOccurrenceKey(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return { category, items: deduped };
    })
    .filter((g) => g.items.length > 0);
}


export function pickTitulo(record: OccurrenceRecord): string | null {
  for (const k of ['TITULO', 'TIPO']) {
    const v = record[k] ?? record[k.toLowerCase()];
    if (v != null && String(v).trim() !== '') return String(v);
  }
  return null;
}

export function pickDescricao(record: OccurrenceRecord): string | null {
  for (const k of ['DESCRICAO', 'OBSERVACOES', 'OBSERVACAO', 'MENSAGEM', 'MOTIVO', 'DESCRICAO_TIPO_INFORMACAO']) {
    const v = record[k] ?? record[k.toLowerCase()];
    if (v != null && String(v).trim() !== '') return String(v);
  }
  return null;
}

/** Maps occurrence category to the summary count field RedeBE returns. */
export const CATEGORY_TO_SUMMARY_FIELDS: Record<string, string[]> = {
  'Alertas / Restrições': ['quantidade_alertas_restricoes'],
  'Protestos': ['quantidade_protestos'],
  'Pendências Financeiras': ['quantidade_pendencias_financeiras'],
  'Cheques sem Fundo (CCF)': ['quantidade_ccf_bacen', 'quantidade_ccf_varejo'],
  'Ações Cíveis': ['quantidade_acoes_civeis'],
};
