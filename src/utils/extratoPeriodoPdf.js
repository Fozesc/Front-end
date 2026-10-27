// Extrato geral do periodo (A4 deitado), para apresentar aos socios: o caixa e tudo que
// aconteceu nele. `dados` e' a resposta de /reports/extrato.
import { novoPdf, moeda, dataBR, COR_SITUACAO, NOME_SITUACAO, VERDE, VERMELHO, LARANJA, AZUL, ROXO } from './pdfBase.js';

const soma = (lista, campo) => lista.reduce((t, i) => t + (i[campo] || 0), 0);
const titulo = (i) => [i.emitente, i.numero && `nº ${i.numero}`].filter(Boolean).join(' · ');

export async function gerarExtratoPeriodoPdf(dados) {
  const periodo = dados.inicio === dados.fim ? dataBR(dados.inicio) : `${dataBR(dados.inicio)} a ${dataBR(dados.fim)}`;
  const pdf = await novoPdf({
    orientacao: 'landscape', empresa: dados.empresa, cnpj: dados.cnpj, titulo: 'Extrato do Período',
    detalhe: periodo, geradoEm: dados.gerado_em, rodape: periodo,
  });
  const { ESQ, LARGURA } = pdf;
  const { caixa, borderos, recebimentos, prorrogacoes, vencidos, vales } = dados;
  const r = caixa.resumo;
  const opcoes = { alturaLinha: 5.6, tam: 8 };
  const vazio = (_, msg) => ({ vazio: msg });
  // lista vazia vira uma linha de texto, nao uma tabela com a mensagem cortada na 1a coluna
  const tabela = (colunas, linhas, opts = {}) => {
    if (!linhas.vazio) return pdf.tabela(colunas, linhas, opts);
    pdf.novaPaginaSe(8);
    pdf.texto(linhas.vazio, (opts.x ?? ESQ) + 2, pdf.y + 4.5, { tam: 8.5, cor: 120 });
    pdf.y += 7;
  };

  // ------------------------------------------------------------ resumo
  pdf.quadros([
    ['Saldo inicial', moeda(r.saldo_anterior), `em ${dataBR(dados.inicio)}`],
    ['Entradas', moeda(r.entradas), 'no período', VERDE],
    ['Saídas', moeda(-r.saidas), `${r.qtd} lançamento(s) no caixa`, VERMELHO],
    ['Resultado', moeda(r.entradas - r.saidas), 'entradas - saídas', r.entradas >= r.saidas ? VERDE : VERMELHO],
    ['Saldo final', moeda(r.saldo_final), `em ${dataBR(dados.fim)}`, r.saldo_final < 0 ? VERMELHO : 20],
  ]);
  pdf.quadros([
    ['Borderôs feitos', moeda(soma(borderos, 'face')), `${borderos.length} borderô(s) · ${soma(borderos, 'titulos')} título(s)`, AZUL],
    ['Lucro dos borderôs', moeda(soma(borderos, 'juros')), `juros · comissão ${moeda(soma(borderos, 'comissao'))}`, VERDE],
    ['Recebido de títulos', moeda(soma(recebimentos, 'valor')), `${dados.quitados.qtd} título(s) quitado(s)`, VERDE],
    ['Prorrogações', moeda(soma(prorrogacoes, 'juros')), `${prorrogacoes.length} prorrogação(ões) · juros`, ROXO],
    ['Vales', moeda(soma(vales.saidos, 'valor')), `saíram · ${moeda(vales.em_aberto)} em aberto hoje`, LARANJA],
  ]);

  // ------------------------------------------------------------ contas
  pdf.secao('Contas', 'saldo de cada conta no início e no fim do período');
  const pc = caixa.por_conta;
  tabela([
    { titulo: 'Conta', largura: 73 }, { titulo: 'Saldo inicial', largura: 50, alinhar: 'right' },
    { titulo: 'Entradas', largura: 50, alinhar: 'right' }, { titulo: 'Saídas', largura: 50, alinhar: 'right' },
    { titulo: 'Saldo final', largura: 50, alinhar: 'right' },
  ], pc.map(c => ({
    valores: [c.conta, moeda(c.saldo_anterior), moeda(c.entradas), moeda(-c.saidas), moeda(c.saldo_final)],
    cores: [20, 20, VERDE, VERMELHO, c.saldo_final < 0 ? VERMELHO : 20],
  })), { ...opcoes, total: { valores: ['Total', moeda(soma(pc, 'saldo_anterior')), moeda(soma(pc, 'entradas')), moeda(-soma(pc, 'saidas')), moeda(soma(pc, 'saldo_final'))] } });
  pdf.y += 7;

  // ------------------------------------------------------------ de onde veio / para onde foi
  const meia = (LARGURA - 6) / 2;
  const colCat = [{ titulo: 'Categoria', largura: meia - 60 }, { titulo: 'Qtd', largura: 20, alinhar: 'right' }, { titulo: 'Total', largura: 40, alinhar: 'right' }];
  const cat = (lista, sinal) => (lista.length ? lista.map(c => [c.categoria, c.qtd, moeda(sinal * c.total)]) : vazio(3, 'Nada no período'));
  pdf.novaPaginaSe(30);
  pdf.texto('De onde veio o dinheiro', ESQ, pdf.y, { tam: 10.5, negrito: true });
  pdf.texto('Para onde foi o dinheiro', ESQ + meia + 6, pdf.y, { tam: 10.5, negrito: true });
  pdf.y += 2.5;
  const yCat = pdf.y;
  tabela(colCat, cat(caixa.categorias.entrada, 1), opcoes);
  const yEsq = pdf.y;
  pdf.y = yCat;
  tabela(colCat, cat(caixa.categorias.saida, -1), { ...opcoes, x: ESQ + meia + 6 });
  pdf.y = Math.max(pdf.y, yEsq) + 7;

  // ------------------------------------------------------------ borderos
  pdf.secao(`Borderôs feitos (${borderos.length})`, 'valor de face, o que a empresa ganha e o que foi pago ao cliente');
  tabela([
    { titulo: 'Data', largura: 22 }, { titulo: 'Borderô', largura: 18 }, { titulo: 'Cliente', largura: 73 },
    { titulo: 'Títulos', largura: 16, alinhar: 'right' }, { titulo: 'Valor de face', largura: 30, alinhar: 'right' },
    { titulo: 'Juros', largura: 28, alinhar: 'right' }, { titulo: 'IOF', largura: 24, alinhar: 'right' },
    { titulo: 'Comissão', largura: 26, alinhar: 'right' }, { titulo: 'Pago ao cliente', largura: 36, alinhar: 'right' },
  ], borderos.length ? borderos.map(b => ({
    valores: [dataBR(b.data), `#${b.id}`, b.cliente, b.titulos, moeda(b.face), moeda(b.juros), moeda(b.iof),
              b.comissao ? moeda(b.comissao) : '—', moeda(b.liquido)],
    cores: [20, 90, 20, 90, 20, VERDE, 90, 90, 20],
  })) : vazio(9, 'Nenhum borderô no período'), {
    ...opcoes,
    total: borderos.length ? { valores: ['Total', '', `${borderos.length} borderô(s)`, soma(borderos, 'titulos'), moeda(soma(borderos, 'face')),
      moeda(soma(borderos, 'juros')), moeda(soma(borderos, 'iof')), moeda(soma(borderos, 'comissao')), moeda(soma(borderos, 'liquido'))] } : null,
  });
  pdf.y += 7;

  // ------------------------------------------------------------ recebimentos
  pdf.secao(`Dinheiro recebido de títulos (${recebimentos.length})`, 'recebimentos, parciais, juros de prorrogação e multas');
  tabela([
    { titulo: 'Data', largura: 22 }, { titulo: 'Cliente', largura: 60 }, { titulo: 'Título', largura: 66 },
    { titulo: 'Tipo', largura: 45 }, { titulo: 'Conta', largura: 40 }, { titulo: 'Valor', largura: 40, alinhar: 'right' },
  ], recebimentos.length ? recebimentos.map(i => ({
    valores: [dataBR(i.data), i.cliente, titulo(i), i.categoria, i.conta, moeda(i.valor)],
    cores: [20, 20, 70, 90, 90, VERDE],
  })) : vazio(6, 'Nenhum recebimento no período'), {
    ...opcoes, total: recebimentos.length ? { valores: ['Total', '', '', '', '', moeda(soma(recebimentos, 'valor'))] } : null,
  });
  pdf.y += 7;

  // ------------------------------------------------------------ prorrogacoes
  pdf.secao(`Prorrogações (${prorrogacoes.length})`, 'títulos que ganharam novo vencimento');
  tabela([
    { titulo: 'Data', largura: 22 }, { titulo: 'Cliente', largura: 60 }, { titulo: 'Título', largura: 76 },
    { titulo: 'Vencia', largura: 26 }, { titulo: 'Novo vencimento', largura: 32 }, { titulo: 'Dias', largura: 17, alinhar: 'right' },
    { titulo: 'Juros', largura: 40, alinhar: 'right' },
  ], prorrogacoes.length ? prorrogacoes.map(p => ({
    valores: [dataBR(p.data), p.cliente, titulo(p), dataBR(p.de), dataBR(p.para), p.dias, moeda(p.juros)],
    cores: [20, 20, 70, 90, 20, 90, ROXO],
  })) : vazio(7, 'Nenhuma prorrogação no período'), {
    ...opcoes, total: prorrogacoes.length ? { valores: ['Total', '', '', '', '', '', moeda(soma(prorrogacoes, 'juros'))] } : null,
  });
  pdf.y += 7;

  // ------------------------------------------------------------ vales
  pdf.secao('Vales', `em aberto hoje: ${moeda(vales.em_aberto)}`);
  const linhasVale = [...vales.saidos.map(v => ({ ...v, saiu: true })), ...vales.pagos]
    .sort((a, b) => a.data.localeCompare(b.data))
    .map(v => ({
      valores: [dataBR(v.data), v.saiu ? 'Saiu' : 'Pagamento', v.descricao, v.conta, v.saiu ? v.status : '', moeda(v.saiu ? -v.valor : v.valor)],
      cores: [20, v.saiu ? VERMELHO : VERDE, 20, 90, 90, v.saiu ? VERMELHO : VERDE],
    }));
  tabela([
    { titulo: 'Data', largura: 22 }, { titulo: 'Movimento', largura: 26 }, { titulo: 'Descrição', largura: 125 },
    { titulo: 'Conta', largura: 35 }, { titulo: 'Situação', largura: 25 }, { titulo: 'Valor', largura: 40, alinhar: 'right' },
  ], linhasVale.length ? linhasVale : vazio(6, 'Nenhum vale no período'), opcoes);
  pdf.y += 7;

  // ------------------------------------------------------------ venceram sem pagar
  pdf.secao(`Venceram no período e não foram pagos (${vencidos.length})`, 'situação de hoje');
  tabela([
    { titulo: 'Vencimento', largura: 24 }, { titulo: 'Cliente', largura: 72 }, { titulo: 'Título', largura: 100 },
    { titulo: 'Situação', largura: 37 }, { titulo: 'Valor', largura: 40, alinhar: 'right' },
  ], vencidos.length ? vencidos.map(v => ({
    valores: [dataBR(v.vencimento), v.cliente, titulo(v), NOME_SITUACAO[v.situacao] || v.situacao, moeda(v.valor)],
    cores: [20, 20, 70, COR_SITUACAO[v.situacao] || 20, 20],
  })) : vazio(5, 'Nada venceu sem pagamento no período'), {
    ...opcoes, total: vencidos.length ? { valores: ['Total', `${vencidos.length} título(s)`, '', '', moeda(soma(vencidos, 'valor'))] } : null,
  });
  pdf.y += 7;

  // ------------------------------------------------------------ carteira hoje
  const cart = (s) => dados.carteira[s] || { qtd: 0, valor: 0 };
  const totalCart = Object.values(dados.carteira).reduce((t, c) => t + c.valor, 0);
  pdf.secao('Carteira hoje', 'o que falta receber, na data em que o PDF foi gerado');
  pdf.quadros([
    ['A receber', moeda(totalCart), `${Object.values(dados.carteira).reduce((t, c) => t + c.qtd, 0)} título(s) em aberto`],
    ['A vencer', moeda(cart('Aguardando').valor), `${cart('Aguardando').qtd} título(s)`, AZUL],
    ['Atrasados', moeda(cart('Atrasado').valor), `${cart('Atrasado').qtd} título(s)`, VERMELHO],
    ['Devolvidos', moeda(cart('Devolvido').valor), `${cart('Devolvido').qtd} título(s)`, LARANJA],
    ['Jurídico', moeda(cart('Juridico').valor), `${cart('Juridico').qtd} título(s)`, ROXO],
  ]);

  // ------------------------------------------------------------ extrato do caixa
  pdf.secao(`Extrato do caixa (${caixa.linhas.length} lançamento(s))`, 'o saldo de cada linha soma todas as contas até ali');
  tabela([
    { titulo: 'Data', largura: 20 }, { titulo: 'Descrição', largura: 99 }, { titulo: 'Categoria', largura: 38 },
    { titulo: 'Conta', largura: 30 }, { titulo: 'Entrada', largura: 28, alinhar: 'right' },
    { titulo: 'Saída', largura: 28, alinhar: 'right' }, { titulo: 'Saldo', largura: 30, alinhar: 'right' },
  ], caixa.linhas.length ? caixa.linhas.map(i => ({
    valores: [dataBR(i.data), i.descricao, i.categoria, i.conta, i.entrada != null ? moeda(i.entrada) : '',
              i.saida != null ? moeda(-i.saida) : '', moeda(i.saldo)],
    cores: [20, 20, 90, 90, VERDE, VERMELHO, i.saldo < 0 ? VERMELHO : 20],
  })) : vazio(7, 'Nenhum lançamento no período'), opcoes);
  if (caixa.cortado) {
    pdf.y += 6;
    pdf.novaPaginaSe(6);
    pdf.texto(`Atenção: o extrato parou em ${caixa.linhas.length} de ${caixa.total} lançamentos. Divida o período.`, ESQ, pdf.y, { tam: 8.5, negrito: true, cor: VERMELHO });
  }
  return pdf.finalizar();
}

export async function baixarExtratoPeriodoPdf(dados) {
  const doc = await gerarExtratoPeriodoPdf(dados);
  doc.save(`extrato-${dados.inicio}${dados.fim !== dados.inicio ? `-a-${dados.fim}` : ''}.pdf`);
}
