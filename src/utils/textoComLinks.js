// Divide o texto em pedacos de texto e de link (so http/https e www.), para a tela mostrar o
// link clicavel sem v-html. Pontuacao no fim ("veja www.site.com.") nao entra no link.
const LINK = /(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+)/gi;

export function partesComLinks(bruto) {
  const texto = String(bruto || '');
  const partes = [];
  let ultimo = 0;
  for (const m of texto.matchAll(LINK)) {
    const url = m[0].replace(/[.,;:!?)\]]+$/, '');
    if (m.index > ultimo) partes.push({ texto: texto.slice(ultimo, m.index) });
    partes.push({ texto: url, url: /^www\./i.test(url) ? 'https://' + url : url });
    ultimo = m.index + url.length;
  }
  if (ultimo < texto.length) partes.push({ texto: texto.slice(ultimo) });
  return partes;
}
