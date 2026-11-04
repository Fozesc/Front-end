// Confere o contrato em PDF: quadros, as 16 clausulas iguais ao modelo, data por extenso e assinaturas.
// Roda com   node test_contrato_pdf.mjs [pasta-para-salvar-o-pdf]
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { gerarContratoPdf, dataPorExtenso, CLAUSULAS, textoClausula } from './src/utils/contratoPdf.js';
import { gerarBorderoOperacaoPdf } from './src/utils/borderoOperacaoPdf.js';
import { gerarNotificacaoCobrancaPdf } from './src/utils/notificacaoCobrancaPdf.js';

assert.equal(dataPorExtenso('2026-11-03'), 'três de Novembro de dois mil e vinte e seis');
assert.equal(dataPorExtenso('2027-01-01'), 'primeiro de Janeiro de dois mil e vinte e sete');
assert.equal(dataPorExtenso('2026-12-21'), 'vinte e um de Dezembro de dois mil e vinte e seis');
assert.equal(CLAUSULAS.filter(b => b.p && b.p.startsWith('**CLÁUSULA')).length, 17, '16 clausulas, com a 6a repetida como no modelo');
// com os padroes, o texto e' o do modelo; com outros numeros, o texto acompanha
const todo = (c) => CLAUSULAS.flatMap(b => b.itens || [b.p || '']).map(t => textoClausula(t, c)).join(' ');
const modelo = todo();
for (const t of ['prazo de reembolso de 30 (trinta) dias', 'fixados em 1% (um por cento) ao mês', 'fixada em 2% (dois por cento) sobre',
  'fixados em 10% (dez por cento) sobre', 'em 02 (duas) vias']) assert.ok(modelo.includes(t), `modelo: falta "${t}"`);
const outro = todo({ prazoReembolso: 15, jurosMora: 1.5, multa: 2, honorarios: 20, vias: 3 });
for (const t of ['de 15 (quinze) dias', '1,5% (um vírgula cinco por cento) ao mês', '20% (vinte por cento)', 'em 03 (três) vias'])
  assert.ok(outro.includes(t), `condicoes: falta "${t}"`);
assert.ok(!modelo.includes('{{'), 'nenhum marcador sobrando');

const rep = { nome: 'Carlos Teixeira Teste', cpf: '111.444.777-35', rg: '', nacionalidade: '', estadoCivil: '', endereco: 'Rua Exemplo, 200, Bairro Teste\nFoz do Iguaçu - PR' };
const dados = {
  numero: '398', valorAntecipado: '22.193,29', local: 'Foz do Iguaçu', data: '2026-11-03',
  contratada: { nome: 'EMPRESA TESTE SOCIEDADE SIMPLES DE CREDITOS LTDA', cnpj: '11.444.777/0001-61', endereco: 'Avenida Exemplo, 100, Centro Foz do Iguaçu - PR',
    telefone: '(45) 90000-0002', email: 'contato@exemplo.com', rep: { nome: 'Fulano de Tal Teste', cpf: '935.411.347-80', rg: '1234567', nacionalidade: 'Brasileiro', estadoCivil: 'Solteiro (a)', endereco: '' } },
  contratante: { nome: 'Alfa Refrigeração Teste Ltda', documento: '11.222.333/0001-81', endereco: 'Rua Exemplo, 200, Bairro Teste\nFoz do Iguaçu - PR',
    telefone: '(45) 90000-0001', email: 'cliente@exemplo.com', rep },
  titulos: [{ tipo: 'Nota promissória', emitente: 'Alfa Refrigeração Teste Ltda', documento: '11.222.333/0001-81', vencimento: '10/12/2026', valor: '22.193,29' }],
  encargos: { valorAntecipado: '20.000,02', taxaJuros: '5,6784', jurosMora: '1,00%', iofAdicionalPct: '0,38%', iofDiarioPct: '0,00274%', iofAdicional: '76,38', iofDiario: '23,68', iofTotal: '100,06' },
  testemunhas: [{ nome: 'Ana Testemunha', cpf: '111.222.333-44', rg: '' }, { nome: '', cpf: '', rg: '' }],
};
const logo = 'data:image/png;base64,' + readFileSync('./public/logo.png').toString('base64');
const doc = await gerarContratoPdf(dados, { logo });
if (process.argv[2]) writeFileSync(`${process.argv[2]}/contrato.pdf`, Buffer.from(doc.output('arraybuffer')));
const pdf = doc.output();
for (const t of ['CONTRATO DE DESCONTO DE T', 'QUADRO 01 \xb7 PARTES', 'REPRESENTANTE DA CONTRATANTE', 'Rubricas', 'EMPRESA TESTE SOCIEDADE', '11.444.777/0001-61', 'Fulano de Tal Teste',
  'Alfa Refrigera', '11.222.333/0001-81', 'Carlos Teixeira Teste', '22.193,29', '20.000,02', '5,6784', '0,00274%', '100,06',
  'DO FORO DE ELEI', 'COAF', 'INPC-IBGE;', '9.613/98.', 'Ana Testemunha', 'TESTEMUNHAS', 'TESTEMUNHA 2', 'REPRESENTANTE', 'GState', 'Novembro', 'vinte', '/Subtype /Image']) {
  assert.ok(pdf.includes(t), `falta "${t}"`);
}
assert.ok(doc.getNumberOfPages() >= 5, 'contrato com varias paginas');
const muitos = await gerarContratoPdf({ ...dados, titulos: Array.from({ length: 40 }, (_, i) => ({ ...dados.titulos[0], valor: String(i) })) });
assert.ok(muitos.getNumberOfPages() > doc.getNumberOfPages(), '40 titulos passam de pagina repetindo o cabecalho do quadro 02');
const vazio = (await gerarContratoPdf({ numero: '1', titulos: [] })).output();
assert.ok(vazio.includes('CL') && !vazio.includes('/Subtype /Image'), 'sem dados e sem logo nao quebra');
if (process.argv[2]) writeFileSync(`${process.argv[2]}/contrato.pdf`, Buffer.from(doc.output('arraybuffer')));
const operacao = { situacao: 'Paga', cliente_desde: '2024-07-01', operador: 'Lucas', qtd_titulos: 1, valor_total: 22193.29, juros: 2193.27,
  iof_total: 100.06, liquido: 19900, taxa_mensal: 5.6784, prazo_medio: 47, taxa_periodo: 9.882582, taxa_efetiva_mes: 6.867, cet_mes: 7.21, cet_ano: 130.7 };
