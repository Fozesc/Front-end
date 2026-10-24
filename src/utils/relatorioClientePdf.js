// Relatorio do cliente em PDF (A4 em pe). O jspdf so carrega no clique.
// `cliente` e `operacoes` sao os mesmos objetos que a ficha do cliente ja monta;
// todo valor vem gravado do banco, aqui so soma e desenha.

import { novoPdf, moeda, dataBR, COR_SITUACAO, NOME_SITUACAO, NOME_TIPO, nomeArquivo, VERDE, VERMELHO } from './pdfBase.js';

const ORDEM_SITUACAO = ['Aguardando', 'Atrasado', 'Devolvido', 'Juridico', 'Pago'];

export const situacaoCheque = (c) => (c.isAtrasado ? 'Atrasado' : c.status);

export async function gerarRelatorioClientePdf({ empresa, cnpj, cliente, operacoes, emAberto }) {
  const pdf = await novoPdf({ empresa, cnpj, titulo: 'Relatório do Cliente', rodape: cliente.nome });
  const { doc, ESQ, DIR, LARGURA, texto, caber, tabela, novaPaginaSe } = pdf;
  const titulo = pdf.secao;

  const cheques = operacoes.flatMap(op => op.cheques);
  const soma = (lista, campo) => lista.reduce((t, x) => t + (Number(x[campo]) || 0), 0);

  // ------------------------------------------------------------ dados do cliente
  texto(cliente.nome, ESQ, pdf.y, { tam: 13, negrito: true });
  pdf.y += 6;
  const campos = [
    ['Documento', cliente.documento], ['Telefone', cliente.telefone],
    ['Taxa padrão', `${Number(cliente.taxa).toLocaleString('pt-BR')}% a.m.`], ['Endereço', cliente.enderecoCompleto],
  ];
  const meia = LARGURA / 2;
  campos.forEach(([rotulo, valor], i) => {
    const x = ESQ + (i % 2) * meia;
    texto(rotulo, x, pdf.y, { tam: 7.5, cor: 110 });
    texto(caber(valor || '-', meia - 6, 9), x, pdf.y + 4.2, { tam: 9 });
    if (i % 2) pdf.y += 10;
  });
  pdf.y += 2;

  // ------------------------------------------------------------ resumo
  const porSituacao = Object.fromEntries(ORDEM_SITUACAO.map(s => [s, { qtd: 0, valor: 0 }]));
  cheques.forEach(c => {
    const s = situacaoCheque(c);
    (porSituacao[s] ??= { qtd: 0, valor: 0 });
    porSituacao[s].qtd += 1; porSituacao[s].valor += c.valor;
  });
  const inad = ['Atrasado', 'Devolvido', 'Juridico'];
  const valorInad = inad.reduce((t, s) => t + porSituacao[s].valor, 0);
  const qtdInad = inad.reduce((t, s) => t + porSituacao[s].qtd, 0);
  const usoLimite = cliente.limite > 0 ? ` · ${Math.round(emAberto / cliente.limite * 100)}% do limite` : '';
  pdf.quadros([
    ['Limite de crédito', moeda(cliente.limite), 'cadastrado'],
    ['Em aberto', moeda(emAberto), `tudo que não foi pago${usoLimite}`],
    ['Disponível', moeda(cliente.limite - emAberto), 'limite - em aberto', cliente.limite - emAberto < 0 ? VERMELHO : VERDE],
    ['Inadimplência', moeda(valorInad), `${qtdInad} título(s) atrasado/dev./jurídico`, valorInad > 0 ? VERMELHO : 20],
  ]);

  // ------------------------------------------------------------ titulos por situacao
  titulo('Títulos por situação', `${cheques.length} título(s) em ${operacoes.length} borderô(s)`);
  const situacoes = ORDEM_SITUACAO.filter(s => porSituacao[s].qtd)
    .concat(Object.keys(porSituacao).filter(s => !ORDEM_SITUACAO.includes(s)));
  tabela([
    { titulo: 'Situação', largura: 96 }, { titulo: 'Qtd', largura: 30, alinhar: 'right' }, { titulo: 'Valor', largura: 60, alinhar: 'right' },
  ], (situacoes.length ? situacoes : ['Nenhum título']).map(s => ({
    valores: [s === 'Aguardando' ? 'Aguardando (a vencer)' : (NOME_SITUACAO[s] || s), porSituacao[s]?.qtd ?? '', porSituacao[s] ? moeda(porSituacao[s].valor) : ''],
    cores: [COR_SITUACAO[s] || 20, 20, 20],
  })), { total: { valores: ['Total', cheques.length, moeda(soma(cheques, 'valor'))] } });
  pdf.y += 7;

  // ------------------------------------------------------------ borderos
  const temComissao = operacoes.some(op => op.comissao > 0);
  titulo('Borderôs', 'valores gravados no borderô · líquido = face - juros - IOF');
  const colOps = temComissao
    ? [['Nº', 13], ['Data', 19], ['Taxa', 11], ['Valor de face', 26, 'right'], ['Juros', 23, 'right'], ['IOF', 19, 'right'],
       ['Comissão', 24, 'right'], ['Líquido', 26, 'right'], ['Situação', 25]]
    : [['Nº', 15], ['Data', 21], ['Taxa', 13], ['Valor de face', 29, 'right'], ['Juros', 27, 'right'], ['IOF', 23, 'right'],
       ['Líquido', 30, 'right'], ['Situação', 28]];
  const linhaOp = (op) => {
    const v = [`#${op.id}`, dataBR(op.data), op.taxa ? `${Number(op.taxa).toLocaleString('pt-BR')}%` : '-',
               moeda(op.face), moeda(op.juros), moeda(op.iof)];
    if (temComissao) v.push(op.comissao ? moeda(op.comissao) : '-');
    v.push(moeda(op.liquido), op.statusGeral);
    return v;
  };
  const totalOps = ['Total', '', '', moeda(soma(operacoes, 'face')), moeda(soma(operacoes, 'juros')), moeda(soma(operacoes, 'iof'))];
  if (temComissao) totalOps.push(moeda(soma(operacoes, 'comissao')));
  totalOps.push(moeda(soma(operacoes, 'liquido')), '');
  tabela(colOps.map(([t, l, a]) => ({ titulo: t, largura: l, alinhar: a })),
    operacoes.length
      ? operacoes.map(op => ({ valores: linhaOp(op), cores: colOps.map((_, i) => (i === colOps.length - 1 ? (op.statusGeral === 'Concluída' ? VERDE : [180, 83, 9]) : 20)) }))
      : [colOps.map((_, i) => (i === 0 ? 'Nenhum borderô' : ''))],
    { total: operacoes.length ? { valores: totalOps } : null });
  pdf.y += 7;

  // ------------------------------------------------------------ cheques de cada bordero
  if (operacoes.length) titulo('Títulos de cada borderô', 'valor = o que o título deve hoje (muda com prorrogação ou recebimento parcial)');
  const colCh = [
    { titulo: 'Tipo', largura: 20 }, { titulo: 'Vencimento', largura: 21 }, { titulo: 'Banco / Nº', largura: 34 },
    { titulo: 'Emitente', largura: 47 }, { titulo: 'Valor', largura: 24, alinhar: 'right' },
    { titulo: 'Juros', largura: 20, alinhar: 'right' }, { titulo: 'Situação', largura: 20 },
  ];
  operacoes.forEach(op => {
    const faixa = (continua) => {
      doc.setFillColor(30, 41, 59).rect(ESQ, pdf.y, LARGURA, 6.5, 'F');
      texto(`Borderô #${op.id} · ${dataBR(op.data)}${continua ? ' (continuação)' : ''}`, ESQ + 2, pdf.y + 4.4, { tam: 8.5, negrito: true, cor: 255 });
      texto(`${op.cheques.length} título(s) · face ${moeda(op.face)} · líquido ${moeda(op.liquido)}`, DIR - 2, pdf.y + 4.4, { tam: 8, cor: 226, alinhar: 'right' });
      pdf.y += 6.5;
    };
    novaPaginaSe(6.5 + 6.5 + 5.6 * Math.min(op.cheques.length, 3));
    faixa(false);
    const linhas = [...op.cheques].sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || '')).map(c => {
      const s = situacaoCheque(c);
      return {
        valores: [NOME_TIPO[c.tipo] || c.tipo || '-', dataBR(c.vencimento), `${c.banco} - ${c.num_doc}`, c.emitente,
                  moeda(c.valor), moeda(c.juros), s === 'Pago' && c.pagamento ? `Pago ${dataBR(c.pagamento).slice(0, 5)}` : (NOME_SITUACAO[s] || s)],
        cores: [90, s === 'Atrasado' ? VERMELHO : 20, 90, 20, 20, 90, COR_SITUACAO[s] || 20],
      };
    });
    tabela(colCh, linhas.length ? linhas : [['', '', '', 'Nenhum título neste borderô', '', '', '']],
      { alturaLinha: 5.6, tam: 8, antesDoCabecalho: () => faixa(true) });
    pdf.y += 5;
  });

  return pdf.finalizar();
}

export async function baixarRelatorioClientePdf(dados) {
  const doc = await gerarRelatorioClientePdf(dados);
  const nome = nomeArquivo(dados.cliente.nome);
  doc.save(`relatorio-cliente-${nome || dados.cliente.id}-${new Date().toLocaleDateString('en-CA')}.pdf`);
}
