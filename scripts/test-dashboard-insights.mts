// Testes da lógica do dashboard (modos Visual/Descritivo). Sem dependências: roda com Node 22.6+.
//   npm run test:insights
import assert from 'node:assert/strict';
import {
  monthRange, sumTransactions, percentChange, deltaTone, categoryShares, summarizeOpen,
  projectMonthEnd, buildMonthSummary, buildInsights, coversSince, addDaysISO, brl, pct, LOAD_LIMIT,
  compareWithPreviousMonth, analyzeMonth,
} from '../src/lib/dashboardInsights.ts';

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('ok -', name); };

const ref = new Date(2026, 9, 15, 12); // 15/out/2026
const cur = monthRange(ref, 0), prev = monthRange(ref, -1);

t('monthRange', () => {
  assert.deepEqual([cur.start, cur.end, cur.label, cur.name], ['2026-10-01', '2026-10-31', 'outubro de 2026', 'outubro']);
  assert.deepEqual([prev.start, prev.end, prev.name], ['2026-09-01', '2026-09-30', 'setembro']);
  const jan = monthRange(new Date(2026, 0, 10, 12), -1);
  assert.deepEqual([jan.start, jan.end], ['2025-12-01', '2025-12-31']); // vira o ano
});

const tx = (type, amount, date, cat, color) => ({ type, amount, date, category_id: cat ? 'id-' + cat : null, category: cat ? { name: cat, color } : null });
const all = [
  tx('income', 10000, '2026-10-02', 'Vendas'), tx('income', '500.50', '2026-10-10', 'Vendas'),
  tx('expense', 3000, '2026-10-03', 'Fornecedores', '#f00'), tx('expense', 1000, '2026-10-05', 'Aluguel', '#0f0'),
  tx('expense', 500, '2026-10-07', 'Outros', '#00f'), tx('expense', 100, '2026-10-08', null),
  tx('income', 8000, '2026-09-05', 'Vendas'), tx('expense', 2000, '2026-09-06', 'Fornecedores'), tx('expense', 900, '2026-09-30', 'Aluguel'),
  tx('expense', 700, '2026-08-31', 'Aluguel'), // fora dos dois meses
];

const fullCompare = { transactions: all, currentRange: { start: cur.start, end: cur.end }, previousRange: { start: prev.start, end: prev.end } };
const total = (income, expense) => ({ income, expense, incomeCount: 1, expenseCount: 1 });
const mkCmp = (p, c, reference = 'a setembro') => ({
  monthName: 'setembro', reference, label: 'setembro', partial: false,
  current: total(c.income, c.expense), previous: total(p.income, p.expense),
  currentRange: { start: cur.start, end: cur.end }, previousRange: { start: prev.start, end: prev.end },
});

t('sumTransactions (inclui limites do mês, aceita amount em texto)', () => {
  const c = sumTransactions(all, cur.start, cur.end);
  assert.equal(c.income, 10500.5); assert.equal(c.incomeCount, 2);
  assert.equal(c.expense, 4600); assert.equal(c.expenseCount, 4);
  const p = sumTransactions(all, prev.start, prev.end);
  assert.deepEqual(p, { income: 8000, expense: 2900, incomeCount: 1, expenseCount: 2 });
});

t('percentChange / deltaTone', () => {
  assert.equal(percentChange(110, 100), 10);
  assert.equal(percentChange(50, 100), -50);
  assert.equal(percentChange(10, 0), null);
  assert.equal(percentChange(-50, -100), 50); // base negativa usa |anterior|
  assert.equal(deltaTone('income', 12), 'success');
  assert.equal(deltaTone('income', -12), 'warning');
  assert.equal(deltaTone('expense', 12), 'warning'); // despesa subindo = atenção
  assert.equal(deltaTone('expense', -12), 'success');
  assert.equal(deltaTone('expense', 0.4), 'neutral');
  assert.equal(deltaTone('balance', null), 'neutral');
});

