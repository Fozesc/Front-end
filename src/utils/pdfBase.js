// Base dos PDFs do sistema: o mesmo cabecalho, tabela, quadros e rodape em todos os
// relatorios. O jspdf so carrega quando um PDF e' pedido.

export const moeda = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0).replace(/[\u00a0\u202f]/g, ' ');
export const dataBR = (d) => (d ? d.split('-').reverse().join('/') : '');
export const VERDE = [5, 150, 105], VERMELHO = [220, 38, 38], LARANJA = [234, 88, 12], ROXO = [126, 34, 206], AZUL = [37, 99, 235];
export const COR_SITUACAO = { Pago: VERDE, Atrasado: VERMELHO, Devolvido: LARANJA, Juridico: ROXO, Aguardando: AZUL };
export const NOME_SITUACAO = { Juridico: 'Jurídico' };
export const NOME_TIPO = { CHEQUE: 'Cheque', PROMISSORIA: 'Promissória' };

export const nomeArquivo = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();

/**
 * Abre o documento ja com o cabecalho padrao da empresa.
 * `detalhe`: a linha de baixo, a direita (periodo, cliente...); `rodape`: o que vai
 * no rodape alem de empresa e titulo.
 */
export async function novoPdf({ orientacao = 'portrait', empresa, cnpj, titulo, detalhe = '', geradoEm, rodape = '' }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: orientacao });
  const deitado = orientacao === 'landscape';
  const ESQ = 12, DIR = deitado ? 285 : 198, BAIXO = deitado ? 194 : 278, RODAPE = deitado ? 203 : 288;
  const LARGURA = DIR - ESQ;
  const quando = geradoEm || new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const pdf = { doc, ESQ, DIR, LARGURA, y: 14 };

  pdf.texto = (t, x, yy, { tam = 9, negrito = false, cor = 20, alinhar = 'left' } = {}) => {
    doc.setFont('helvetica', negrito ? 'bold' : 'normal').setFontSize(tam);
    if (Array.isArray(cor)) doc.setTextColor(...cor); else doc.setTextColor(cor);
    doc.text(String(t ?? ''), x, yy, { align: alinhar });
  };
  // corta o texto para caber numa linha da coluna
  pdf.caber = (t, largura, tam) => {
    doc.setFontSize(tam);
    const linhas = doc.splitTextToSize(String(t ?? ''), largura);
    return linhas.length > 1 ? `${linhas[0].replace(/\s+\S*$/, '')}…` : (linhas[0] || '');
  };

  // as paginas seguintes levam uma faixa curta, para a folha solta dizer de onde e'
  const faixaContinuacao = () => {
    pdf.texto(empresa, ESQ, 10, { tam: 8.5, negrito: true, cor: 60 });
    pdf.texto(`${titulo}${rodape ? ` · ${rodape}` : ''}`, DIR, 10, { tam: 8, cor: 110, alinhar: 'right' });
    doc.setDrawColor(203, 213, 225).setLineWidth(0.3).line(ESQ, 12, DIR, 12);
    pdf.y = 18;
  };
  pdf.novaPaginaSe = (altura) => {
    if (pdf.y + altura <= BAIXO) return false;
    doc.addPage();
    faixaContinuacao();
    return true;
  };

  pdf.secao = (t, sub) => {
    pdf.novaPaginaSe(22);
    pdf.texto(t, ESQ, pdf.y, { tam: 10.5, negrito: true });
    if (sub) pdf.texto(sub, DIR, pdf.y, { tam: 7.5, cor: 120, alinhar: 'right' });
    pdf.y += 2.5;
  };

  // quadros lado a lado: [[rotulo, valor, sub, cor]]
  pdf.quadros = (lista, { altura = 17 } = {}) => {
    const vao = 3, lc = (LARGURA - vao * (lista.length - 1)) / lista.length;
    pdf.novaPaginaSe(altura + 4);
    lista.forEach(([rotulo, valor, sub, cor = 20], i) => {
      const x = ESQ + i * (lc + vao);
      doc.setFillColor(248, 250, 252).setDrawColor(226, 232, 240).setLineWidth(0.2).roundedRect(x, pdf.y, lc, altura, 1.5, 1.5, 'FD');
      pdf.texto(rotulo, x + 3, pdf.y + 5, { tam: 7.5, cor: 100 });
      pdf.texto(pdf.caber(valor, lc - 5, 11.5), x + 3, pdf.y + 11.3, { tam: 11.5, negrito: true, cor });
      if (sub) pdf.texto(pdf.caber(sub, lc - 5, 6.5), x + 3, pdf.y + 15, { tam: 6.5, cor: 120 });
    });
    pdf.y += altura + 7;
  };

  // "Filtros aplicados": [[rotulo, valor]] numa caixa, quebrando linha se precisar
  pdf.filtros = (lista) => {
    const corpo = lista.map(([r, v]) => `${r}: ${v}`).join('   ·   ');
    doc.setFont('helvetica', 'normal').setFontSize(8);
    const linhas = doc.splitTextToSize(corpo, LARGURA - 34);
    const altura = 4 + linhas.length * 3.8;
    doc.setFillColor(241, 245, 249).setDrawColor(226, 232, 240).setLineWidth(0.2).roundedRect(ESQ, pdf.y, LARGURA, altura, 1.2, 1.2, 'FD');
    pdf.texto('Filtros aplicados', ESQ + 3, pdf.y + 4.6, { tam: 7.5, negrito: true, cor: 70 });
    linhas.forEach((l, i) => pdf.texto(l, ESQ + 31, pdf.y + 4.6 + i * 3.8, { tam: 8, cor: 40 }));
    pdf.y += altura + 6;
  };

  // colunas [{ titulo, largura, alinhar }]; linhas [[...]] ou { valores, cores, negrito };
  // repete o cabecalho da tabela em cada pagina
  pdf.tabela = (colunas, linhas, { x = ESQ, alturaLinha = 6, tam = 8.5, total = null, antesDoCabecalho = null } = {}) => {
    const larguraTotal = colunas.reduce((t, c) => t + c.largura, 0);
    const cabecalho = () => {
      doc.setFillColor(241, 245, 249).rect(x, pdf.y, larguraTotal, alturaLinha + 0.5, 'F');
      let cx = x;
      colunas.forEach(c => {
        const px = c.alinhar === 'right' ? cx + c.largura - 2 : cx + 2;
        pdf.texto(c.titulo, px, pdf.y + 4.3, { tam: 7.5, negrito: true, cor: 80, alinhar: c.alinhar || 'left' });
        cx += c.largura;
      });
      pdf.y += alturaLinha + 0.5;
    };
    pdf.novaPaginaSe(alturaLinha * 3);
    cabecalho();
    const linha = (valores, { negrito = false, fundo = null, cores = [] } = {}) => {
      if (pdf.novaPaginaSe(alturaLinha)) { antesDoCabecalho?.(); cabecalho(); }
      if (fundo) doc.setFillColor(...fundo).rect(x, pdf.y, larguraTotal, alturaLinha, 'F');
      let cx = x;
      colunas.forEach((c, i) => {
        const px = c.alinhar === 'right' ? cx + c.largura - 2 : cx + 2;
        pdf.texto(pdf.caber(valores[i], c.largura - 4, tam), px, pdf.y + 4.2, { tam, negrito, cor: cores[i] ?? 20, alinhar: c.alinhar || 'left' });
        cx += c.largura;
      });
      doc.setDrawColor(226, 232, 240).setLineWidth(0.15).line(x, pdf.y + alturaLinha, x + larguraTotal, pdf.y + alturaLinha);
      pdf.y += alturaLinha;
    };
    linhas.forEach((l, i) => linha(l.valores || l, { cores: l.cores, negrito: l.negrito, fundo: i % 2 ? [250, 250, 251] : null }));
    if (total) linha(total.valores, { negrito: true, fundo: [226, 232, 240], cores: total.cores });
  };

  // ------------------------------------------------------------ cabecalho padrao
  doc.setFillColor(15, 23, 42).rect(0, 0, deitado ? 297 : 210, 3, 'F');
  pdf.texto(empresa, ESQ, pdf.y + 1, { tam: 16, negrito: true, cor: [15, 23, 42] });
  pdf.texto(titulo, DIR, pdf.y + 1, { tam: 13, negrito: true, cor: [15, 23, 42], alinhar: 'right' });
  pdf.y += 6.5;
  pdf.texto(cnpj ? `CNPJ ${cnpj}` : 'Gestão de recebíveis', ESQ, pdf.y, { tam: 8.5, cor: 100 });
  pdf.texto([detalhe, `gerado em ${quando}`].filter(Boolean).join('  ·  '), DIR, pdf.y, { tam: 8.5, cor: 100, alinhar: 'right' });
  pdf.y += 3;
  doc.setDrawColor(15, 23, 42).setLineWidth(0.6).line(ESQ, pdf.y, DIR, pdf.y);
  pdf.y += 7;

  // rodape em todas as paginas; chamar no fim
  pdf.finalizar = () => {
    const paginas = doc.internal.getNumberOfPages();
    for (let p = 1; p <= paginas; p++) {
      doc.setPage(p);
      doc.setDrawColor(226, 232, 240).setLineWidth(0.2).line(ESQ, RODAPE - 3.5, DIR, RODAPE - 3.5);
      pdf.texto([empresa, titulo, rodape].filter(Boolean).join(' · '), ESQ, RODAPE, { tam: 7, cor: 140 });
      pdf.texto(`Página ${p} de ${paginas}`, DIR, RODAPE, { tam: 7, cor: 140, alinhar: 'right' });
    }
    return doc;
  };
  return pdf;
}
