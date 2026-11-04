// Paragrafo no jsPDF com partes em negrito/italico no meio da frase e, se pedir, justificado (o jsPDF
// so justifica texto de uma fonte so). Usado na promissoria e no contrato.

// "**negrito**" e "_italico_" -> [[texto, estilo]]
export function partesDe(texto) {
  const partes = [];
  const rx = /\*\*(.+?)\*\*|_(.+?)_/g;
  let ultimo = 0;
  for (const m of String(texto).matchAll(rx)) {
    if (m.index > ultimo) partes.push([texto.slice(ultimo, m.index), 'normal']);
    partes.push(m[1] !== undefined ? [m[1], 'bold'] : [m[2], 'italic']);
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) partes.push([texto.slice(ultimo), 'normal']);
  return partes;
}

// partes: [[texto, estilo]] (estilo 'normal' | 'bold' | 'italic' | 'bolditalic') ou texto com ** e _.
// Devolve quantas linhas usou (desenhar: false so mede). "\n" quebra a linha.
export function escreverRico(doc, partes, x, y, largura, { tam = 10, entreLinhas = 5, fonte = 'helvetica', justificar = false, cor = 20, desenhar = true } = {}) {
  if (typeof partes === 'string') partes = partesDe(partes);
  doc.setFontSize(tam).setTextColor(cor);
  // sem kerning: o getTextWidth do jsPDF desconta pares como "TA"/"AD", mas o text() desenha sem
  // desconto, e a palavra em negrito engolia a virgula/espaco seguinte ("CONTRATADAo Borderô")
  const medir = (t, estilo) => doc.setFont(fonte, estilo).getStringUnitWidth(t, { kerning: {} }) * tam / doc.internal.scaleFactor;

  // palavra = pedacos colados (ex.: "CONTRATANTE" em negrito + "," normal)
  const palavras = [];
  let atual = null;
  for (const [texto, estilo] of partes) {
    for (const pedaco of String(texto).split(/(\n|[ \t]+)/)) {
      if (!pedaco) continue;
      if (pedaco === '\n') { palavras.push({ quebra: true }); atual = null; continue; }
      if (/^[ \t]+$/.test(pedaco)) { atual = null; continue; }
      if (!atual) { atual = { pedacos: [], largura: 0 }; palavras.push(atual); }
      atual.pedacos.push([pedaco, estilo]);
      atual.largura += medir(pedaco, estilo);
    }
  }

  const espaco = medir(' ', 'normal');
  const linhas = [];
  let linha = { palavras: [], largura: 0, forcada: false };
  for (const p of palavras) {
    if (p.quebra) { linha.forcada = true; linhas.push(linha); linha = { palavras: [], largura: 0, forcada: false }; continue; }
    const extra = linha.palavras.length ? espaco + p.largura : p.largura;
    if (linha.palavras.length && linha.largura + extra > largura) {
      linhas.push(linha);
      linha = { palavras: [], largura: 0, forcada: false };
    }
    linha.largura += linha.palavras.length ? espaco + p.largura : p.largura;
    linha.palavras.push(p);
  }
  if (linha.palavras.length || !linhas.length) linhas.push({ ...linha, forcada: true });

  if (!desenhar) return linhas.length;
  linhas.forEach((l, i) => {
    const ultima = i === linhas.length - 1 || l.forcada;
    const soma = l.palavras.reduce((t, p) => t + p.largura, 0);
    const vao = justificar && !ultima && l.palavras.length > 1 ? (largura - soma) / (l.palavras.length - 1) : espaco;
    let cx = x;
    for (const p of l.palavras) {
      for (const [t, estilo] of p.pedacos) {
        doc.setFont(fonte, estilo).text(t, cx, y + i * entreLinhas);
        cx += medir(t, estilo);
      }
      cx += vao;
    }
  });
  return linhas.length;
}
