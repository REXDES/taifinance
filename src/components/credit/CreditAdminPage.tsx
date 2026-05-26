import { useState, useEffect } from 'react';
import { useCreditRules, type ScoreBand, DEFAULT_RULES, consultCredit, type ConsultResult, CONFIANCA_OPTIONS, SUGESTAO_OPTIONS } from '@/hooks/useCreditModule';
import { BureauAnalysisCard } from './BureauAnalysisCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Plus, Trash2, FlaskConical, KeyRound, ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';
import { toast } from 'sonner';

interface Props { companyId: string }

export function CreditAdminPage({ companyId }: Props) {
  const { rules, loading, save } = useCreditRules(companyId);
  const [draft, setDraft] = useState(rules);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(rules); }, [rules]);

  // Test consultation
  const [testDoc, setTestDoc] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConsultResult | null>(null);

  if (loading || !draft) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  const updateBand = (idx: number, patch: Partial<ScoreBand>) => {
    const next = [...draft.score_bands];
    next[idx] = { ...next[idx], ...patch };
    setDraft({ ...draft, score_bands: next });
  };
  const removeBand = (idx: number) => setDraft({ ...draft, score_bands: draft.score_bands.filter((_, i) => i !== idx) });
  const addBand = () => setDraft({
    ...draft,
    score_bands: [...draft.score_bands, { min_score: 0, max_score: 100, classes: [], decision: 'manual', percent_teto: 0, max_parcelas: 0 }],
  });

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    await save(draft);
    setSaving(false);
  };

  const handleTest = async () => {
    if (!testDoc.trim()) { toast.error('Informe um CPF ou CNPJ'); return; }
    setTesting(true);
    setTestResult(null);
    try {
      const r = await consultCredit({ documento: testDoc, company_id: companyId, test_only: true });
      setTestResult(r);
    } catch (e: any) {
      toast.error(e.message || 'Erro na consulta');
    } finally {
      setTesting(false);
    }
  };

  const DecisionBadge = ({ d }: { d: string }) => {
    if (d === 'approved') return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"><ShieldCheck className="w-3 h-3 mr-1" />Aprovado</Badge>;
    if (d === 'manual') return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"><ShieldAlert className="w-3 h-3 mr-1" />Manual</Badge>;
    return <Badge className="bg-destructive/15 text-destructive border-destructive/30"><ShieldX className="w-3 h-3 mr-1" />Recusado</Badge>;
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestão de Crédito — Configuração</h1>
          <p className="text-sm text-muted-foreground">Configure o provedor, motor de decisão e encargos do módulo.</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar configurações
        </Button>
      </div>

      <Tabs defaultValue="provedor">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="provedor">Provedor</TabsTrigger>
          <TabsTrigger value="motor">Motor</TabsTrigger>
          <TabsTrigger value="encargos">Encargos</TabsTrigger>
          <TabsTrigger value="ia">IA & Contrato</TabsTrigger>
        </TabsList>

        <TabsContent value="provedor" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><KeyRound className="w-5 h-5" /> RedeBE</CardTitle>
              <CardDescription>
                O token de API da RedeBE é armazenado como segredo do projeto (REDEBE_API_TOKEN).
                Se ainda não configurou, peça ao administrador para cadastrar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                <p className="font-medium">Endpoint atual:</p>
                <code className="text-xs">POST https://consultas.redebe.com.br/api/v1/credito/credito-essencial-positivo</code>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FlaskConical className="w-5 h-5" /> Testar consulta</CardTitle>
              <CardDescription>Executa uma consulta real (não salva no histórico) para validar o token e o motor.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={testDoc}
                  onChange={(e) => setTestDoc(e.target.value)}
                  placeholder="CPF (11 dígitos) ou CNPJ (14 dígitos)"
                  className="flex-1"
                />
                <Button onClick={handleTest} disabled={testing}>
                  {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FlaskConical className="w-4 h-4 mr-2" />}
                  Testar
                </Button>
              </div>
              {testResult && (
                <div className="rounded-md border border-border p-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{testResult.nome || '(sem nome)'}</span>
                    <DecisionBadge d={testResult.engine.decision} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>Documento: <strong>{testResult.documento}</strong> ({testResult.tipo_documento})</div>
                    <div>Score: <strong>{testResult.engine.score}</strong> (classe {testResult.engine.classification})</div>
                    <div>Protestos: {testResult.summary.quantidade_protestos || 0}</div>
                    <div>Pendências: {testResult.summary.quantidade_pendencias_financeiras || 0}</div>
                    <div>CCF Bacen: {testResult.summary.quantidade_ccf_bacen || 0}</div>
                    <div>CCF Varejo: {testResult.summary.quantidade_ccf_varejo || 0}</div>
                    <div>Prob. pagamento (1=pior, 9=melhor): <strong>{(() => { const raw = parseInt(String((testResult.summary as any).probabilidade_inadimplencia || ''), 10); return Number.isFinite(raw) && raw >= 1 && raw <= 9 ? `${10 - raw}/9 (raw inad. ${raw})` : '—'; })()}</strong></div>
                    <div>Bolsa Família (deps): <strong>{(testResult.summary as any).qtd_dependentes_bolsa_familia || 0}</strong></div>
                    <div className="col-span-2">Texto do score: <em>{(testResult.summary as any).texto_score || '—'}</em>{testResult.texto_score_bucket ? <> — bucket: <strong>{testResult.texto_score_bucket}</strong></> : null}</div>
                  </div>
                  <div className="text-xs pt-2 border-t">
                    <strong>Decisão:</strong> {testResult.engine.reason}
                    {testResult.engine.decision !== 'rejected' && (
                      <> — Limite sugerido: <strong>R$ {testResult.engine.approved_limit.toLocaleString('pt-BR')}</strong> em até <strong>{testResult.engine.max_parcelas}x</strong></>
                    )}
                  </div>
                  {testResult.bureau_analysis && (
                    <div className="pt-2"><BureauAnalysisCard analysis={testResult.bureau_analysis} /></div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="motor" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Knock-outs (reprovação automática)</CardTitle>
              <CardDescription>Acima desses limites a proposta é recusada antes mesmo de avaliar o score.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="Máx. protestos" value={draft.max_protestos} onChange={(v) => setDraft({ ...draft, max_protestos: v })} />
              <Field label="Máx. pendências financ." value={draft.max_pendencias_financeiras} onChange={(v) => setDraft({ ...draft, max_pendencias_financeiras: v })} />
              <Field label="Máx. cheques sem fundo" value={draft.max_ccf_total} onChange={(v) => setDraft({ ...draft, max_ccf_total: v })} />
              <Field label="Máx. alertas/restrições" value={draft.max_alertas_restricoes} onChange={(v) => setDraft({ ...draft, max_alertas_restricoes: v })} />
              <Field label="Idade mín. (PF)" value={draft.min_idade_pf} onChange={(v) => setDraft({ ...draft, min_idade_pf: v })} />
              <Field label="Meses CNPJ ativo (PJ)" value={draft.min_meses_cnpj} onChange={(v) => setDraft({ ...draft, min_meses_cnpj: v })} />
              <Field label="Dias inadimpl. interna" value={draft.max_dias_inadimplencia_interna} onChange={(v) => setDraft({ ...draft, max_dias_inadimplencia_interna: v })} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bolsa Família</CardTitle>
              <CardDescription>Usa o nó <code>qtd_dependentes_bolsa_familia</code> da consulta para determinar se o cliente é beneficiário.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between max-w-md">
                <Label>Reprovar beneficiários do Bolsa Família</Label>
                <Switch checked={draft.bolsa_familia_block}
                  onCheckedChange={(v) => setDraft({ ...draft, bolsa_familia_block: v })} />
              </div>
              {draft.bolsa_familia_block && (
                <div className="max-w-xs">
                  <Label className="text-xs">Tolerar até X dependentes (acima disso = reprova)</Label>
                  <Input type="number" min={0} value={draft.max_dependentes_bolsa_familia}
                    onChange={(e) => setDraft({ ...draft, max_dependentes_bolsa_familia: parseInt(e.target.value) || 0 })} />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Probabilidade de pagamento (adimplência)</CardTitle>
              <CardDescription>
                Régua de corte baseada no nó <code>probabilidade_inadimplencia</code> do bureau, exibido aqui
                <strong> invertido</strong> como <em>probabilidade de pagamento</em> (1 = baixa probabilidade de pagamento /
                pior pagador, 9 = alta probabilidade de pagamento / melhor pagador) — alinhado à interpretação textual do
                score (nó "Texto").
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-w-md">
                {(() => {
                  const minPay = 10 - (draft.max_probabilidade_inadimplencia ?? 9);
                  return (
                    <>
                      <Label className="text-xs">Aceitar a partir de probabilidade de pagamento mínima (1 = pior, 9 = melhor)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={9}
                        value={minPay}
                        onChange={(e) => {
                          const v = Math.min(9, Math.max(1, parseInt(e.target.value) || 1));
                          setDraft({ ...draft, max_probabilidade_inadimplencia: 10 - v });
                        }}
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Propostas com probabilidade de pagamento abaixo deste valor são reprovadas.
                        Use <strong>1</strong> para desativar esta régua (aceitar qualquer probabilidade).
                      </p>
                    </>
                  );
                })()}
              </div>
              <div>
                <Label className="text-xs">Reprovar quando a probabilidade de pagamento (texto do score) for:</Label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2">
                  {[
                    { value: 'muito_baixa', label: 'Muito Baixa', hint: 'pior' },
                    { value: 'baixa', label: 'Baixa' },
                    { value: 'media', label: 'Média' },
                    { value: 'alta', label: 'Alta' },
                    { value: 'muito_alta', label: 'Muito Alta', hint: 'melhor' },
                  ].map((opt) => {
                    const checked = (draft.texto_inadimplencia_block_levels || []).includes(opt.value);
                    return (
                      <label key={opt.value} className="flex items-center gap-2 text-xs border border-border rounded px-2 py-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const curr = new Set(draft.texto_inadimplencia_block_levels || []);
                            if (e.target.checked) curr.add(opt.value); else curr.delete(opt.value);
                            setDraft({ ...draft, texto_inadimplencia_block_levels: Array.from(curr) });
                          }}
                        />
                        <span>{opt.label}{opt.hint ? <span className="text-muted-foreground"> ({opt.hint})</span> : null}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  O texto do bureau indica a chance de o cliente <strong>pagar</strong>. Tipicamente marque "Muito Baixa" e/ou "Baixa" para reprovar maus pagadores.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Análise do bureau (nó "resumo")</CardTitle>
              <CardDescription>
                Interpreta os campos analíticos enviados pelo provedor: <code>score_analise</code>, <code>limite_sugerido</code>,
                <code> max_parcelas</code>, <code>parcela_maxima</code>, <code>nivel_de_confianca</code>,
                <code> descricao_rating</code>, <code>observacao_credito</code> e <code>sugestao_de_negocio</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Score analítico mínimo (0 = desliga)</Label>
                  <Input type="number" min={0} value={draft.min_score_analise ?? 0}
                    onChange={(e) => setDraft({ ...draft, min_score_analise: parseInt(e.target.value) || 0 })} />
                  <p className="text-[11px] text-muted-foreground mt-1">Propostas com <code>score_analise</code> abaixo deste valor são reprovadas.</p>
                </div>
                <div className="flex flex-col">
                  <Label className="text-xs mb-2">Aplicar limites sugeridos pelo bureau como teto</Label>
                  <div className="flex items-center gap-3 border border-border rounded px-3 py-2">
                    <Switch checked={!!draft.use_bureau_limits}
                      onCheckedChange={(v) => setDraft({ ...draft, use_bureau_limits: v })} />
                    <span className="text-xs text-muted-foreground">Quando ligado, o limite e nº de parcelas aprovados nunca superam <code>limite_sugerido</code> / <code>max_parcelas</code> do bureau.</span>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs">Reprovar quando o nível de confiança for:</Label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2">
                  {CONFIANCA_OPTIONS.map((opt) => {
                    const checked = (draft.min_nivel_confianca_levels || []).includes(opt.value);
                    return (
                      <label key={opt.value} className="flex items-center gap-2 text-xs border border-border rounded px-2 py-1.5 cursor-pointer">
                        <input type="checkbox" checked={checked} onChange={(e) => {
                          const curr = new Set(draft.min_nivel_confianca_levels || []);
                          if (e.target.checked) curr.add(opt.value); else curr.delete(opt.value);
                          setDraft({ ...draft, min_nivel_confianca_levels: Array.from(curr) });
                        }} />
                        <span>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label className="text-xs">Reprovar quando a sugestão de negócio do bureau for:</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                  {SUGESTAO_OPTIONS.map((opt) => {
                    const checked = (draft.sugestao_negocio_block_levels || []).includes(opt.value);
                    return (
                      <label key={opt.value} className="flex items-center gap-2 text-xs border border-border rounded px-2 py-1.5 cursor-pointer">
                        <input type="checkbox" checked={checked} onChange={(e) => {
                          const curr = new Set(draft.sugestao_negocio_block_levels || []);
                          if (e.target.checked) curr.add(opt.value); else curr.delete(opt.value);
                          setDraft({ ...draft, sugestao_negocio_block_levels: Array.from(curr) });
                        }} />
                        <span>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Interpretado a partir do texto livre <code>sugestao_de_negocio</code>.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Teto e faixas de score</CardTitle>
              <CardDescription>Defina o teto máximo de crédito e como o score determina o percentual aprovado e o nº máximo de parcelas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-w-xs">
                <Label>Teto absoluto (R$)</Label>
                <Input type="number" value={draft.teto_credito}
                  onChange={(e) => setDraft({ ...draft, teto_credito: parseFloat(e.target.value) || 0 })} />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Score mín.</TableHead>
                    <TableHead>Score máx.</TableHead>
                    <TableHead>Classes</TableHead>
                    <TableHead>Decisão</TableHead>
                    <TableHead>% do teto</TableHead>
                    <TableHead>Parcelas máx.</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {draft.score_bands.map((b, i) => (
                    <TableRow key={i}>
                      <TableCell><Input type="number" value={b.min_score} onChange={(e) => updateBand(i, { min_score: parseInt(e.target.value) || 0 })} className="w-20" /></TableCell>
                      <TableCell><Input type="number" value={b.max_score} onChange={(e) => updateBand(i, { max_score: parseInt(e.target.value) || 0 })} className="w-20" /></TableCell>
                      <TableCell><Input value={(b.classes || []).join(',')} onChange={(e) => updateBand(i, { classes: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} className="w-24" placeholder="A,B" /></TableCell>
                      <TableCell>
                        <select className="border border-input bg-background rounded px-2 py-1 text-sm" value={b.decision} onChange={(e) => updateBand(i, { decision: e.target.value as any })}>
                          <option value="approved">Aprovado</option>
                          <option value="manual">Manual</option>
                          <option value="rejected">Recusado</option>
                        </select>
                      </TableCell>
                      <TableCell><Input type="number" value={b.percent_teto} onChange={(e) => updateBand(i, { percent_teto: parseInt(e.target.value) || 0 })} className="w-20" /></TableCell>
                      <TableCell><Input type="number" value={b.max_parcelas} onChange={(e) => updateBand(i, { max_parcelas: parseInt(e.target.value) || 0 })} className="w-20" /></TableCell>
                      <TableCell><Button variant="ghost" size="icon" onClick={() => removeBand(i)}><Trash2 className="w-4 h-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button variant="outline" size="sm" onClick={addBand}><Plus className="w-4 h-4 mr-2" /> Adicionar faixa</Button>
              <Button variant="ghost" size="sm" onClick={() => setDraft({ ...draft, score_bands: DEFAULT_RULES.score_bands })}>
                Restaurar padrão
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="encargos" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle>Encargos financeiros</CardTitle><CardDescription>Aplicados nas parcelas do contrato e em caso de atraso.</CardDescription></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="Juros mensal (%)" step={0.01} value={draft.juros_mensal_pct} onChange={(v) => setDraft({ ...draft, juros_mensal_pct: v })} />
              <Field label="Multa atraso (%)" step={0.01} value={draft.multa_atraso_pct} onChange={(v) => setDraft({ ...draft, multa_atraso_pct: v })} />
              <Field label="Mora diária (%)" step={0.001} value={draft.mora_diaria_pct} onChange={(v) => setDraft({ ...draft, mora_diaria_pct: v })} />
              <Field label="Parcela mínima (R$)" step={1} value={draft.parcela_minima} onChange={(v) => setDraft({ ...draft, parcela_minima: v })} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ia" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle>Validação de identidade por IA</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between max-w-md">
                <Label>Threshold similaridade facial (0–100)</Label>
                <Input type="number" min={0} max={100} value={draft.ia_similarity_threshold}
                  onChange={(e) => setDraft({ ...draft, ia_similarity_threshold: parseInt(e.target.value) || 0 })}
                  className="w-24" />
              </div>
              <div className="flex items-center justify-between max-w-md">
                <Label>Exigir prova de vida (liveness)</Label>
                <Switch checked={draft.ia_require_liveness}
                  onCheckedChange={(v) => setDraft({ ...draft, ia_require_liveness: v })} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Cláusulas do contrato</CardTitle><CardDescription>Texto livre que será incluído no PDF do contrato gerado.</CardDescription></CardHeader>
            <CardContent>
              <Textarea rows={8} value={draft.contract_clauses || ''}
                onChange={(e) => setDraft({ ...draft, contract_clauses: e.target.value })}
                placeholder="Ex: 1. O CONTRATANTE compromete-se a quitar as parcelas nas datas acordadas..." />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (n: number) => void; step?: number }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} />
    </div>
  );
}