const bord = await gerarBorderoOperacaoPdf({ ...dados, titulos: dados.titulos.map(t => ({ ...t, numero: '01/001' })) }, operacao, { logo, dataOperacao: '2026-10-28' });
if (process.argv[2]) writeFileSync(`${process.argv[2]}/bordero-operacao.pdf`, Buffer.from(bord.output('arraybuffer')));
const b = bord.output();
for (const t of ['BORDER', 'DADOS DA OPERA', '28/10/2026', 'Paga', '01/07/2024', 'Lucas', '5,6784', '6,867', '9,882582%', '47,00', '7,21', '130,70',
  '22.193,29', '2.193,27', '19.900,00', '2.293,33', 'Juros Remunerat', '100,06', '23,68', '76,38', 'ALIENA', '01/001', 'Alfa Refrigera', '11.444.777/0001-61']) {
  assert.ok(b.includes(t), `borderô: falta "${t}"`);
}
const semNumeros = (await gerarBorderoOperacaoPdf({ numero: '2', titulos: [] }, {})).output();
assert.ok(semNumeros.startsWith('%PDF-') && semNumeros.includes('SITUA'), 'sem numeros nao quebra');

const cobranca = { numero: '398', data_contrato: '2026-10-28', local: 'Foz do Iguaçu', hoje: '2026-11-03', contratada: { ...dados.contratada, telefone: '(45) 90000-0002' },
  contratante: dados.contratante, condicoes: { jurosMora: 1, multa: 2, honorarios: 10, prazoReembolso: 30, vias: 2 },
  titulos: [{ tipo: 'Nota promissória', numero: '1/2', vencimento: '2026-09-19', situacao: 'Atrasado', dias: 45, valor: 1000, juros: 15.04, multa: 20.30, total: 1035.34 }],
  totais: { valor: 1000, juros: 15.04, multa: 20.30, total: 1035.34 } };
const notif = await gerarNotificacaoCobrancaPdf(cobranca, { logo });
if (process.argv[2]) writeFileSync(`${process.argv[2]}/notificacao.pdf`, Buffer.from(notif.output('arraybuffer')));
const nt = notif.output();
for (const t of ['NOTIFICA', '1.035,34', '15,04', '20,30', '19/09/2026', '1/2', 'Alfa Refrigera', 'RECEBI EM', '28/10/2026',
  'INPC-IBGE', '90000-0002', 'trinta']) assert.ok(nt.includes(t), `notificação: falta "${t}"`);
await assert.rejects(gerarNotificacaoCobrancaPdf({ ...cobranca, titulos: [] }), /não há o que cobrar/);

console.log('OK: notificação de cobrança (títulos, juros, multa, prazo, recibo; sem vencido avisa). ' +
  'OK: borderô da operação em PDF (dados, taxas, CET, demonstrativos de valores e IOF, títulos). ' +
  'OK: contrato em PDF (quadros 01-03, 16 clausulas do modelo, data por extenso, assinaturas, logo, muitos titulos, dados vazios).');
