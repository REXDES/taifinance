// Testes da regra de preço de tabela x lote de leilão. Sem dependências: roda com Node 22.6+.
//   npm run test:trade
import assert from 'node:assert/strict';
import { maxBid, modelMatches } from '../src/lib/machineTrade.ts';

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('ok -', name); };

t('lote do modelo escolhido usa a tabela (modelo com e sem espaço)', () => {
  assert.equal(modelMatches('TRATOR DE PNEUS VALTRA BM 125 4X4', 'BM125', 'Valtra'), true);
  assert.equal(modelMatches('TRATOR DE PNEUS VALTRA BM 125 4X4', 'BM 125', 'Valtra'), true);
  assert.equal(modelMatches('TRATOR MASSEY FERGUSON 5710 4X4', '5710', 'Massey Ferguson'), true);
});

t('lote de outra máquina não usa a tabela', () => {
  assert.equal(modelMatches('TRATOR MASSEY FERGUSON 5710 4X4', 'BM125', 'Valtra'), false);
  assert.equal(modelMatches('COLHEITADEIRA JOHN DEERE S680', 'S680', 'John Deere'), true);
  assert.equal(modelMatches('COLHEITADEIRA JOHN DEERE S680', 'S680', 'Valtra'), false); // marca diferente
  assert.equal(modelMatches('TRATOR AGRICOLA VALTRA BH180 4X4', 'BM125', 'Valtra'), false);
});

t('modelo ou título vazio nunca casa', () => {
  assert.equal(modelMatches('', 'BM125', 'Valtra'), false);
  assert.equal(modelMatches('TRATOR VALTRA', '', 'Valtra'), false);
});

t('lance máximo = preço de tabela / (1 + margem + recuperação)', () => {
  assert.equal(maxBid(130000, 20, 10), 100000);
  assert.equal(maxBid(70000, 20, 10), 53846.15);
});

console.log(`\n${passed} testes ok`);
