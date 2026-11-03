import assert from 'node:assert/strict';
import { valorPorExtenso as e } from './src/utils/extenso.js';

const casos = {
  0.01: 'um centavo', 0.5: 'cinquenta centavos', 1: 'um real', 2: 'dois reais', 15: 'quinze reais',
  21: 'vinte e um reais', 100: 'cem reais', 101: 'cento e um reais', 110: 'cento e dez reais', 999: 'novecentos e noventa e nove reais',
  1000: 'mil reais', 1001: 'mil e um reais', 1100: 'mil e cem reais', 1110: 'mil cento e dez reais',
  1234.56: 'mil duzentos e trinta e quatro reais e cinquenta e seis centavos', 2000: 'dois mil reais',
  3713: 'três mil setecentos e treze reais', 21000: 'vinte e um mil reais', 100000: 'cem mil reais',
  101000: 'cento e um mil reais', 150250: 'cento e cinquenta mil duzentos e cinquenta reais',
  1000000: 'um milhão de reais', 2000000: 'dois milhões de reais', 2500000: 'dois milhões e quinhentos mil reais',
  1000001: 'um milhão e um reais', 1234567.89: 'um milhão duzentos e trinta e quatro mil quinhentos e sessenta e sete reais e oitenta e nove centavos',
  999999.99: 'novecentos e noventa e nove mil novecentos e noventa e nove reais e noventa e nove centavos',
  1.01: 'um real e um centavo', 0: 'zero real',
};
for (const [v, esperado] of Object.entries(casos)) assert.equal(e(Number(v)), esperado, `${v}`);
assert.equal(e('1500'), 'mil e quinhentos reais');
assert.equal(e(0.1 + 0.2), 'trinta centavos');
assert.equal(e(1110.35), 'mil cento e dez reais e trinta e cinco centavos');
console.log('OK: valor por extenso (cem/cento, mil e um, milhão de reais, centavos, ponto flutuante).');
