// Base dos documentos formais (contrato e borderô da operação): brasão da empresa no topo, régua dupla,
// marca d'água discreta, faixas azul-marinho nos quadros, campos com rótulo pequeno em cima do valor e
// rodapé com identificação e página. O jspdf só carrega quando o documento é pedido.

export const AZUL = [21, 47, 92];
export const AZUL_CLARO = [236, 241, 248];
export const CINZA = [100, 110, 126];
export const LINHA = [192, 201, 214];
export const TEXTO = [24, 28, 38];

export async function novoDocumentoFormal({ identificacao, emissor = {}, logo = null, rubricas = false }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const ESQ = 20, DIR = 190, LARGURA = DIR - ESQ, BAIXO = 271, MEIO = 105;
  const f = { doc, ESQ, DIR, LARGURA, BAIXO, MEIO, y: 0 };

  f.texto = (t, x, y, { tam = 10, fonte = 'helvetica', estilo = 'normal', cor = TEXTO, alinhar = 'left' } = {}) => {
    doc.setFont(fonte, estilo).setFontSize(tam).setTextColor(...cor).text(String(t ?? ''), x, y, { align: alinhar });
  };
  f.quebrar = (t, largura, tam = 10, fonte = 'helvetica', estilo = 'normal') => {
    doc.setFont(fonte, estilo).setFontSize(tam);
    return doc.splitTextToSize(String(t ?? ''), largura);
  };

  const marcaDagua = () => {
    if (!logo) return;
    doc.setGState(new doc.GState({ opacity: 0.045 }));
    doc.addImage(logo, 'PNG', MEIO - 52, 105, 104, 104);
    doc.setGState(new doc.GState({ opacity: 1 }));
  };
  const regua = (y) => {
    doc.setDrawColor(...AZUL).setLineWidth(0.7).line(ESQ, y, DIR, y);
    doc.setLineWidth(0.2).line(ESQ, y + 1.1, DIR, y + 1.1);
  };

  const cabecalhoPrimeira = () => {
    marcaDagua();
    let y = 9;
    if (logo) { doc.addImage(logo, 'PNG', MEIO - 8, y, 16, 16); y += 21; } else y += 5;
    f.quebrar(String(emissor.nome || '').toUpperCase(), LARGURA - 20, 10.5, 'times', 'bold').forEach((l) => {
      f.texto(l, MEIO, y, { tam: 10.5, fonte: 'times', estilo: 'bold', cor: AZUL, alinhar: 'center' });
      y += 4.6;
    });
    const sub = [emissor.cnpj && `CNPJ ${emissor.cnpj}`, emissor.endereco].filter(Boolean).join('   ·   ');
    if (sub) { f.texto(sub, MEIO, y - 0.6, { tam: 7.6, cor: CINZA, alinhar: 'center' }); y += 3.6; }
    regua(y + 0.4);
    f.y = y + 8.5;
  };
  const cabecalhoSeguinte = () => {
    marcaDagua();
    if (logo) doc.addImage(logo, 'PNG', ESQ, 8.5, 9.5, 9.5);
    f.texto(identificacao, DIR, 12.6, { tam: 8, estilo: 'bold', cor: AZUL, alinhar: 'right' });
    f.texto(String(emissor.nome || '').toUpperCase(), DIR, 16.4, { tam: 6.8, cor: CINZA, alinhar: 'right' });
    regua(20.5);
    f.y = 29;
  };
  f.novaPagina = () => { doc.addPage(); cabecalhoSeguinte(); };
  f.garantir = (altura) => { if (f.y + altura > BAIXO) f.novaPagina(); };

  // titulo do documento: nome em serifa, linha fina embaixo e a faixa-resumo (rotulo/valor lado a lado)
  f.titulo = (texto, resumo = []) => {
    f.texto(texto, MEIO, f.y, { tam: 15, fonte: 'times', estilo: 'bold', cor: AZUL, alinhar: 'center' });
    f.y += 4;
    if (resumo.length) {
      const l = LARGURA / resumo.length;
      doc.setFillColor(...AZUL_CLARO).setDrawColor(...LINHA).setLineWidth(0.2).roundedRect(ESQ, f.y, LARGURA, 13, 1.2, 1.2, 'FD');
      resumo.forEach(([rotulo, valor], i) => {
        const x = ESQ + i * l;
        if (i) doc.setDrawColor(...LINHA).line(x, f.y + 2.5, x, f.y + 10.5);
        f.texto(String(rotulo).toUpperCase(), x + l / 2, f.y + 4.6, { tam: 6.6, estilo: 'bold', cor: CINZA, alinhar: 'center' });
        f.texto(valor, x + l / 2, f.y + 10, { tam: 11, fonte: 'times', estilo: 'bold', alinhar: 'center' });
      });
      f.y += 13;
    }
    f.y += 6.5;
  };

  // faixa azul de cada quadro/secao
  f.faixa = (texto, { minimo = 30 } = {}) => {
    f.garantir(minimo);
    doc.setFillColor(...AZUL).rect(ESQ, f.y, LARGURA, 6.6, 'F');
    f.texto(String(texto).toUpperCase(), ESQ + 3, f.y + 4.5, { tam: 8.2, estilo: 'bold', cor: [255, 255, 255] });
    f.y += 6.6;
  };

  // sub-titulo dentro de uma coluna (CONTRATADA, REPRESENTANTE...)
  f.subtitulo = (texto, x, y, largura, { claro = false } = {}) => {
    if (claro) doc.setFillColor(...AZUL_CLARO).rect(x, y, largura, 5.6, 'F');
    f.texto(String(texto).toUpperCase(), x + 2, y + 3.9, { tam: 7.2, estilo: 'bold', cor: AZUL });
    if (!claro) doc.setDrawColor(...AZUL).setLineWidth(0.35).line(x, y + 5.6, x + largura, y + 5.6);
    return 5.6;
  };

  // linhas de campos: [[{ r: rotulo, v: valor, w: fracao da largura }]]; devolve a altura usada
  f.campos = (linhas, { x = ESQ, largura = LARGURA, y = f.y, desenhar = true, maxLinhas = 3 } = {}) => {
    let yy = y;
    for (const linha of linhas) {
      const celulas = linha.map((c) => {
        const l = largura * (c.w ?? 1 / linha.length);
        const valor = String(c.v ?? '').trim();
        return { ...c, l, linhas: valor ? f.quebrar(valor, l - 4, 9.8, 'times').slice(0, maxLinhas) : ['—'], vazio: !valor };
      });
      const altura = Math.max(...celulas.map(c => c.linhas.length)) * 4.1 + 6.2;
      if (desenhar) {
        let cx = x;
        for (const c of celulas) {
          doc.setDrawColor(...LINHA).setLineWidth(0.2).rect(cx, yy, c.l, altura);
          // rotulo comprido diminui ate caber na celula (nao invade a vizinha)
          const rotulo = String(c.r).toUpperCase();
          let tamRotulo = 6.2;
          while (tamRotulo > 4.6 && doc.setFont('helvetica', 'bold').setFontSize(tamRotulo).getTextWidth(rotulo) > c.l - 3.5) tamRotulo -= 0.2;
          f.texto(rotulo, cx + 2, yy + 3.1, { tam: tamRotulo, estilo: 'bold', cor: CINZA });
          c.linhas.forEach((t, k) => f.texto(t, cx + 2, yy + 7.3 + k * 4.1, { tam: 9.8, fonte: 'times', cor: c.vazio ? LINHA : TEXTO }));
          cx += c.l;
        }
      }
      yy += altura;
    }
    return yy - y;
  };

  // tabela: colunas [{ t, w, alinhar }] (w em mm), linhas [[...]]; repete o cabecalho se mudar de pagina;
  // total: [...] vira a ultima linha, em negrito e com fundo
  f.tabela = (colunas, linhas, { antesDoCabecalho = null, total = null } = {}) => {
    const cab = () => {
      doc.setFillColor(...AZUL_CLARO).rect(ESQ, f.y, LARGURA, 7, 'F');
      let x = ESQ;
      colunas.forEach((c) => {
        f.texto(String(c.t).toUpperCase(), c.alinhar === 'right' ? x + c.w - 2 : c.alinhar === 'center' ? x + c.w / 2 : x + 2,
          f.y + 4.7, { tam: 6.8, estilo: 'bold', cor: AZUL, alinhar: c.alinhar || 'left' });
        x += c.w;
      });
      doc.setDrawColor(...AZUL).setLineWidth(0.35).line(ESQ, f.y + 7, DIR, f.y + 7);
      f.y += 7;
    };
    cab();
    linhas.forEach((valores, i) => {
      const quebras = valores.map((v, k) => f.quebrar(String(v ?? ''), colunas[k].w - 4, 9.6, 'times'));
      const altura = Math.max(...quebras.map(q => q.length)) * 4.2 + 3.6;
      if (f.y + altura > BAIXO) { f.novaPagina(); antesDoCabecalho?.(); cab(); }
      if (i % 2) doc.setFillColor(248, 250, 253).rect(ESQ, f.y, LARGURA, altura, 'F');
      let x = ESQ;
      quebras.forEach((q, k) => {
        const c = colunas[k];
        const px = c.alinhar === 'right' ? x + c.w - 2 : c.alinhar === 'center' ? x + c.w / 2 : x + 2;
        q.forEach((t, j) => f.texto(t, px, f.y + 5 + j * 4.2, { tam: 9.6, fonte: 'times', alinhar: c.alinhar || 'left' }));
        x += c.w;
      });
      doc.setDrawColor(...LINHA).setLineWidth(0.2).line(ESQ, f.y + altura, DIR, f.y + altura);
      f.y += altura;
    });
    if (total) {
      if (f.y + 8 > BAIXO) { f.novaPagina(); antesDoCabecalho?.(); cab(); }
      doc.setFillColor(...AZUL_CLARO).rect(ESQ, f.y, LARGURA, 7.6, 'F');
      doc.setDrawColor(...AZUL).setLineWidth(0.35).line(ESQ, f.y, DIR, f.y);
      let x = ESQ;
      total.forEach((v, k) => {
        const c = colunas[k];
        const px = c.alinhar === 'right' ? x + c.w - 2 : c.alinhar === 'center' ? x + c.w / 2 : x + 2;
        f.texto(String(v ?? ''), px, f.y + 5.1, { tam: 9.6, fonte: 'times', estilo: 'bold', alinhar: c.alinhar || 'left' });
        x += c.w;
      });
      f.y += 7.6;
    }
  };

  // linhas "rotulo .......... R$ valor" (demonstrativos)
  f.demonstrativo = (itens) => {
    for (const [letra, rotulo, valor, { recuo = 0, negrito = false } = {}] of itens) {
      f.garantir(7);
      f.texto(letra, ESQ + 2 + recuo, f.y + 4.6, { tam: 9.6, fonte: 'times', estilo: 'bold', cor: AZUL });
      f.texto(rotulo, ESQ + 10 + recuo, f.y + 4.6, { tam: 9.6, fonte: 'times', estilo: negrito ? 'bold' : 'normal' });
      if (valor !== null && valor !== undefined) {
        f.texto('R$', DIR - 34, f.y + 4.6, { tam: 9.6, fonte: 'times', cor: CINZA });
        f.texto(valor, DIR - 2, f.y + 4.6, { tam: 9.6, fonte: 'times', estilo: negrito ? 'bold' : 'normal', alinhar: 'right' });
      }
      doc.setDrawColor(...LINHA).setLineWidth(0.15).line(ESQ, f.y + 6.6, DIR, f.y + 6.6);
      f.y += 6.6;
    }
  };

  f.finalizar = (rodape) => {
    const paginas = doc.internal.getNumberOfPages();
    for (let p = 1; p <= paginas; p++) {
      doc.setPage(p);
      doc.setDrawColor(...LINHA).setLineWidth(0.2).line(ESQ, 279, DIR, 279);
      f.texto(rodape, ESQ, 283.5, { tam: 7, cor: CINZA });
      if (rubricas) f.texto('Rubricas:', MEIO - 22, 283.5, { tam: 7, cor: CINZA });   // espaco em branco para rubricar
      f.texto(`Página ${p} de ${paginas}`, DIR, 283.5, { tam: 7, cor: CINZA, alinhar: 'right' });
    }
    return doc;
  };

  cabecalhoPrimeira();
  return f;
}

// a logo do site (public/logo.png) em data URL, para o jsPDF
let logoEmCache = null;
export async function logoDoSite() {
  if (logoEmCache) return logoEmCache;
  const blob = await (await fetch('/logo.png')).blob();
  logoEmCache = await new Promise((ok, erro) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(leitor.result);
    leitor.onerror = erro;
    leitor.readAsDataURL(blob);
  });
  return logoEmCache;
}
