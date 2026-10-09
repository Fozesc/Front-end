// Relatorio do caixa em PDF (A4 deitado). O jspdf so carrega no clique.
// `dados` e' a resposta de /reports/caixa; `itens` e' o extrato inteiro do periodo.

const moeda = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0).replace(/ /g, ' ');
const dataBR = (d) => (d ? d.split('-').reverse().join('/') : '');
export const NOME_CONTA = { todas: 'Todas as contas', dinheiro: 'Dinheiro', bb: 'Banco do Brasil', caixa: 'Caixa Econômica' };
const NOME_TIPO = { todos: 'entradas e saídas', entrada: 'só entradas', saida: 'só saídas' };

const ESQ = 12, DIR = 285, LARGURA = DIR - ESQ, BAIXO = 196;

export async function gerarRelatorioCaixaPdf(dados, itens) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  let y = 14;

  const texto = (t, x, yy, { tam = 9, negrito = false, cor = 20, alinhar = 'left' } = {}) => {
    doc.setFont('helvetica', negrito ? 'bold' : 'normal').setFontSize(tam);
    if (Array.isArray(cor)) doc.setTextColor(...cor); else doc.setTextColor(cor);
    doc.text(String(t ?? ''), x, yy, { align: alinhar });
  };
  // corta o texto para caber na coluna (uma linha so)
  const caber = (t, largura, tam) => {
    doc.setFontSize(tam);
    const linhas = doc.splitTextToSize(String(t ?? ''), largura);
    return linhas.length > 1 ? `${linhas[0].replace(/\s+\S*$/, '')}…` : (linhas[0] || '');
  };
  const novaPaginaSe = (altura) => {
    if (y + altura > BAIXO) { doc.addPage(); y = 14; return true; }
    return false;
  };

  // tabela simples: colunas [{ titulo, largura, alinhar }], linhas [[...]]; repete o cabecalho
  const tabela = (colunas, linhas, { x = ESQ, alturaLinha = 6, tam = 8.5, total = null } = {}) => {
    const cabecalho = () => {
      doc.setFillColor(241, 245, 249).rect(x, y, colunas.reduce((t, c) => t + c.largura, 0), alturaLinha + 0.5, 'F');
      let cx = x;
      colunas.forEach(c => {
        const px = c.alinhar === 'right' ? cx + c.largura - 2 : cx + 2;
        texto(c.titulo, px, y + 4.3, { tam: 7.5, negrito: true, cor: 80, alinhar: c.alinhar || 'left' });
        cx += c.largura;
      });
      y += alturaLinha + 0.5;
    };
    cabecalho();
    const larguraTotal = colunas.reduce((t, c) => t + c.largura, 0);
    const linha = (valores, { negrito = false, fundo = null, cores = [] } = {}) => {
      if (novaPaginaSe(alturaLinha)) cabecalho();
      if (fundo) doc.setFillColor(...fundo).rect(x, y, larguraTotal, alturaLinha, 'F');
      let cx = x;
      colunas.forEach((c, i) => {
        const px = c.alinhar === 'right' ? cx + c.largura - 2 : cx + 2;
        texto(caber(valores[i], c.largura - 4, tam), px, y + 4.2, { tam, negrito, cor: cores[i] ?? 20, alinhar: c.alinhar || 'left' });
        cx += c.largura;
      });
      doc.setDrawColor(226, 232, 240).setLineWidth(0.15).line(x, y + alturaLinha, x + larguraTotal, y + alturaLinha);
      y += alturaLinha;
    };
    linhas.forEach((l, i) => linha(l.valores || l, { cores: l.cores, fundo: i % 2 ? [250, 250, 251] : null }));
    if (total) linha(total.valores, { negrito: true, fundo: [241, 245, 249], cores: total.cores });
  };

  // ------------------------------------------------------------ cabecalho
  texto(dados.empresa, ESQ, y, { tam: 15, negrito: true });
  texto(`Relatório do Caixa — ${NOME_CONTA[dados.conta] || dados.conta}`, DIR, y, { tam: 13, negrito: true, alinhar: 'right' });
  y += 5.5;
  texto(dados.cnpj ? `CNPJ ${dados.cnpj}` : 'Gestão de recebíveis', ESQ, y, { tam: 8.5, cor: 100 });
  texto(`Período: ${dataBR(dados.inicio)} a ${dataBR(dados.fim)} · ${NOME_TIPO[dados.tipo] || ''} · gerado em ${dados.gerado_em}`,
        DIR, y, { tam: 8.5, cor: 100, alinhar: 'right' });
  y += 3;
  doc.setDrawColor(15, 23, 42).setLineWidth(0.6).line(ESQ, y, DIR, y);
  y += 6;

  // ------------------------------------------------------------ resumo
  const r = dados.resumo;
  const caixas = [
    ['Saldo anterior', moeda(r.saldo_anterior), `em ${dataBR(dados.inicio)}`, 20],
    ['Entradas', moeda(r.entradas), 'no período', [5, 150, 105]],
    ['Saídas', moeda(-r.saidas), `${r.qtd} lançamento(s) no período`, [220, 38, 38]],
    ['Saldo final', moeda(r.saldo_final), `em ${dataBR(dados.fim)}`, 20],
  ];
  const lc = (LARGURA - 3 * 4) / 4;
  caixas.forEach(([rotulo, valor, sub, cor], i) => {
    const x = ESQ + i * (lc + 4);
    doc.setFillColor(248, 250, 252).setDrawColor(226, 232, 240).setLineWidth(0.2).roundedRect(x, y, lc, 17, 1.5, 1.5, 'FD');
    texto(rotulo, x + 3, y + 5, { tam: 8, cor: 100 });
    doc.setFont('helvetica', 'bold').setFontSize(13);
    Array.isArray(cor) ? doc.setTextColor(...cor) : doc.setTextColor(cor);
    doc.text(valor, x + 3, y + 11.5);
    texto(sub, x + 3, y + 15.3, { tam: 7, cor: 120 });
  });
  y += 23;

  // ------------------------------------------------------------ por conta
  if (dados.conta === 'todas') {
    texto('Por conta', ESQ, y, { tam: 10, negrito: true });
    y += 2.5;
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
    y += 6;
  }

  // ------------------------------------------------------------ categorias
  const meia = (LARGURA - 6) / 2;
  const listaCat = (lista) => (lista.length ? lista : [{ categoria: 'Nenhum lançamento', qtd: '', total: null }]);
  novaPaginaSe(30);
  const yCat = y;
  texto('Entradas por categoria', ESQ, y, { tam: 10, negrito: true });
  texto('Saídas por categoria', ESQ + meia + 6, y, { tam: 10, negrito: true });
  y += 2.5;
  const colCat = [{ titulo: 'Categoria', largura: meia - 60 }, { titulo: 'Qtd', largura: 20, alinhar: 'right' }, { titulo: 'Total', largura: 40, alinhar: 'right' }];
  const yInicio = y;
  tabela(colCat, listaCat(dados.categorias.entrada).map(c => [c.categoria, c.qtd, c.total === null ? '' : moeda(c.total)]));
  const yFimEsq = y;
  y = yInicio;
  tabela(colCat, listaCat(dados.categorias.saida).map(c => [c.categoria, c.qtd, c.total === null ? '' : moeda(-c.total)]), { x: ESQ + meia + 6 });
  y = Math.max(y, yFimEsq, yCat) + 7;

  // ------------------------------------------------------------ extrato
  novaPaginaSe(20);
  texto(`Extrato (${itens.length} lançamento(s))`, ESQ, y, { tam: 10, negrito: true });
  texto('o saldo de cada linha conta todos os lançamentos da conta até ali', DIR, y, { tam: 7.5, cor: 120, alinhar: 'right' });
  y += 2.5;
  tabela([
    { titulo: 'Data', largura: 20 }, { titulo: 'Descrição', largura: 99 }, { titulo: 'Categoria', largura: 38 },
    { titulo: 'Conta', largura: 30 }, { titulo: 'Entrada', largura: 28, alinhar: 'right' },
    { titulo: 'Saída', largura: 28, alinhar: 'right' }, { titulo: 'Saldo', largura: 30, alinhar: 'right' },
  ], (itens.length ? itens : [{ data: '', descricao: 'Nenhum lançamento no período', categoria: '', conta: '', entrada: null, saida: null, saldo: null }]).map(i => ({
    valores: [dataBR(i.data), i.descricao, i.categoria, i.conta, i.entrada != null ? moeda(i.entrada) : '',
              i.saida != null ? moeda(-i.saida) : '', i.saldo != null ? moeda(i.saldo) : ''],
    cores: [20, 20, 90, 90, [5, 150, 105], [220, 38, 38], i.saldo < 0 ? [220, 38, 38] : 20],
  })), { alturaLinha: 5.6, tam: 8 });

  // ------------------------------------------------------------ rodape
  const paginas = doc.internal.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    texto(`${dados.empresa} · Relatório do Caixa · ${NOME_CONTA[dados.conta] || dados.conta} · ${dataBR(dados.inicio)} a ${dataBR(dados.fim)}`,
          ESQ, 204, { tam: 7, cor: 140 });
    texto(`Página ${p} de ${paginas}`, DIR, 204, { tam: 7, cor: 140, alinhar: 'right' });
  }
  return doc;
}

export async function baixarRelatorioCaixaPdf(dados, itens) {
  const doc = await gerarRelatorioCaixaPdf(dados, itens);
  doc.save(`relatorio-caixa-${dados.conta}-${dados.inicio}-a-${dados.fim}.pdf`);
}
