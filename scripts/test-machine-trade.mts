import assert from 'node:assert/strict';
import { maxBid, requiredSalePrice, suggestedSalePrice, verdict, median } from '../src/lib/machineTrade.ts';

assert.equal(maxBid(130000, 20, 10), 100000);
assert.equal(requiredSalePrice(100000, 20, 10), 130000);
assert.equal(suggestedSalePrice(100000, 8000, 20), 128000);
assert.equal(verdict(90000, 100000), 'opportunity');
assert.equal(verdict(98000, 100000), 'limit');
assert.equal(verdict(101000, 100000), 'out');
assert.equal(median([300, 100, 200]), 200);
console.log('machine trade OK');