t('categoryShares: ordena, soma 100%, compara com o mês anterior', () => {
  const rows = categoryShares(all, cur, fullCompare, 6);
  assert.equal(rows[0].name, 'Fornecedores');
  assert.equal(rows.reduce((s, r) => s + r.value, 0), 4600);
  assert.ok(Math.abs(rows.reduce((s, r) => s + r.share, 0) - 100) < 1e-9);
  const forn = rows.find((r) => r.name === 'Fornecedores');
  assert.equal(forn.previousValue, 2000); assert.equal(forn.change, 50);
  const alug = rows.find((r) => r.name === 'Aluguel'); assert.equal(alug.change, 11.11111111111111);
  const sem = rows.find((r) => r.name === 'Sem categoria'); assert.equal(sem.categoryId, null);
  const outros = rows.find((r) => r.name === 'Outros'); assert.equal(outros.previousValue, 0); assert.equal(outros.change, null);
});

t('categoryShares: agrupa o excedente em "Outras categorias"', () => {
  const many = Array.from({ length: 9 }, (_, i) => tx('expense', 100 + i, '2026-10-02', 'Cat' + i));
  const rows = categoryShares(many, cur, null, 4);
  assert.equal(rows.length, 4); assert.equal(rows[3].name, 'Outras categorias');
  assert.equal(rows.reduce((s, r) => s + r.value, 0), many.reduce((s, r) => s + r.amount, 0));
  assert.equal(rows[0].change, null); // sem mês anterior
  assert.deepEqual(categoryShares([], cur, { ...fullCompare, transactions: [] }), []);
});

t('categoryShares: categorias com o mesmo nome não se misturam (agrupa por id)', () => {
  const a = { type: 'expense', amount: 300, date: '2026-10-02', category_id: 'A', category: { name: 'Marketing', color: '#111' } };
  const b = { type: 'expense', amount: 200, date: '2026-10-03', category_id: 'B', category: { name: 'Marketing', color: '#222' } };
  const rows = categoryShares([a, b], cur, null);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => [r.categoryId, r.value]), [['A', 300], ['B', 200]]);
  assert.equal(rows[0].share, 60);
});

t('coversSince: só desconfia quando bate o teto de 1.000 linhas', () => {
  assert.equal(coversSince(all, prev.start), true);
  const big = Array.from({ length: LOAD_LIMIT }, () => tx('expense', 1, '2026-10-01'));
  assert.equal(coversSince(big, prev.start), false); // teto + mais antigo depois do início do mês anterior
  big[5] = tx('expense', 1, '2026-08-01');
  assert.equal(coversSince(big, prev.start), true);
});

const today = '2026-10-15';
const open = [
  { type: 'payable', amount: 980, due_date: '2026-10-03' },   // atrasada
  { type: 'payable', amount: '20', due_date: '2026-10-10' },   // atrasada (texto)
  { type: 'receivable', amount: 4200, due_date: '2026-10-12' }, // atrasada
  { type: 'payable', amount: 300, due_date: '2026-10-15' },   // hoje → vence em breve
  { type: 'payable', amount: 700, due_date: '2026-10-22' },   // dentro de 7 dias (limite inclusivo)
  { type: 'payable', amount: 999, due_date: '2026-10-23' },   // fora de 7 dias
  { type: 'receivable', amount: 1500, due_date: '2026-10-28' },
  { type: 'receivable', amount: null, due_date: '2026-10-20' }, // sem valor
  { type: 'payable', amount: 5000, due_date: '2026-11-05' },  // depois do fim do mês
];

t('summarizeOpen', () => {
  const s = summarizeOpen(open, today);
  assert.deepEqual(s.overduePayable, { count: 2, total: 1000, oldestDays: 12 });
  assert.deepEqual(s.overdueReceivable, { count: 1, total: 4200, oldestDays: 3 });
  assert.deepEqual(s.dueSoonPayable, { count: 2, total: 1000, oldestDays: 0 });
});

