// Confere o calendário bancário usado pelo borderô (fim de semana + feriado).
// Sem framework nenhum: roda com   node test_dias_uteis.mjs
import assert from 'node:assert/strict';
import { motivoNaoUtil, proximoDiaUtil } from './src/utils/diasUteis.js';

// --- fim de semana -----------------------------------------------------------
assert.equal(motivoNaoUtil('2026-09-19'), 'Sábado');
assert.equal(motivoNaoUtil('2026-09-20'), 'Domingo');
assert.equal(motivoNaoUtil('2026-09-21'), null, 'segunda comum é dia útil');

// --- feriado fixo ------------------------------------------------------------
assert.equal(motivoNaoUtil('2026-12-25'), 'Natal');
assert.equal(motivoNaoUtil('2026-09-07'), 'Independência');
assert.equal(motivoNaoUtil('2026-11-20'), 'Consciência Negra');
assert.equal(motivoNaoUtil('2026-12-24'), 'Véspera de Natal (sem expediente bancário)');

// --- feriado móvel: Páscoa 2026 = 05/04, 2025 = 20/04 ------------------------
assert.equal(motivoNaoUtil('2026-04-03'), 'Sexta-feira Santa');
assert.equal(motivoNaoUtil('2026-02-16'), 'Carnaval');
assert.equal(motivoNaoUtil('2026-02-17'), 'Carnaval');
assert.equal(motivoNaoUtil('2026-02-18'), null, 'quarta de cinzas compensa normal');
assert.equal(motivoNaoUtil('2026-06-04'), 'Corpus Christi');

assert.equal(motivoNaoUtil('2025-04-18'), 'Sexta-feira Santa');
assert.equal(motivoNaoUtil('2025-03-03'), 'Carnaval');
assert.equal(motivoNaoUtil('2025-03-04'), 'Carnaval');
assert.equal(motivoNaoUtil('2025-06-19'), 'Corpus Christi');

// --- próximo dia útil --------------------------------------------------------
assert.equal(proximoDiaUtil('2026-09-21'), '2026-09-21', 'dia útil não se mexe');
assert.equal(proximoDiaUtil('2026-09-19'), '2026-09-21', 'sábado -> segunda');
assert.equal(proximoDiaUtil('2026-09-20'), '2026-09-21', 'domingo -> segunda');

// 25/12/2026 é sexta (Natal), 24 já é véspera: cai na segunda 28
assert.equal(proximoDiaUtil('2026-12-24'), '2026-12-28');
assert.equal(proximoDiaUtil('2026-12-25'), '2026-12-28');

// 31/12/2026 é quinta (sem expediente), 01/01 sexta (feriado), fim de semana: 04/01
assert.equal(proximoDiaUtil('2026-12-31'), '2027-01-04');

// carnaval 2026: segunda 16 e terça 17 -> quarta 18
assert.equal(proximoDiaUtil('2026-02-16'), '2026-02-18');

// o ajuste só anda para a frente, nunca para trás
for (const d of ['2026-01-01', '2026-02-16', '2026-04-03', '2026-12-25', '2027-05-01']) {
  assert.ok(proximoDiaUtil(d) >= d, `${d} não pode voltar no tempo`);
  assert.equal(motivoNaoUtil(proximoDiaUtil(d)), null, `${d} tem que parar em dia útil`);
}

// --- entrada inválida não quebra a tela --------------------------------------
assert.equal(motivoNaoUtil(''), null);
assert.equal(motivoNaoUtil(null), null);
assert.equal(motivoNaoUtil('25/12/2026'), null);

console.log('OK: fim de semana, feriado fixo, Carnaval/Sexta-feira Santa/Corpus Christi ' +
            'calculados pela Páscoa, emendas de fim de ano e entrada inválida.');
