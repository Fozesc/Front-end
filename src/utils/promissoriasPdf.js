// Notas promissorias do borderô em PDF, 3 por folha A4 com linha de corte. Cada uma com numero da
// parcela, vencimento, valor em numero e por extenso, credor, emitente (o cliente) e as assinaturas do
// emitente e do avalista (nome e CPF do avalista em branco quando nao vierem preenchidos).
// O jspdf so carrega no clique.
import { moeda, dataBR } from './pdfBase.js';
import { valorPorExtenso } from './extenso.js';
import { escreverRico } from './textoRico.js';

const dataExtenso = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
const BRANCO = '______________________________________';
const BRANCO_CURTO = '__________________________';
const ALTURA = 99;

export async function gerarPromissorias({ credor = {}, emitente = {}, avalista = {}, operacaoId = null, dataEmissao, parcelas }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const ESQ = 14, DIR = 196, LARGURA = DIR - ESQ;
  const nomeCredor = credor.nome || 'Fozesc';

  const texto = (t, x, y, { tam = 9, negrito = false, cor = 20, alinhar = 'left' } = {}) => {
    doc.setFont('helvetica', negrito ? 'bold' : 'normal').setFontSize(tam).setTextColor(cor);
    doc.text(String(t ?? ''), x, y, { align: alinhar });
  };
  const caber = (t, largura, tam) => {
    doc.setFontSize(tam);
    const linhas = doc.splitTextToSize(String(t ?? ''), largura);
    return linhas.length > 1 ? `${linhas[0].replace(/\s+\S*$/, '')}…` : (linhas[0] || '');
  };

  parcelas.forEach((p, i) => {
    const vaga = i % 3;
    if (i && !vaga) doc.addPage();
    const y0 = vaga * ALTURA;
    if (vaga) {
      doc.setLineDashPattern([2, 2], 0).setDrawColor(150).setLineWidth(0.2).line(4, y0, 206, y0).setLineDashPattern([], 0);
    }
    doc.setDrawColor(60).setLineWidth(0.5).roundedRect(ESQ - 4, y0 + 6, LARGURA + 8, ALTURA - 12, 2, 2);

    texto('NOTA PROMISSÓRIA', ESQ, y0 + 16, { tam: 15, negrito: true });
    texto(`Nº ${p.numero}`, ESQ, y0 + 22.5, { tam: 10.5, negrito: true, cor: 70 });
    doc.setFont('helvetica', 'bold').setFontSize(10.5);
    texto(`·  Emissão ${dataBR(dataEmissao)}`, ESQ + doc.getTextWidth(`Nº ${p.numero}`) + 2.5, y0 + 22.5, { tam: 8.5, cor: 90 });

    const caixa = (x, largura, rotulo, valor, tam) => {
      doc.setFillColor(241, 245, 249).setDrawColor(120).setLineWidth(0.3).roundedRect(x, y0 + 9.5, largura, 14, 1.5, 1.5, 'FD');
      texto(rotulo, x + 3, y0 + 14, { tam: 7, cor: 90 });
      texto(valor, x + largura - 3, y0 + 20.5, { tam, negrito: true, alinhar: 'right' });
    };
    caixa(DIR - 96, 38, 'Vencimento', dataBR(p.vencimento), 11.5);
    caixa(DIR - 54, 54, 'Valor', moeda(p.valor), 13);

    let y = y0 + 32;
    const linhas = escreverRico(doc, [
      [`No dia ${dataExtenso(p.vencimento)}, pagarei por esta única via de NOTA PROMISSÓRIA a `, 'normal'],
      [nomeCredor, 'bold'],
      ...(credor.cnpj ? [[', CNPJ ', 'normal'], [credor.cnpj, 'bold']] : []),
      [', ou à sua ordem, a quantia de:', 'normal'],
    ], ESQ, y, LARGURA, { tam: 10, entreLinhas: 4.6 });
    y += linhas * 4.6 + 0.5;

    doc.setFont('helvetica', 'bold').setFontSize(10.5);
    const extenso = doc.splitTextToSize(valorPorExtenso(p.valor).toUpperCase(), LARGURA - 6).slice(0, 2);
    const alturaFaixa = extenso.length * 4.8 + 3.2;
    doc.setFillColor(241, 245, 249).rect(ESQ, y - 1, LARGURA, alturaFaixa, 'F');
    doc.setTextColor(20).text(extenso, ESQ + 3, y + 3.2, { lineHeightFactor: 1.3 });
    y += alturaFaixa + 4.5;
    texto('em moeda corrente nacional.', ESQ, y, { tam: 10 });
    texto(`Pagável em: ${credor.endereco || BRANCO}`, DIR, y, { tam: 9, cor: 60, alinhar: 'right' });

    y = y0 + 68;
    const linhaEmitente = (rotulo, valor) => {
      texto(rotulo, ESQ, y, { tam: 8, cor: 90 });
      texto(caber(valor || BRANCO_CURTO, 56, 9.5), ESQ + 18, y, { tam: 9.5, negrito: !!valor });
      y += 5.6;
    };
    linhaEmitente('Emitente', emitente.nome);
    linhaEmitente('CPF/CNPJ', emitente.documento);
    texto('Endereço', ESQ, y, { tam: 8, cor: 90 });
    doc.setFont('helvetica', 'normal').setFontSize(8);
    const linhasEndereco = emitente.endereco ? doc.splitTextToSize(emitente.endereco, 56) : [BRANCO_CURTO];
    const endereco = linhasEndereco.slice(0, 3);
    if (linhasEndereco.length > 3) endereco[2] = caber(`${endereco[2]} …`, 56, 8);
    doc.setTextColor(20).text(endereco, ESQ + 18, y, { lineHeightFactor: 1.2 });

    // assinatura do cliente (emitente) e, ao lado, a do avalista
    const assinatura = (x1, x2, nome, documento, rotulo) => {
      const meio = (x1 + x2) / 2, largura = x2 - x1;
      doc.setDrawColor(20).setLineWidth(0.3).line(x1, y0 + 78.5, x2, y0 + 78.5);
      texto(nome ? caber(nome, largura, 8) : 'Nome: ____________________________', meio, y0 + 82.3,
        { tam: 8, negrito: !!nome, cor: nome ? 20 : 110, alinhar: 'center' });
      texto(documento ? `CPF/CNPJ ${documento}` : 'CPF: _____________________', meio, y0 + 85.8,
        { tam: 7.5, cor: documento ? 50 : 110, alinhar: 'center' });
      texto(rotulo, meio, y0 + 89.2, { tam: 7, cor: 110, alinhar: 'center' });
    };
    assinatura(93, 143, emitente.nome, emitente.documento, 'Assinatura do emitente');
    assinatura(149, DIR, avalista.nome, avalista.documento, 'Assinatura do avalista');

    texto(`${operacaoId ? `Borderô nº ${operacaoId}` : 'SIMULAÇÃO'} · parcela ${i + 1} de ${parcelas.length}`,
      ESQ, y0 + 90.5, { tam: 7, cor: 130 });
  });
  return doc;
}
