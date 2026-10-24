// Confere os PDFs de Titulos, Ficha do Cliente e Relatorio do Cliente (mesmo cabecalho padrao).
// Sem framework nenhum: roda com   node test_relatorios_pdf.mjs [pasta-para-salvar-os-pdfs]
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { gerarRelatorioTitulosPdf, descreverFiltros } from './src/utils/relatorioTitulosPdf.js';
import { gerarFichaClientePdf } from './src/utils/fichaClientePdf.js';
import { gerarRelatorioClientePdf } from './src/utils/relatorioClientePdf.js';

const legivel = (doc) => doc.output().replace(/\\([()])/g, '$1');
const SIT = ['Aguardando', 'Atrasado', 'Pago', 'Devolvido', 'Juridico'];

// ------------------------------------------------------------ titulos: 130 itens, 20 clientes
const itens = Array.from({ length: 130 }, (_, i) => ({
  vencimento: `2026-${String(9 + (i % 3)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`,
  vencimento_original: i % 17 === 0 ? '2026-08-01' : null,
  cliente: i === 5 ? 'Cliente com um nome comercial muito comprido que não cabe na coluna' : `Cliente ${i % 20}`,
  emitente: `Emitente ${i}`, banco: 'Banco do Brasil', numero: String(1000 + i), tipo: i % 4 ? 'CHEQUE' : 'PROMISSORIA',
  bordero: 150 + (i % 9), data_bordero: '2026-08-20', valor: 1000 + i, situacao: SIT[i % 5],
  pagamento: SIT[i % 5] === 'Pago' ? '2026-10-02' : null, fora_do_calculo: i % 23 === 0, dias_atraso: SIT[i % 5] === 'Atrasado' ? 12 : 0,
}));
const soma = (s) => itens.filter(i => i.situacao === s).reduce((t, i) => t + i.valor, 0);
const dados = {
  empresa: 'Fozesc', cnpj: '12.345.678/0001-90', gerado_em: '23/10/2026 10:00', cortado: false, itens,
  resumo: { qtd: 130, valor: itens.reduce((t, i) => t + i.valor, 0), fora: { qtd: 6, valor: 6300 },
            por_status: SIT.map(s => ({ status: s, qtd: itens.filter(i => i.situacao === s).length, valor: soma(s) })) },
};
const filtros = { search: 'joão', status: ['Aguardando', 'Atrasado', 'Devolvido', 'Juridico'], date_start: '2026-09-01', date_end: '2026-11-30', calculo: '', sort_by: 'due_date', sort_order: 'asc' };
assert.deepEqual(descreverFiltros({ status: [] }).map(([, v]) => v), ['nenhuma', 'qualquer data', 'todos', 'todos', 'undefined (crescente)']);

const titulos = await gerarRelatorioTitulosPdf(dados, filtros);
const t1 = legivel(titulos);
assert.ok(titulos.internal.getNumberOfPages() >= 3, '130 títulos vão para várias páginas');
for (const t of ['Relatório de Títulos', 'CNPJ 12.345.678/0001-90', 'Filtros aplicados', 'Busca: "joão"', '01/09/2026 a 30/11/2026',
                 'em aberto (a vencer, atrasado, devolvido, jurídico)', 'Total do filtro', 'Por cliente', 'os 15 maiores de 21 clientes',
                 'Outros 6 clientes', 'Títulos (130)', 'Emitente 129', 'Jurídico', 'Pago 02/10/2026', '(fora)', '12 d',
                 '* vencimento prorrogado', 'Página 3 de']) {
  assert.ok(t1.includes(t), `títulos: faltou ${t}`);
}
assert.ok(!t1.includes('que não cabe na coluna'), 'nome comprido é cortado');

const um = await gerarRelatorioTitulosPdf({ ...dados, itens: itens.filter(i => i.cliente === 'Cliente 3') }, { ...filtros, search: 'Cliente 3' });
assert.ok(!legivel(um).includes('Por cliente'), 'com um cliente só não precisa do quadro por cliente');
const vazio = legivel(await gerarRelatorioTitulosPdf({ ...dados, itens: [] }, filtros));
assert.ok(vazio.includes('Nenhum título com esses filtros'));

// ------------------------------------------------------------ ficha e relatorio do cliente
const ch = (i, s) => ({ id: i, tipo: 'CHEQUE', vencimento: `2026-10-${String(10 + i).slice(-2)}`, valor: 1500 + i, status: s,
  banco: 'Sicredi', num_doc: `00${i}`, emitente: `Emitente ${i}`, juros: 80, pagamento: s === 'Pago' ? '2026-09-10' : null, isAtrasado: i === 3 });
const operacoes = [1, 2].map(o => ({ id: 160 + o, data: '2026-09-0' + o, total: 6000, face: 6000, juros: 400, iof: 20, comissao: 0,
  liquido: 5580, taxa: 4, statusGeral: o === 1 ? 'Concluída' : 'Em Aberto', cheques: [1, 2, 3, 4].map(i => ch(o * 10 + i - 10, o === 1 ? 'Pago' : (i === 4 ? 'Juridico' : 'Aguardando'))) }));
const cliente = { id: 7, nome: 'João da Silva Transportes', documento: '123.456.789-00', telefone: '(45) 99999-0000', taxa: 4,
  limite: 50000, obs: 'NAO PODE APARECER NO PDF', enderecoCompleto: 'Rua X, 100 - Foz do Iguaçu/PR' };

const ficha = legivel(await gerarFichaClientePdf({ empresa: 'Fozesc', cnpj: '12.345.678/0001-90', cliente, operacoes, emAberto: 6000 }));
for (const t of ['Ficha do Cliente', 'CNPJ 12.345.678/0001-90', 'João da Silva Transportes', '123.456.789-00', 'Rua X, 100',
                 'Limite de crédito', 'R$ 50.000,00', 'Disponível', 'R$ 44.000,00', 'Borderô #161', 'Borderô #162', 'Jurídico', 'Atrasado',
                 'Total geral', 'Página 1 de 1']) {
  assert.ok(ficha.includes(t), `ficha: faltou ${t}`);
}
assert.ok(!ficha.includes('NAO PODE APARECER'), 'observação do cliente fica fora da ficha');

const relatorio = legivel(await gerarRelatorioClientePdf({ empresa: 'Fozesc', cnpj: null, cliente, operacoes, emAberto: 6000 }));
for (const t of ['Relatório do Cliente', 'Gestão de recebíveis', 'Títulos por situação', 'Borderôs', 'Títulos de cada borderô', 'Inadimplência']) {
  assert.ok(relatorio.includes(t), `relatório: faltou ${t}`);
}

if (process.argv[2]) {
  writeFileSync(`${process.argv[2]}/titulos.pdf`, Buffer.from(titulos.output('arraybuffer')));
  writeFileSync(`${process.argv[2]}/ficha.pdf`, Buffer.from((await gerarFichaClientePdf({ empresa: 'Fozesc', cnpj: '12.345.678/0001-90', cliente, operacoes, emAberto: 6000 })).output('arraybuffer')));
  writeFileSync(`${process.argv[2]}/relatorio-cliente.pdf`, Buffer.from((await gerarRelatorioClientePdf({ empresa: 'Fozesc', cnpj: '12.345.678/0001-90', cliente, operacoes, emAberto: 6000 })).output('arraybuffer')));
}
console.log('OK: PDFs de Títulos (filtros, resumo, por cliente, lista em várias páginas), Ficha do Cliente (sem observação) e Relatório do Cliente com o cabeçalho padrão.');
