// Rode: node test_calc.mjs
import assert from 'node:assert/strict';
import { calcularFolha, slug } from './src/utils/calc.js';

const v = (texto, refs = {}) => calcularFolha(texto, refs).map(r => r.tipo === 'valor' ? Math.round(r.valor * 100) / 100 : r.tipo);
assert.deepEqual(v('capital = 10.000\njuros: capital * 4%\nsoma'), [10000, 400, 10400]);
assert.deepEqual(v('1.500,50 + 4.99\n# nota\n\naluguel 1.200 + luz 237,50'), [1505.49, 'vazio', 'vazio', 1437.5]);
assert.deepEqual(v('@cliente.maria * @taxa%\n@cliente.Maria', { 'cliente.maria': 1000, taxa: 4 }), [40, 1000]);
assert.deepEqual(v('@nao.existe\n10 / 0\n(2 + 3\n2 3'), ['erro', 'erro', 'erro', 'erro']);
assert.deepEqual(v('10\n20\ntotal\n5\nsoma'), [10, 20, 30, 5, 5]);
assert.equal(slug('Banco do Brasil - Joâo'), 'banco_do_brasil_joao');
console.log('OK: folhas de cálculo (variável, rótulo, %, número pt-BR, @ do sistema, soma, erros).');
