// Regras da tela que ja deram problema (versao 2.11.3). Rode:  TZ=America/Sao_Paulo node test_sessao_datas_partes.mjs
// (o CI roda sem TZ; o teste da data forca o fuso por conta propria)
import assert from 'node:assert/strict';
import { dataLocal, somarDiasLocal } from './src/utils/datas.js';
import { venceEm, sessaoVencida } from './src/utils/sessao.js';
import { valorDaUltimaParte, partesFecham } from './src/utils/contasCaixa.js';

// 1. data local: 21h30 em Sao Paulo ainda e' o mesmo dia (toISOString dava o dia seguinte)
process.env.TZ = 'America/Sao_Paulo';
const noite = new Date('2026-11-03T21:30:00-03:00');
assert.equal(noite.toISOString().slice(0, 10), '2026-11-04', 'o jeito antigo erra: em UTC ja e dia 4');
assert.equal(dataLocal(noite), '2026-11-03', 'a data do borderô as 21h30 e o dia de hoje');
assert.equal(dataLocal(new Date('2026-11-03T00:10:00-03:00')), '2026-11-03', 'logo depois da meia-noite');
assert.equal(somarDiasLocal(30, noite), '2026-12-03');
assert.equal(somarDiasLocal(-30, new Date('2026-03-01T22:00:00-03:00')), '2026-01-30', 'atravessa mes');

// 2. login vencido: le o `exp` do token (base64url) e compara com agora
const token = (payload) => `x.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.y`;
const exp = Math.floor(new Date('2026-11-03T23:00:00-03:00').getTime() / 1000);
assert.equal(venceEm(token({ exp, sub: '4', nome: 'João ç' })), exp);
assert.equal(sessaoVencida({ token: token({ exp }) }, exp * 1000 - 1000), false, 'um segundo antes vale');
assert.equal(sessaoVencida({ token: token({ exp }) }, exp * 1000 + 1000), true, 'depois venceu');
assert.equal(sessaoVencida(null), true, 'sem sessao');
assert.equal(sessaoVencida({ token: 'lixo' }), false, 'token ilegivel: deixa o servidor decidir (ele responde 401)');

// 3. saida dividida: a ultima parte completa o que falta, nunca negativo
const partes = [{ conta: 'Dinheiro', valor: 5000 }, { conta: 'BB', valor: 0 }];
assert.equal(valorDaUltimaParte(partes, 14515), 9515);
assert.equal(valorDaUltimaParte([{ valor: 0.1 }, { valor: 0.2 }, { valor: 0 }], 1), 0.7, 'sem erro de centavo');
assert.equal(valorDaUltimaParte([{ valor: 20000 }, { valor: 0 }], 14515), 0, 'passou do total: zera, nao fica negativo');
partes[1].valor = valorDaUltimaParte(partes, 14515);
assert.ok(partesFecham(partes, 14515), 'depois de completar, a soma fecha');
assert.ok(!partesFecham([{ valor: 14515 }, { valor: 0 }], 14515), 'parte zerada nao vale');

console.log('OK: data local (21h30 nao vira amanha), login vencido pelo exp do token, saida dividida completa a ultima parte.');
