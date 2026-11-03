// Confere o borderô em PDF feito com os dados gravados (GET /operations/<id>/documento).
// Roda com   node test_bordero_pdf.mjs [pasta-para-salvar-os-pdfs]
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { gerarBorderoPdf } from './src/utils/borderoPdf.js';

const base = {
  id: 87, data: '2026-11-03', empresa: { chave: 'PQ', nome: 'PQ Assessoria Ltda', cnpj: '98.765.432/0001-10', endereco: 'Rua B' },
  cliente: { nome: 'Maria da Silva', documento: '123.456.789-00', telefone: '(45) 9999-0000', endereco: 'Rua A' },
  avalista: { nome: 'Jose Avalista', documento: '987.654.321-00' },
  taxa_mensal: 4, dias_compensacao: 0, conta_saida: 'Dinheiro R$ 1.000,00 + BB R$ 834,16', observacao: 'cliente antigo',
  comissao: 1, comissao_valor: 41.5, valor_total: 2000, juros_total: 165.84, iof_total: 0, liquido_total: 1834.16,
  titulos: [
    { tipo: 'PROMISSORIA', numero: '1/2', banco: '', emitente: 'Maria da Silva', vencimento: '2026-12-03', dias: 30, valor: 1000, juros: 40, iof: 0, liquido: 960 },
    { tipo: 'PROMISSORIA', numero: '2/2', banco: '', emitente: 'Maria da Silva', vencimento: '2027-01-04', dias: 62, valor: 1000, juros: 125.84, iof: 0, liquido: 874.16 },
  ],
};
const prom = (await gerarBorderoPdf(base)).output();
for (const t of ['PQ Assessoria Ltda', 'CNPJ 98.765.432/0001-10', '87', 'Maria da Silva', '123.456.789-00', 'Jose Avalista',
  'R$ 2.000,00', 'R$ 165,84', 'R$ 1.834,16', '03/12/2026', '2/2', 'cliente antigo', 'Assinatura do cliente', 'BB R$ 834,16',
  'R$ 41,50', 'Promiss', '\\(-\\) Juros']) assert.ok(prom.includes(t), `falta "${t}"`);
assert.ok(!prom.includes('Banco') && !prom.includes('(IOF)'), 'promissoria sem coluna de banco e sem IOF quando nao cobrou');

const cheques = { ...base, empresa: { nome: 'Fozesc', cnpj: null }, avalista: { nome: '', documento: '' }, iof_total: 12.3, observacao: '',
  titulos: Array.from({ length: 60 }, (_, i) => ({ tipo: 'CHEQUE', numero: String(100 + i), banco: 'Itau', emitente: `Emitente ${i % 3}`,
    vencimento: '2026-12-01', dias: 28, valor: 100, juros: 3, iof: 0.2, liquido: 96.8 })) };
const docCheques = await gerarBorderoPdf(cheques);
const ch = docCheques.output();
assert.ok(ch.includes('Banco') && ch.includes('Itau') && ch.includes('Emitente 0, Emitente 1, Emitente 2') && ch.includes('R$ 12,30'));
assert.ok(!ch.includes('Avalista') && ch.includes('Gest'), 'cheque sem avalista; sem CNPJ mostra o padrao');
assert.ok(docCheques.getNumberOfPages() >= 2 && ch.includes('Assinatura do cliente'), '60 cheques em mais de uma pagina, assinatura no fim');

if (process.argv[2]) {
  writeFileSync(`${process.argv[2]}/bordero-prom.pdf`, Buffer.from((await gerarBorderoPdf(base)).output('arraybuffer')));
  writeFileSync(`${process.argv[2]}/bordero-cheques.pdf`, Buffer.from(docCheques.output('arraybuffer')));
}
console.log('OK: borderô em PDF (empresa e CNPJ, cliente, avalista, titulos, totais, comissão, saída dividida, observação, várias páginas).');
