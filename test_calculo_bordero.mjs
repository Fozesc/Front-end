// Prorrogacao usando a conta do Borderô de Liquido (Inverso).
// Rode:  node test_calculo_bordero.mjs
import assert from 'node:assert/strict';
import {
  arredondar, calcularDias, calcularLinha, divisorInverso, calcularProrrogacao
} from './src/utils/calculoBordero.js';

const IOF = { iofEnabled: true, iofBase: 0.38, iofDiario: 0.0082 };
const base = { dataBase: '2026-10-01', novaData: '2026-10-31', taxaMensal: 4, diasCompensacao: 2, ...IOF };

// o que a tela do Borderô faz no modo Líquido (Inverso) com 1 parcela
const borderoInverso = (liquido, dataOperacao, vencimento, taxaMensal, diasComp, iof) => {
  const dias = calcularDias(dataOperacao, vencimento, diasComp);
  return arredondar(liquido / divisorInverso({ dias, taxaMensal, ...iof }));
};

// 1. Juros da prorrogacao = Borderô Inverso sobre o saldo devido
const p = calcularProrrogacao({ ...base, valorAnterior: 1000 });
assert.equal(p.totalComJuros, borderoInverso(1000, base.dataBase, base.novaData, 4, 2, IOF));
assert.equal(p.juros, arredondar(p.totalComJuros - 1000));

// 2. O normal: prorroga pagando os juros (e' o padrao da tela) -> o valor devido fica igual
assert.equal(p.pago, p.juros);
assert.deepEqual([p.jurosPagos, p.abatido, p.jurosNaoPagos, p.novoTotal], [p.juros, 0, 0, 1000]);

// 3. Exemplo do pedido: juros 100, total 1.100, paga 300 -> 100 juros + 200 do saldo -> 800
const e1 = calcularProrrogacao({ ...base, valorAnterior: 1000, jurosManual: 100, pago: 300 });
assert.equal(e1.totalComJuros, 1100);
assert.deepEqual([e1.jurosPagos, e1.abatido, e1.novoTotal], [100, 200, 800]);
//    ...e a proxima prorrogacao calcula sobre os 800, nao sobre 1.100
const e2 = calcularProrrogacao({ ...base, dataBase: '2026-10-31', novaData: '2026-11-30', valorAnterior: e1.novoTotal });
assert.equal(e2.totalComJuros, borderoInverso(800, '2026-10-31', '2026-11-30', 4, 2, IOF));
assert.notEqual(e2.totalComJuros, borderoInverso(1100, '2026-10-31', '2026-11-30', 4, 2, IOF));

// 4. Paga menos que os juros: nao abate nada e o que faltou soma no valor devido
const menos = calcularProrrogacao({ ...base, valorAnterior: 1000, jurosManual: 100, pago: 60 });
assert.deepEqual([menos.jurosPagos, menos.abatido, menos.jurosNaoPagos, menos.novoTotal], [60, 0, 40, 1040]);

// 5. Nao paga nada: os juros inteiros somam no valor devido
const nada = calcularProrrogacao({ ...base, valorAnterior: 1000, pago: 0 });
assert.equal(nada.novoTotal, nada.totalComJuros);
assert.equal(nada.jurosNaoPagos, nada.juros);

// 6. Varios valores: a divisao sempre fecha e nunca abate antes de quitar os juros
for (const pago of [0, 0.01, 50, 99.99, 100, 100.01, 333.33, 1099.99]) {
  const s = calcularProrrogacao({ ...base, valorAnterior: 1000, jurosManual: 100, pago });
  assert.equal(arredondar(s.jurosPagos + s.abatido), arredondar(pago));
  assert.equal(s.jurosPagos, Math.min(pago, 100));
  assert.equal(s.abatido, arredondar(Math.max(pago - 100, 0)));
  assert.equal(s.novoTotal, arredondar(1100 - pago));
}

// 7. Pagamento parcial sem prorrogar: sem juros, o pago abate direto
const parcial = calcularProrrogacao({ ...base, prorrogar: false, valorAnterior: 6020, pago: 3500 });
assert.deepEqual([parcial.juros, parcial.abatido, parcial.novoTotal], [0, 3500, 2520]);
assert.equal(calcularProrrogacao({ ...base, prorrogar: false, valorAnterior: 6020 }).pago, 0);

// 8. Ajuste manual: saldo e juros digitados mandam, o resto acompanha
const s4 = calcularProrrogacao({ ...base, valorAnterior: 1000, saldoManual: 900 });
assert.deepEqual([s4.saldoBase, s4.ajuste, s4.novoTotal], [900, -100, 900]);
assert.equal(s4.totalComJuros, borderoInverso(900, base.dataBase, base.novaData, 4, 2, IOF));
assert.equal(calcularProrrogacao({ ...base, valorAnterior: 1000, jurosManual: 55.5, pago: 0 }).novoTotal, 1055.5);

// 9. Taxa, IOF e datas mudam o calculo
const semIof = calcularProrrogacao({ ...base, valorAnterior: 1000, iofEnabled: false });
assert.ok(semIof.juros < p.juros && semIof.calculado.iof === 0);
assert.ok(calcularProrrogacao({ ...base, valorAnterior: 1000, taxaMensal: 6 }).juros > p.juros);

// 10. Prazo longo demais: a conta inversa nao fecha (divisor <= 0) e nao inventa juros
const longo = calcularProrrogacao({ ...base, valorAnterior: 1000, dataBase: '2023-01-01' });
assert.ok(longo.divisor <= 0);
assert.equal(longo.juros, 0);

// 11. Propriedade do Borderô Inverso: o total com juros descontado devolve o saldo (±1 centavo)
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (let i = 0; i < 20000; i++) {
  const saldo = arredondar(1 + rnd() * 500000);
  const dias = 1 + Math.floor(rnd() * 360);
  const taxaMensal = [1, 2.5, 3, 4, 5.5][i % 5];
  const iof = i % 2 ? IOF : { iofEnabled: false, iofBase: 0.38, iofDiario: 0.0082 };
  const divisor = divisorInverso({ dias, taxaMensal, ...iof });
  if (divisor <= 0) continue;
  const face = arredondar(saldo / divisor);
  const { liquido } = calcularLinha({ valor: face, dias, taxaMensal, ...iof });
  assert.ok(Math.abs(liquido - saldo) <= 0.011 + saldo * 1e-12, `${saldo} ${dias} ${taxaMensal} -> ${liquido}`);
}

console.log('OK: juros da prorrogação pelo Borderô de Líquido (Inverso) sobre o saldo, padrão = paga os juros ' +
            '(valor devido igual), pagamento quita juros antes de abater, menos que os juros soma no saldo, ' +
            'sem prorrogar, ajuste manual, taxa/IOF e prazo inválido.');
