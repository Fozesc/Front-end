// Relatorio do cliente em PDF (A4 em pe). O jspdf so carrega no clique.
// `cliente` e `operacoes` sao os mesmos objetos que a ficha do cliente ja monta;
// todo valor vem gravado do banco, aqui so soma e desenha.

const moeda = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0).replace(/ /g, ' ');
const dataBR = (d) => (d ? d.split('-').reverse().join('/') : '');

const ESQ = 12, DIR = 198, LARGURA = DIR - ESQ, BAIXO = 280;
const VERDE = [5, 150, 105], VERMELHO = [220, 38, 38];
const COR_SITUACAO = { Pago: VERDE, Atrasado: VERMELHO, Devolvido: [234, 88, 12], Juridico: [126, 34, 206], Aguardando: [37, 99, 235] };
const ORDEM_SITUACAO = ['Aguardando', 'Atrasado', 'Devolvido', 'Juridico', 'Pago'];
const NOME_TIPO = { CHEQUE: 'Cheque', PROMISSORIA: 'Promissória' };

export const situacaoCheque = (c) => (c.isAtrasado ? 'Atrasado' : c.status);

export async function gerarRelatorioClientePdf({ empresa, cnpj, cliente, operacoes, emAberto }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  let y = 14;

  const texto = (t, x, yy, { tam = 9, negrito = false, cor = 20, alinhar = 'left' } = {}) => {
    doc.setFont('helvetica', negrito ? 'bold' : 'normal').setFontSize(tam);
    if (Array.isArray(cor)) doc.setTextColor(...cor); else doc.setTextColor(cor);
    doc.text(String(t ?? ''), x, yy, { align: alinhar });
  };
  const caber = (t, largura, tam) => {
    doc.setFontSize(tam);
    const linhas = doc.splitTextToSize(String(t ?? ''), largura);
    return linhas.length > 1 ? `${linhas[0].replace(/\s+\S*$/, '')}…` : (linhas[0] || '');
  };
  const novaPaginaSe = (altura) => {
    if (y + altura > BAIXO) { doc.addPage(); y = 14; return true; }
    return false;
  };
  const titulo = (t, sub) => {
    novaPaginaSe(20);
    texto(t, ESQ, y, { tam: 10.5, negrito: true });
    if (sub) texto(sub, DIR, y, { tam: 7.5, cor: 120, alinhar: 'right' });
    y += 2.5;
  };

  const tabela = (colunas, linhas, { alturaLinha = 6, tam = 8.5, total = null, antesDoCabecalho = null } = {}) => {
    const larguraTotal = colunas.reduce((t, c) => t + c.largura, 0);
    const cabecalho = () => {
      doc.setFillColor(241, 245, 249).rect(ESQ, y, larguraTotal, alturaLinha + 0.5, 'F');
      let cx = ESQ;
      colunas.forEach(c => {
        const px = c.alinhar === 'right' ? cx + c.largura - 2 : cx + 2;
        texto(c.titulo, px, y + 4.3, { tam: 7.5, negrito: true, cor: 80, alinhar: c.alinhar || 'left' });
        cx += c.largura;
      });
      y += alturaLinha + 0.5;
    };
    cabecalho();
    const linha = (valores, { negrito = false, fundo = null, cores = [] } = {}) => {
      if (novaPaginaSe(alturaLinha)) { antesDoCabecalho?.(); cabecalho(); }
      if (fundo) doc.setFillColor(...fundo).rect(ESQ, y, larguraTotal, alturaLinha, 'F');
      let cx = ESQ;
      colunas.forEach((c, i) => {
        const px = c.alinhar === 'right' ? cx + c.largura - 2 : cx + 2;
        texto(caber(valores[i], c.largura - 4, tam), px, y + 4.2, { tam, negrito, cor: cores[i] ?? 20, alinhar: c.alinhar || 'left' });
        cx += c.largura;
      });
      doc.setDrawColor(226, 232, 240).setLineWidth(0.15).line(ESQ, y + alturaLinha, ESQ + larguraTotal, y + alturaLinha);
      y += alturaLinha;
    };
    linhas.forEach((l, i) => linha(l.valores || l, { cores: l.cores, fundo: i % 2 ? [250, 250, 251] : null }));
    if (total) linha(total.valores, { negrito: true, fundo: [241, 245, 249], cores: total.cores });
  };

  const cheques = operacoes.flatMap(op => op.cheques);
  const soma = (lista, campo) => lista.reduce((t, x) => t + (Number(x[campo]) || 0), 0);
  const geradoEm = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  // ------------------------------------------------------------ cabecalho
  texto(empresa, ESQ, y, { tam: 15, negrito: true });
  texto('Relatório do Cliente', DIR, y, { tam: 13, negrito: true, alinhar: 'right' });
  y += 5.5;
  texto(cnpj ? `CNPJ ${cnpj}` : 'Gestão de recebíveis', ESQ, y, { tam: 8.5, cor: 100 });
  texto(`gerado em ${geradoEm}`, DIR, y, { tam: 8.5, cor: 100, alinhar: 'right' });
  y += 3;
  doc.setDrawColor(15, 23, 42).setLineWidth(0.6).line(ESQ, y, DIR, y);
  y += 7;

  // ------------------------------------------------------------ dados do cliente
  texto(cliente.nome, ESQ, y, { tam: 13, negrito: true });
  y += 6;
  const campos = [
    ['Documento', cliente.documento], ['Telefone', cliente.telefone],
    ['Taxa padrão', `${Number(cliente.taxa).toLocaleString('pt-BR')}% a.m.`], ['Endereço', cliente.enderecoCompleto],
  ];
  const meia = LARGURA / 2;
  campos.forEach(([rotulo, valor], i) => {
    const x = ESQ + (i % 2) * meia;
    texto(rotulo, x, y, { tam: 7.5, cor: 110 });
    texto(caber(valor || '-', meia - 6, 9), x, y + 4.2, { tam: 9 });
    if (i % 2) y += 10;
  });
  y += 2;

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
  const caixas = [
    ['Limite de crédito', moeda(cliente.limite), 'cadastrado', 20],
    ['Em aberto', moeda(emAberto), `tudo que não foi pago${usoLimite}`, 20],
    ['Disponível', moeda(cliente.limite - emAberto), 'limite - em aberto', cliente.limite - emAberto < 0 ? VERMELHO : VERDE],
    ['Inadimplência', moeda(valorInad), `${qtdInad} título(s) atrasado/dev./jurídico`, valorInad > 0 ? VERMELHO : 20],
  ];
  const lc = (LARGURA - 3 * 3) / 4;
  caixas.forEach(([rotulo, valor, sub, cor], i) => {
    const x = ESQ + i * (lc + 3);
    doc.setFillColor(248, 250, 252).setDrawColor(226, 232, 240).setLineWidth(0.2).roundedRect(x, y, lc, 17, 1.5, 1.5, 'FD');
    texto(rotulo, x + 3, y + 5, { tam: 7.5, cor: 100 });
    doc.setFont('helvetica', 'bold').setFontSize(11.5);
    Array.isArray(cor) ? doc.setTextColor(...cor) : doc.setTextColor(cor);
    doc.text(valor, x + 3, y + 11.3);
    texto(caber(sub, lc - 5, 6.5), x + 3, y + 15, { tam: 6.5, cor: 120 });
  });
  y += 24;

  // ------------------------------------------------------------ titulos por situacao
  titulo('Títulos por situação', `${cheques.length} título(s) em ${operacoes.length} borderô(s)`);
  const situacoes = ORDEM_SITUACAO.filter(s => porSituacao[s].qtd)
    .concat(Object.keys(porSituacao).filter(s => !ORDEM_SITUACAO.includes(s)));
  tabela([
    { titulo: 'Situação', largura: 96 }, { titulo: 'Qtd', largura: 30, alinhar: 'right' }, { titulo: 'Valor', largura: 60, alinhar: 'right' },
  ], (situacoes.length ? situacoes : ['Nenhum título']).map(s => ({
    valores: [s === 'Aguardando' ? 'Aguardando (a vencer)' : s, porSituacao[s]?.qtd ?? '', porSituacao[s] ? moeda(porSituacao[s].valor) : ''],
    cores: [COR_SITUACAO[s] || 20, 20, 20],
  })), { total: { valores: ['Total', cheques.length, moeda(soma(cheques, 'valor'))] } });
  y += 7;

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
  y += 7;

  // ------------------------------------------------------------ cheques de cada bordero
  if (operacoes.length) titulo('Títulos de cada borderô', 'valor = o que o título deve hoje (muda com prorrogação ou recebimento parcial)');
  const colCh = [
    { titulo: 'Tipo', largura: 20 }, { titulo: 'Vencimento', largura: 21 }, { titulo: 'Banco / Nº', largura: 34 },
    { titulo: 'Emitente', largura: 47 }, { titulo: 'Valor', largura: 24, alinhar: 'right' },
    { titulo: 'Juros', largura: 20, alinhar: 'right' }, { titulo: 'Situação', largura: 20 },
  ];
  operacoes.forEach(op => {
    const faixa = (continua) => {
      doc.setFillColor(30, 41, 59).rect(ESQ, y, LARGURA, 6.5, 'F');
      texto(`Borderô #${op.id} · ${dataBR(op.data)}${continua ? ' (continuação)' : ''}`, ESQ + 2, y + 4.4, { tam: 8.5, negrito: true, cor: 255 });
      texto(`${op.cheques.length} título(s) · face ${moeda(op.face)} · líquido ${moeda(op.liquido)}`, DIR - 2, y + 4.4, { tam: 8, cor: 226, alinhar: 'right' });
      y += 6.5;
    };
    novaPaginaSe(6.5 + 6.5 + 5.6 * Math.min(op.cheques.length, 3));
    faixa(false);
    const linhas = [...op.cheques].sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || '')).map(c => {
      const s = situacaoCheque(c);
      return {
        valores: [NOME_TIPO[c.tipo] || c.tipo || '-', dataBR(c.vencimento), `${c.banco} - ${c.num_doc}`, c.emitente,
                  moeda(c.valor), moeda(c.juros), s === 'Pago' && c.pagamento ? `Pago ${dataBR(c.pagamento).slice(0, 5)}` : s],
        cores: [90, s === 'Atrasado' ? VERMELHO : 20, 90, 20, 20, 90, COR_SITUACAO[s] || 20],
      };
    });
    tabela(colCh, linhas.length ? linhas : [['', '', '', 'Nenhum título neste borderô', '', '', '']],
      { alturaLinha: 5.6, tam: 8, antesDoCabecalho: () => faixa(true) });
    y += 5;
  });

  // ------------------------------------------------------------ rodape
  const paginas = doc.internal.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    texto(`${empresa} · Relatório do Cliente · ${cliente.nome}`, ESQ, 289, { tam: 7, cor: 140 });
    texto(`Página ${p} de ${paginas}`, DIR, 289, { tam: 7, cor: 140, alinhar: 'right' });
  }
  return doc;
}

export async function baixarRelatorioClientePdf(dados) {
  const doc = await gerarRelatorioClientePdf(dados);
  const nome = dados.cliente.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  doc.save(`relatorio-cliente-${nome || dados.cliente.id}-${new Date().toLocaleDateString('en-CA')}.pdf`);
}
