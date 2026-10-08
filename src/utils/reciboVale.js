// Recibo do vale em PDF para imprimir e assinar. O jspdf so carrega no clique.
// Sem `pagamento` = recibo da saida do vale (quem pegou assina que recebeu).
// O nome de quem assina fica em branco para preencher a mao.

const moeda = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0).replace(/ /g, ' ');
const dataBR = (d) => (d ? d.split('-').reverse().join('/') : '-');
const dataExtenso = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
const LINHA_NOME = '_________________________________________';

export async function gerarRecibo({ empresa = {}, vale, pagamento = null }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const esq = 20, dir = 190, largura = dir - esq;
  const nomeEmpresa = empresa.nomeEmpresa || 'Empresa';
  let y = 24;

  const paragrafo = (texto, tamanho = 12, espaco = 6.5) => {
    doc.setFont('helvetica', 'normal').setFontSize(tamanho);
    const linhas = doc.splitTextToSize(texto, largura);
    doc.text(linhas, esq, y, { lineHeightFactor: 1.5 });
    y += linhas.length * tamanho * 0.3528 * 1.5 + espaco;
  };

  doc.setFont('helvetica', 'bold').setFontSize(15).text(nomeEmpresa, esq, y);
  const contato = [empresa.cnpj && `CNPJ ${empresa.cnpj}`, empresa.endereco, empresa.telefone].filter(Boolean).join('  ·  ');
  if (contato) {
    y += 6;
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(90).text(doc.splitTextToSize(contato, largura), esq, y);
    doc.setTextColor(0);
  }
  y += 5;
  doc.setLineWidth(0.6).line(esq, y, dir, y);

  y += 16;
  doc.setFont('helvetica', 'bold').setFontSize(15)
    .text(pagamento ? 'RECIBO DE PAGAMENTO DE VALE' : 'RECIBO DE VALE', 105, y, { align: 'center' });
  y += 11;
  doc.setFontSize(22).text(moeda(pagamento ? pagamento.valor : vale.valor), 105, y, { align: 'center' });
  y += 6;
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(90).text(`Vale nº ${vale.id}`, 105, y, { align: 'center' });
  doc.setTextColor(0);
  y += 14;

  if (pagamento) {
    const pagoAte = vale.valor - pagamento.saldoApos;
    paragrafo(`${nomeEmpresa} declara que recebeu de ${LINHA_NOME} a quantia de ${moeda(pagamento.valor)}, `
      + `referente ao ${pagamento.saldoApos > 0 ? 'pagamento parcial' : 'pagamento'} do vale nº ${vale.id} `
      + `(${vale.descricao}), emitido em ${dataBR(vale.data)}.`);
    const linhas = [
      ['Valor do vale', moeda(vale.valor)],
      ['Pago com este recibo', moeda(pagamento.valor)],
      [`Total pago até ${dataBR(pagamento.data)}`, moeda(pagoAte)],
      ['Saldo restante', moeda(pagamento.saldoApos)],
    ];
    doc.setLineWidth(0.2).setDrawColor(170);
    linhas.forEach(([rotulo, valor], i) => {
      const ultima = i === linhas.length - 1;
      doc.rect(esq, y, largura, 9);
      doc.setFont('helvetica', ultima ? 'bold' : 'normal').setFontSize(11)
        .text(rotulo, esq + 3, y + 6).text(valor, dir - 3, y + 6, { align: 'right' });
      y += 9;
    });
    doc.setDrawColor(0);
    y += 7;
    paragrafo(`Lançamento no caixa: ${pagamento.descricao} (${pagamento.conta})`, 9.5, 2);
  } else {
    paragrafo(`Eu, ${LINHA_NOME}, declaro que recebi de ${nomeEmpresa} a quantia de ${moeda(vale.valor)} `
      + `a título de vale (adiantamento) nº ${vale.id}, em ${dataBR(vale.data)}, comprometendo-me a devolvê-la.`);
    paragrafo(`Descrição: ${vale.descricao}`, 10.5, 2);
  }

  y = Math.max(y + 14, 190);
  doc.setFont('helvetica', 'normal').setFontSize(12)
    .text(`_______________________, ${dataExtenso(pagamento ? pagamento.data : vale.data)}.`, dir, y, { align: 'right' });

  y += 34;
  const meio = 105, gap = 8;
  doc.setLineWidth(0.3).line(esq, y, meio - gap, y).line(meio + gap, y, dir, y);
  doc.setFontSize(10)
    .text(pagamento ? 'Assinatura de quem pagou' : 'Assinatura de quem recebeu o vale', (esq + meio - gap) / 2, y + 5, { align: 'center' })
    .text(nomeEmpresa, (meio + gap + dir) / 2, y + 5, { align: 'center', maxWidth: dir - meio - gap });

  return doc;
}

export async function baixarRecibo(dados) {
  const doc = await gerarRecibo(dados);
  const sufixo = dados.pagamento ? `-pagamento-${dados.pagamento.data}-${dados.pagamento.id}` : '';
  doc.save(`recibo-vale-${dados.vale.id}${sufixo}.pdf`);
}