t('projectMonthEnd: inclui atrasadas, ignora depois do mês e sem valor', () => {
  const p = projectMonthEnd(5900.5, open, today, cur.end);
  assert.equal(p.payable.total, 980 + 20 + 300 + 700 + 999); // 2999
  assert.equal(p.receivable.total, 4200 + 1500);
  assert.equal(p.unknownValueCount, 1); assert.equal(p.receivable.count, 3); assert.equal(p.payable.count, 5);
  assert.equal(p.projected, 5900.5 + 5700 - 2999);
  const empty = projectMonthEnd(100, [], today, cur.end);
  assert.equal(empty.projected, 100);
});

t('buildMonthSummary: normal, sem base e sem lançamentos', () => {
  const full = buildMonthSummary({ monthLabel: cur.label, prevMonthName: 'setembro', income: 10500.5, expense: 4600, comparison: mkCmp({ income: 8000, expense: 2900 }, { income: 10500.5, expense: 4600 }) });
  const text = full.map((p) => p.map((s) => s.text).join('')).join(' | ');
  assert.match(text, /Em outubro de 2026 você recebeu R\$\s10\.500,50 e gastou R\$\s4\.600,00\./);
  assert.match(text, /sobra de R\$\s5\.900,50 \(56,2% da receita\)/);
  assert.match(text, /receitas subiram 31,3% e despesas subiram 58,6%/);
  const deficit = buildMonthSummary({ monthLabel: cur.label, income: 100, expense: 300, comparison: null });
  assert.match(deficit.map((p) => p.map((s) => s.text).join('')).join(' '), /déficit de R\$\s200,00 \(200% da receita\)/);
  assert.equal(deficit.length, 2); // sem comparação quando não há base
  const noBase = buildMonthSummary({ monthLabel: cur.label, prevMonthName: 'setembro', income: 100, expense: 50, comparison: mkCmp({ income: 0, expense: 0 }, { income: 100, expense: 50 }) });
  assert.match(noBase[2].map((s) => s.text).join(''), /sem base de comparação/);
  const empty = buildMonthSummary({ monthLabel: cur.label, income: 0, expense: 0, comparison: null });
  assert.equal(empty[0][0].text, 'Ainda não há lançamentos em outubro de 2026.');
  // cores: despesa subindo = warning, receita subindo = success
  const tones = full[2].filter((s) => s.tone).map((s) => s.tone);
  assert.deepEqual(tones, ['success', 'warning']);
});

t('buildInsights: ordem por gravidade, drills coerentes, limite', () => {
  const summary = summarizeOpen(open, today);
  const projection = projectMonthEnd(5900.5, open, today, cur.end);
  const shares = categoryShares(all, cur, fullCompare);
  const ins = buildInsights({
    today, month: cur, income: 10500.5, expense: 4600, incomeCount: 2, expenseCount: 4,
    comparison: mkCmp({ income: 8000, expense: 2900 }, { income: 10500.5, expense: 4600 }), open: summary, projection, topCategory: shares[0],
  });
  assert.ok(ins.length <= 6);
  assert.equal(ins[0].id, 'overdue-payable'); assert.equal(ins[0].tone, 'danger');
  const tones = ins.map((i) => i.tone);
  const order = { danger: 0, warning: 1, info: 2, success: 3 };
  assert.deepEqual(tones, [...tones].sort((a, b) => order[a] - order[b]));
  const op = ins[0].drill;
  assert.equal(op.filters.endDate, '2026-10-14'); assert.equal(op.filters.startDate, '');
  assert.equal(op.origin.value, 1000); assert.equal(op.origin.count, 2);
  assert.ok(!ins.some((i) => i.id === 'no-overdue')); // há atrasadas
  const conc = ins.find((i) => i.id === 'category-concentration');
  assert.ok(conc); assert.equal(conc.drill.filters.categoryId, 'id-Fornecedores'); assert.match(conc.title, /Fornecedores concentra 65,2% das despesas do mês/);
  assert.ok(ins.every((i) => i.source === 'rule'));
});

