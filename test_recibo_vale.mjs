// Confere o recibo do vale em PDF (saida do vale e pagamento parcial).
// Sem framework nenhum: roda com   node test_recibo_vale.mjs [pasta-para-salvar-os-pdfs]
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { gerarRecibo } from './src/utils/reciboVale.js';

const empresa = { nomeEmpresa: 'Fozesc Fomento', cnpj: '12.345.678/0001-90', endereco: 'Rua A, 10 - Foz', telefone: '(45) 9999-0000' };
const vale = { id: 12, descricao: 'João (motorista) - adiantamento', valor: 500, data: '2026-10-01' };
const pagamento = { id: 77, data: '2026-10-08', valor: 120.5, saldoApos: 279.5, conta: 'BB',
                    descricao: 'Pagamento parcial do vale #12 - João (motorista) - adiantamento (PIX) · descontado do salário' };

const saida = (await gerarRecibo({ empresa, vale })).output();
assert.ok(saida.startsWith('%PDF-'), 'gera PDF');
assert.ok(saida.includes('RECIBO DE VALE'));
assert.ok(saida.includes('R$ 500,00'), 'valor sem espaço especial do Intl');
assert.ok(saida.includes('nº 12'));
assert.ok(saida.includes('_____'), 'nome em branco para preencher à mão');
assert.ok(saida.includes('Fozesc Fomento'));

const pag = (await gerarRecibo({ empresa, vale, pagamento })).output();
assert.ok(pag.includes('RECIBO DE PAGAMENTO DE VALE'));
assert.ok(pag.includes('pagamento parcial'));
assert.ok(pag.includes('R$ 120,50') && pag.includes('R$ 279,50') && pag.includes('R$ 220,50'), 'pago, saldo e total pago até a data');

const quitado = (await gerarRecibo({ empresa: {}, vale, pagamento: { ...pagamento, saldoApos: 0 } })).output();
assert.ok(!quitado.includes('pagamento parcial') && quitado.includes('Empresa'), 'quitação e empresa sem cadastro');

const abatido = (await gerarRecibo({ empresa, vale, pagamento: { ...pagamento, abatimento: true } })).output();
assert.ok(abatido.includes('Descontado da comiss') && !abatido.includes('Lançamento no caixa') && !pag.includes('Descontado da comiss'),
  'desconto com a comissão aparece no recibo');

if (process.argv[2]) {
  writeFileSync(`${process.argv[2]}/recibo-saida.pdf`, Buffer.from(await (await gerarRecibo({ empresa, vale })).output('arraybuffer')));
  writeFileSync(`${process.argv[2]}/recibo-pagamento.pdf`, Buffer.from(await (await gerarRecibo({ empresa, vale, pagamento })).output('arraybuffer')));
}
console.log('OK: recibo de vale e de pagamento em PDF, valores, nome em branco para assinar, quitação, empresa sem cadastro e desconto com a comissão.');
