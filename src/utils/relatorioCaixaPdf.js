// Relatorio do caixa em PDF (A4 deitado). O jspdf so carrega no clique.
// `dados` e' a resposta de /reports/caixa; `itens` e' o extrato inteiro do periodo.

import { novoPdf, moeda, dataBR } from './pdfBase.js';

export const NOME_CONTA = { todas: 'Todas as contas', dinheiro: 'Dinheiro', bb: 'Banco do Brasil', caixa: 'Caixa Econômica' };
const NOME_TIPO = { todos: 'entradas e saídas', entrada: 'só entradas', saida: 'só saídas' };

export async function gerarRelatorioCaixaPdf(dados, itens) {
  const conta = NOME_CONTA[dados.conta] || dados.conta;
  const pdf = await novoPdf({
    orientacao: 'landscape', empresa: dados.empresa, cnpj: dados.cnpj, titulo: `Relatório do Caixa — ${conta}`,
    detalhe: `Período: ${dataBR(dados.inicio)} a ${dataBR(dados.fim)} · ${NOME_TIPO[dados.tipo] || ''}`,
    geradoEm: dados.gerado_em, rodape: `${dataBR(dados.inicio)} a ${dataBR(dados.fim)}`,
  });
  const { ESQ, DIR, LARGURA, texto, tabela, novaPaginaSe } = pdf;

  // ------------------------------------------------------------ resumo
  const r = dados.resumo;
  pdf.quadros([
    ['Saldo anterior', moeda(r.saldo_anterior), `em ${dataBR(dados.inicio)}`],
    ['Entradas', moeda(r.entradas), 'no período', [5, 150, 105]],
    ['Saídas', moeda(-r.saidas), `${r.qtd} lançamento(s) no período`, [220, 38, 38]],
    ['Saldo final', moeda(r.saldo_final), `em ${dataBR(dados.fim)}`],
  ]);

  // ------------------------------------------------------------ por conta
  if (dados.conta === 'todas') {
    texto('Por conta', ESQ, pdf.y, { tam: 10, negrito: true });
    pdf.y += 2.5;
    const pc = dados.por_conta;
    const soma = (campo) => pc.reduce((t, c) => t + c[campo], 0);
    tabela([
      { titulo: 'Conta', largura: 73 }, { titulo: 'Saldo anterior', largura: 50, alinhar: 'right' },
      { titulo: 'Entradas', largura: 50, alinhar: 'right' }, { titulo: 'Saídas', largura: 50, alinhar: 'right' },
      { titulo: 'Saldo final', largura: 50, alinhar: 'right' },
    ], pc.map(c => ({
      valores: [c.conta, moeda(c.saldo_anterior), moeda(c.entradas), moeda(-c.saidas), moeda(c.saldo_final)],
      cores: [20, 20, [5, 150, 105], [220, 38, 38], 20],
    })), { total: { valores: ['Total', moeda(soma('saldo_anterior')), moeda(soma('entradas')), moeda(-soma('saidas')), moeda(soma('saldo_final'))] } });
    pdf.y += 6;
  }

  // ------------------------------------------------------------ categorias
  const meia = (LARGURA - 6) / 2;
  const listaCat = (lista) => (lista.length ? lista : [{ categoria: 'Nenhum lançamento', qtd: '', total: null }]);
  novaPaginaSe(30);
  const yCat = pdf.y;
  texto('Entradas por categoria', ESQ, pdf.y, { tam: 10, negrito: true });
  texto('Saídas por categoria', ESQ + meia + 6, pdf.y, { tam: 10, negrito: true });
  pdf.y += 2.5;
  const colCat = [{ titulo: 'Categoria', largura: meia - 60 }, { titulo: 'Qtd', largura: 20, alinhar: 'right' }, { titulo: 'Total', largura: 40, alinhar: 'right' }];
  const yInicio = pdf.y;
  tabela(colCat, listaCat(dados.categorias.entrada).map(c => [c.categoria, c.qtd, c.total === null ? '' : moeda(c.total)]));
  const yFimEsq = pdf.y;
  pdf.y = yInicio;
  tabela(colCat, listaCat(dados.categorias.saida).map(c => [c.categoria, c.qtd, c.total === null ? '' : moeda(-c.total)]), { x: ESQ + meia + 6 });
  pdf.y = Math.max(pdf.y, yFimEsq, yCat) + 7;

  // ------------------------------------------------------------ extrato
  novaPaginaSe(20);
  texto(`Extrato (${itens.length} lançamento(s))`, ESQ, pdf.y, { tam: 10, negrito: true });
  texto('o saldo de cada linha conta todos os lançamentos da conta até ali', DIR, pdf.y, { tam: 7.5, cor: 120, alinhar: 'right' });
  pdf.y += 2.5;
  tabela([
    { titulo: 'Data', largura: 20 }, { titulo: 'Descrição', largura: 99 }, { titulo: 'Categoria', largura: 38 },
    { titulo: 'Conta', largura: 30 }, { titulo: 'Entrada', largura: 28, alinhar: 'right' },
    { titulo: 'Saída', largura: 28, alinhar: 'right' }, { titulo: 'Saldo', largura: 30, alinhar: 'right' },
  ], (itens.length ? itens : [{ data: '', descricao: 'Nenhum lançamento no período', categoria: '', conta: '', entrada: null, saida: null, saldo: null }]).map(i => ({
    valores: [dataBR(i.data), i.descricao, i.categoria, i.conta, i.entrada != null ? moeda(i.entrada) : '',
              i.saida != null ? moeda(-i.saida) : '', i.saldo != null ? moeda(i.saldo) : ''],
    cores: [20, 20, 90, 90, [5, 150, 105], [220, 38, 38], i.saldo < 0 ? [220, 38, 38] : 20],
  })), { alturaLinha: 5.6, tam: 8 });

  return pdf.finalizar();
}

export async function baixarRelatorioCaixaPdf(dados, itens) {
  const doc = await gerarRelatorioCaixaPdf(dados, itens);
  doc.save(`relatorio-caixa-${dados.conta}-${dados.inicio}-a-${dados.fim}.pdf`);
}