t('buildInsights: tudo em dia → só boas notícias; despesa caindo = sucesso', () => {
  const projection = projectMonthEnd(1000, [], today, cur.end);
  const ins = buildInsights({
    today, month: cur, income: 1000, expense: 100, incomeCount: 1, expenseCount: 1,
    comparison: mkCmp({ income: 1000, expense: 1000 }, { income: 1000, expense: 100 }), open: summarizeOpen([{ type: 'receivable', amount: 100, due_date: '2026-10-28' }], today), projection, topCategory: null,
  });
  assert.deepEqual(ins.map((i) => i.id), ['expense-variation', 'no-overdue']);
  // sem nenhuma conta em aberto carregada, não afirma que nada está em atraso
  const none = buildInsights({ today, month: cur, income: 0, expense: 0, incomeCount: 0, expenseCount: 0, comparison: null, open: summarizeOpen([], today), projection: null, topCategory: null });
  assert.deepEqual(none, []);
  assert.equal(ins[0].tone, 'success'); assert.match(ins[0].title, /caíram 90%/);
});

t('buildInsights: previsão negativa vira alerta', () => {
  const o = [{ type: 'payable', amount: 8000, due_date: '2026-10-20' }];
  const projection = projectMonthEnd(500, o, today, cur.end);
  const ins = buildInsights({ today, month: cur, income: 500, expense: 0, incomeCount: 1, expenseCount: 0, comparison: null, open: summarizeOpen(o, today), projection, topCategory: null });
  const neg = ins.find((i) => i.id === 'projection-negative');
  assert.ok(neg); assert.equal(neg.tone, 'danger'); assert.match(neg.detail, /-R\$\s7\.500,00/);
});

t('compareWithPreviousMonth: compara o MESMO trecho dos dois meses', () => {
  const c = compareWithPreviousMonth(all, '2026-10-15');
  assert.equal(c.partial, true);
  assert.equal(c.reference, 'ao mesmo período de setembro (dias 1 a 15)'); assert.equal(c.label, 'setembro (1 a 15)');
  assert.deepEqual(c.currentRange, { start: '2026-10-01', end: '2026-10-15' });
  assert.deepEqual(c.previousRange, { start: '2026-09-01', end: '2026-09-15' });
  // setembro até o dia 15: receita 8000 (05/09) e despesa 2000 (06/09) — os 900 do dia 30 ficam de fora
  assert.deepEqual([c.previous.income, c.previous.expense], [8000, 2000]);
  assert.deepEqual([c.current.income, c.current.expense], [10500.5, 4600]);
  // último dia do mês: compara o mês inteiro
  const end = compareWithPreviousMonth(all, '2026-10-31');
  assert.equal(end.partial, false); assert.equal(end.reference, 'a setembro'); assert.equal(end.label, 'setembro');
  assert.deepEqual([end.previous.income, end.previous.expense], [8000, 2900]);
  // mês anterior mais curto que o dia de hoje (31/mar contra fevereiro)
  const mar = compareWithPreviousMonth([tx('expense', 1, '2026-02-10')], '2026-03-31');
  assert.deepEqual(mar.previousRange, { start: '2026-02-01', end: '2026-02-28' }); assert.equal(mar.partial, false);
  // sem base: mês anterior vazio, lista possivelmente cortada, trecho do mês anterior vazio
  assert.equal(compareWithPreviousMonth([tx('income', 1, '2026-10-02')], '2026-10-15'), null);
  const big = Array.from({ length: LOAD_LIMIT }, () => tx('expense', 1, '2026-10-01'));
  assert.equal(compareWithPreviousMonth(big, '2026-10-15'), null);
  assert.equal(compareWithPreviousMonth([tx('expense', 1, '2026-09-20'), tx('expense', 1, '2026-10-02')], '2026-10-15'), null);
});

