// Confere o CPF/CNPJ (mesmos casos do servidor) e os numeros por extenso das clausulas.
import assert from 'node:assert/strict';
import { documentoValido as v } from './src/utils/documento.js';
import { percentualPorExtenso, numeroFemininoPorExtenso, numeroPorExtenso } from './src/utils/extenso.js';

for (const [doc, ok] of [['529.982.247-25', true], ['52998224725', true], ['529.982.247-24', false], ['111.111.111-11', false],
  ['11.222.333/0001-81', true], ['11.222.333/0001-82', false], ['12.ABC.345/01DE-35', true], ['12abc34501de35', true],
  ['12.ABC.345/01DE-36', false], ['', true], [null, true], ['1234', false], ['00.000.000/0000-00', false],
  ['111.444.777-35', true], ['11.444.777/0001-61', true], ['935.411.347-80', true]]) {
  assert.equal(v(doc), ok, String(doc));
}
assert.equal(percentualPorExtenso(1), 'um por cento');
assert.equal(percentualPorExtenso(2), 'dois por cento');
assert.equal(percentualPorExtenso(10), 'dez por cento');
assert.equal(percentualPorExtenso(1.5), 'um vírgula cinco por cento');
assert.equal(percentualPorExtenso(2.25), 'dois vírgula vinte e cinco por cento');
assert.equal(percentualPorExtenso(0.05), 'zero vírgula zero cinco por cento');
assert.equal(numeroFemininoPorExtenso(2), 'duas');
assert.equal(numeroFemininoPorExtenso(1), 'uma');
assert.equal(numeroFemininoPorExtenso(3), 'três');
assert.equal(numeroPorExtenso(30), 'trinta');
console.log('OK: CPF/CNPJ (com letras) e números por extenso das cláusulas (por cento, vias no feminino).');
