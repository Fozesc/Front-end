// Borderô em PDF a partir do que ficou gravado (GET /operations/<id>/documento): o mesmo demonstrativo
// do dia, para baixar de novo pela ficha do cliente, pelo titulo ou logo depois de efetivar.
import { novoPdf, moeda, dataBR } from './pdfBase.js';

const virgula = (n) => String(Number(n || 0)).replace('.', ',');

export async function gerarBorderoPdf(d) {
  const promissorias = d.titulos.length > 0 && d.titulos.every(t => t.tipo === 'PROMISSORIA');
  const nome = promissorias ? 'Promissórias' : 'Cheques';
  const pdf = await novoPdf({
    empresa: d.empresa.nome, cnpj: d.empresa.cnpj, titulo: `Borderô nº ${d.id}`,
    detalhe: `Data da operação ${dataBR(d.data)}`, rodape: d.cliente.nome,
  });
  const { doc, ESQ, DIR, LARGURA } = pdf;

  // cliente e emitente/avalista lado a lado
  const meio = ESQ + LARGURA / 2;
  doc.setFillColor(248, 250, 252).setDrawColor(203, 213, 225).setLineWidth(0.25).roundedRect(ESQ, pdf.y, LARGURA, 22, 1.5, 1.5, 'FD');
  doc.line(meio, pdf.y + 3, meio, pdf.y + 19);
  pdf.texto('Cliente', ESQ + 3, pdf.y + 5, { tam: 7.5, cor: 100 });
  pdf.texto(pdf.caber(d.cliente.nome, LARGURA / 2 - 6, 12), ESQ + 3, pdf.y + 11, { tam: 12, negrito: true });
  pdf.texto(pdf.caber([d.cliente.documento && `CPF/CNPJ ${d.cliente.documento}`, d.cliente.telefone && `Tel. ${d.cliente.telefone}`]
    .filter(Boolean).join('  ·  '), LARGURA / 2 - 6, 8), ESQ + 3, pdf.y + 16.5, { tam: 8, cor: 60 });
  const emitentes = [...new Set(d.titulos.map(t => t.emitente).filter(Boolean))].join(', ');
  pdf.texto(promissorias ? 'Emitente das promissórias' : 'Emitente dos cheques', meio + 3, pdf.y + 5, { tam: 7.5, cor: 100 });
  pdf.texto(pdf.caber(promissorias ? d.cliente.nome : (emitentes || '—'), LARGURA / 2 - 6, 10), meio + 3, pdf.y + 11, { tam: 10, negrito: true });
  if (promissorias && d.avalista.nome) {
    pdf.texto(pdf.caber(`Avalista: ${d.avalista.nome}${d.avalista.documento ? ` · CPF/CNPJ ${d.avalista.documento}` : ''}`,
      LARGURA / 2 - 6, 8), meio + 3, pdf.y + 16.5, { tam: 8, cor: 60 });
  }
  pdf.y += 27;

  const condicoes = [
    `Taxa: ${virgula(d.taxa_mensal)}% a.m.`, `Compensação: ${d.dias_compensacao} dia(s)`,
    `IOF: ${d.iof_total > 0 ? moeda(d.iof_total) : 'não cobrado'}`,
    d.conta_saida && `Pagamento: ${d.conta_saida}`,
    d.comissao_valor > 0 && `Comissão: ${moeda(d.comissao_valor)}`,
  ].filter(Boolean).join('    ·    ');
  doc.setFont('helvetica', 'normal').setFontSize(8.5);
  const linhasCondicoes = doc.splitTextToSize(condicoes, LARGURA).slice(0, 2);
  doc.setTextColor(40).text(linhasCondicoes, ESQ, pdf.y, { lineHeightFactor: 1.4 });
  pdf.y += 3 + linhasCondicoes.length * 4.2;

  const comBanco = !promissorias && d.titulos.some(t => t.banco);
  const comIof = d.iof_total > 0;
  const colunas = [
    { titulo: '#', largura: 8 }, { titulo: 'Vencimento', largura: 24 }, { titulo: 'Dias', largura: 12, alinhar: 'right' },
    { titulo: 'Nº doc', largura: 22 }, ...(comBanco ? [{ titulo: 'Banco', largura: 22 }] : []),
    { titulo: 'Valor', largura: 28, alinhar: 'right' }, { titulo: 'Juros', largura: 24, alinhar: 'right' },
    ...(comIof ? [{ titulo: 'IOF', largura: 20, alinhar: 'right' }] : []), { titulo: 'Líquido', largura: 26, alinhar: 'right' },
  ];
  const soma = colunas.reduce((t, c) => t + c.largura, 0);
  colunas.forEach(c => { c.largura = (c.largura * LARGURA) / soma; });
  const linhas = d.titulos.map((t, i) => [
    i + 1, dataBR(t.vencimento), t.dias, t.numero || '—', ...(comBanco ? [t.banco || '—'] : []),
    moeda(t.valor), moeda(t.juros), ...(comIof ? [moeda(t.iof)] : []), moeda(t.liquido),
  ]);
  pdf.secao(`${nome} (${d.titulos.length})`);
  pdf.y += 1.5;
  pdf.tabela(colunas, linhas, {
    total: { valores: ['', 'Total', '', '', ...(comBanco ? [''] : []), moeda(d.valor_total), moeda(d.juros_total),
      ...(comIof ? [moeda(d.iof_total)] : []), moeda(d.liquido_total)] },
  });
  pdf.y += 6;

  // resumo a direita e observacao a esquerda, juntos com a assinatura na mesma pagina
  pdf.novaPaginaSe(75);
  const larguraResumo = 78, xr = DIR - larguraResumo;
  const resumo = [['Valor bruto', moeda(d.valor_total)], ['(-) Juros', moeda(d.juros_total)],
    ...(comIof ? [['(-) IOF', moeda(d.iof_total)]] : [])];
  const alturaResumo = 6 + resumo.length * 5.5 + 9;
  doc.setFillColor(241, 245, 249).roundedRect(xr, pdf.y, larguraResumo, alturaResumo, 1.5, 1.5, 'F');
  resumo.forEach(([r, v], i) => {
    pdf.texto(r, xr + 4, pdf.y + 6 + i * 5.5, { tam: 9 });
    pdf.texto(v, DIR - 4, pdf.y + 6 + i * 5.5, { tam: 9, alinhar: 'right' });
  });
  const yl = pdf.y + 6 + resumo.length * 5.5 + 2;
  doc.setDrawColor(148, 163, 184).setLineWidth(0.3).line(xr + 4, yl - 3.5, DIR - 4, yl - 3.5);
  pdf.texto('Líquido a pagar', xr + 4, yl + 1.5, { tam: 11, negrito: true });
  pdf.texto(moeda(d.liquido_total), DIR - 4, yl + 1.5, { tam: 11, negrito: true, alinhar: 'right' });
  if (d.observacao) {
    doc.setFont('helvetica', 'normal').setFontSize(8.5);
    const obs = doc.splitTextToSize(`Observações: ${d.observacao}`, xr - ESQ - 8).slice(0, 8);
    doc.setTextColor(40).text(obs, ESQ, pdf.y + 5, { lineHeightFactor: 1.35 });
  }
  pdf.y += alturaResumo + 10;

  pdf.texto(`Declaro que conferi ${promissorias ? 'as promissórias' : 'os cheques'} e os valores acima e estou de acordo com este borderô.`,
    ESQ, pdf.y, { tam: 9 });
  pdf.y += 24;
  const xa = (ESQ + DIR) / 2;
  doc.setDrawColor(20).setLineWidth(0.3).line(xa - 55, pdf.y, xa + 55, pdf.y);
  pdf.texto(d.cliente.nome.toUpperCase(), xa, pdf.y + 5, { tam: 10, negrito: true, alinhar: 'center' });
  if (d.cliente.documento) pdf.texto(`CPF/CNPJ ${d.cliente.documento}`, xa, pdf.y + 9.5, { tam: 8.5, alinhar: 'center' });
  pdf.texto('Assinatura do cliente', xa, pdf.y + (d.cliente.documento ? 13.5 : 9.5), { tam: 8, cor: 110, alinhar: 'center' });
  return pdf.finalizar();
}