t('mês em andamento: variação usa o mesmo trecho e não alarma nos primeiros dias', () => {
  const c15 = compareWithPreviousMonth(all, '2026-10-15');
  const ins = buildInsights({ today: '2026-10-15', month: cur, income: 10500.5, expense: 4600, incomeCount: 2, expenseCount: 4, comparison: c15, open: summarizeOpen([], '2026-10-15'), projection: null, topCategory: null });
  const ev = ins.find((i) => i.id === 'expense-variation');
  assert.equal(ev.title, 'Despesas subiram 130% em relação ao mesmo período de setembro (dias 1 a 15)');
  assert.equal(ev.drill.filters.endDate, '2026-10-15'); assert.equal(ev.drill.origin.value, 4600); assert.equal(ev.drill.origin.count, 4);
  assert.equal(ev.drill.description, 'Despesas · 01/10/2026 a 15/10/2026');
  // dia 5: amostra pequena demais, sem alertas de variação
  const c5 = compareWithPreviousMonth(all, '2026-10-05');
  assert.equal(c5.partial, true);
  const early = buildInsights({ today: '2026-10-05', month: cur, income: 10000, expense: 4000, incomeCount: 1, expenseCount: 2, comparison: c5, open: summarizeOpen([], '2026-10-05'), projection: null, topCategory: null });
  assert.ok(!early.some((i) => i.id.endsWith('-variation')));
  // categorias: Aluguel não existia no trecho 1–15 de setembro (o lançamento de 900 é do dia 30)
  const rows = categoryShares(all, cur, { transactions: all, currentRange: c15.currentRange, previousRange: c15.previousRange });
  const alug = rows.find((r) => r.name === 'Aluguel'); assert.equal(alug.previousValue, 0); assert.equal(alug.change, null);
  assert.equal(rows.find((r) => r.name === 'Fornecedores').change, 50);
});

t('analyzeMonth: junta tudo e respeita os limites de confiança', () => {
  const monthTx = all.filter((x) => x.date >= cur.start && x.date <= cur.end);
  const comparison = compareWithPreviousMonth(all, today);
  const base = { today, monthTransactions: monthTx, allTransactions: all, comparison, income: 10500.5, expense: 4600, incomeCount: 2, expenseCount: 4, openItems: open };
  const a = analyzeMonth(base);
  assert.equal(a.projection.projected, 5900.5 + 5700 - 2999);
  assert.equal(a.categories[0].name, 'Fornecedores'); assert.equal(a.categories[0].change, 50);
  assert.ok(a.summary.length >= 3); assert.ok(a.insights.length > 0);
  // sem mês anterior: o resumo avisa, as categorias não trazem variação
  const b = analyzeMonth({ ...base, comparison: null });
  assert.ok(b.categories.every((r) => r.change === null && r.previousValue === null));
  assert.match(b.summary.map((p) => p.map((x) => x.text).join('')).join(' | '), /Ainda não há base para comparar com setembro./);
  // lista de contas em aberto no teto: sem previsão (e sem insight de previsão)
  const many = Array.from({ length: LOAD_LIMIT }, () => ({ type: 'payable', amount: 1, due_date: '2026-10-20' }));
  const c = analyzeMonth({ ...base, openItems: many });
  assert.equal(c.projection, null); assert.ok(!c.insights.some((i) => i.id.startsWith('projection')));
});

t('formatadores', () => { assert.equal(pct(12.44), '12,4%'); assert.equal(pct(100), '100%'); assert.match(brl(1234.5), /R\$\s1\.234,50/); assert.equal(addDaysISO('2026-10-31', 1), '2026-11-01'); });

console.log(`\n${passed} testes passaram`);
