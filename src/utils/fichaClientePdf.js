// Ficha do cliente em PDF (A4 em pe): cadastro, limite e os titulos de cada borderô.
// Substitui a impressao da tela. As observacoes do cliente ficam de fora de proposito.
import { novoPdf, moeda, dataBR, COR_SITUACAO, NOME_SITUACAO, nomeArquivo, VERDE, VERMELHO } from './pdfBase.js';

const situacao = (c) => (c.isAtrasado && c.status !== 'Juridico' ? 'Atrasado' : c.status);

export async function gerarFichaClientePdf({ empresa, cnpj, cliente, operacoes, emAberto }) {
  const pdf = await novoPdf({ empresa, cnpj, titulo: 'Ficha do Cliente', rodape: cliente.nome });
  const { ESQ, DIR, LARGURA } = pdf;

  // ------------------------------------------------------------ cadastro
  pdf.texto(cliente.nome, ESQ, pdf.y, { tam: 14, negrito: true, cor: [15, 23, 42] });
  pdf.y += 6.5;
  const meia = LARGURA / 2;
  [
    ['Documento', cliente.documento], ['Telefone', cliente.telefone],
    ['Taxa padrão', `${Number(cliente.taxa || 0).toLocaleString('pt-BR')}% a.m.`], ['Endereço', cliente.enderecoCompleto],
  ].forEach(([rotulo, valor], i) => {
    const x = ESQ + (i % 2) * meia;
    pdf.texto(rotulo, x, pdf.y, { tam: 7.5, cor: 110 });
    pdf.texto(pdf.caber(valor || '-', meia - 6, 9.5), x, pdf.y + 4.4, { tam: 9.5 });
    if (i % 2) pdf.y += 10.5;
  });
  pdf.y += 2;

  // ------------------------------------------------------------ credito
  const disponivel = cliente.limite - emAberto;
  const cheques = operacoes.flatMap(op => op.cheques);
  pdf.quadros([
    ['Limite de crédito', moeda(cliente.limite), 'cadastrado'],
    ['Em aberto', moeda(emAberto), `tudo que não foi pago${cliente.limite > 0 ? ` · ${Math.round(emAberto / cliente.limite * 100)}% do limite` : ''}`],
    ['Disponível', moeda(disponivel), 'limite - em aberto', disponivel < 0 ? VERMELHO : VERDE],
  ]);

  // ------------------------------------------------------------ borderos e titulos
  pdf.secao('Borderôs e títulos', `${cheques.length} título(s) em ${operacoes.length} borderô(s)`);
  pdf.y += 1.5;
  const colunas = [
    { titulo: 'Vencimento', largura: 24 }, { titulo: 'Banco', largura: 40 }, { titulo: 'Nº', largura: 22 },
    { titulo: 'Emitente', largura: 52 }, { titulo: 'Valor', largura: 26, alinhar: 'right' }, { titulo: 'Situação', largura: 22 },
  ];
  if (!operacoes.length) pdf.texto('Nenhum borderô para este cliente.', ESQ, pdf.y + 4, { tam: 9, cor: 110 });
  operacoes.forEach(op => {
    const faixa = (continua) => {
      pdf.doc.setFillColor(30, 41, 59).rect(ESQ, pdf.y, LARGURA, 6.5, 'F');
      pdf.texto(`Borderô #${op.id} · ${dataBR(op.data)}${continua ? ' (continuação)' : ''}`, ESQ + 2, pdf.y + 4.4, { tam: 8.5, negrito: true, cor: 255 });
      pdf.texto(`${op.cheques.length} título(s) · total ${moeda(op.total)} · ${op.statusGeral}`, DIR - 2, pdf.y + 4.4, { tam: 8, cor: 226, alinhar: 'right' });
      pdf.y += 6.5;
    };
    pdf.novaPaginaSe(6.5 + 6.5 + 5.6 * Math.min(op.cheques.length, 3));
    faixa(false);
    const linhas = [...op.cheques].sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || '')).map(c => {
      const s = situacao(c);
      return {
        valores: [dataBR(c.vencimento), c.banco, c.num_doc, c.emitente, moeda(c.valor),
                  s === 'Pago' && c.pagamento ? `Pago ${dataBR(c.pagamento).slice(0, 5)}` : (NOME_SITUACAO[s] || s)],
        cores: [s === 'Atrasado' ? VERMELHO : 20, 90, 90, 20, 20, COR_SITUACAO[s] || 20],
      };
    });
    pdf.tabela(colunas, linhas.length ? linhas : [['', '', '', 'Nenhum título neste borderô', '', '']],
               { alturaLinha: 5.6, tam: 8, antesDoCabecalho: () => faixa(true) });
    pdf.y += 5;
  });

  // ------------------------------------------------------------ total geral
  if (cheques.length) {
    pdf.novaPaginaSe(10);
    pdf.doc.setFillColor(226, 232, 240).rect(ESQ, pdf.y, LARGURA, 7, 'F');
    pdf.texto(`Total geral · ${cheques.length} título(s)`, ESQ + 2, pdf.y + 4.8, { tam: 9, negrito: true });
    pdf.texto(moeda(cheques.reduce((t, c) => t + c.valor, 0)), DIR - 2, pdf.y + 4.8, { tam: 9, negrito: true, alinhar: 'right' });
    pdf.y += 7;
  }
  return pdf.finalizar();
}

export async function baixarFichaClientePdf(dados) {
  const doc = await gerarFichaClientePdf(dados);
  doc.save(`ficha-${nomeArquivo(dados.cliente.nome) || dados.cliente.id}-${new Date().toLocaleDateString('en-CA')}.pdf`);
}
