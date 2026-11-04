// Notificação de cobrança (Cláusula 7ª do contrato): os títulos vencidos sem pagamento, com número, vencimento e
// os valores discriminados (juros de mora e multa da Cláusula 8ª) calculados até hoje, o prazo de reembolso e o
// espaço do "recebi". `c` = GET /contratos/<id>/cobranca.
import { novoDocumentoFormal } from './documentoFormal.js';
import { escreverRico } from './textoRico.js';
import { dataPorExtenso } from './contratoPdf.js';
import { numeroPorExtenso, percentualPorExtenso } from './extenso.js';

const txt = (s) => String(s ?? '').trim();
const dataBR = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');
const reais = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const porcento = (v) => `${Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% (${percentualPorExtenso(v)})`;
const rotuloDocumento = (n) => (String(n || '').replace(/\D/g, '').length === 11 ? 'CPF' : 'CNPJ');

export async function gerarNotificacaoCobrancaPdf(c, { logo = null } = {}) {
  if (!c.titulos?.length) throw new Error('Este contrato não tem título vencido sem pagamento: não há o que cobrar.');
  const cd = c.contratada || {}, ct = c.contratante || {}, cond = c.condicoes || {}, rep = ct.rep || {};
  const f = await novoDocumentoFormal({
    identificacao: `NOTIFICAÇÃO DE COBRANÇA · CONTRATO Nº ${txt(c.numero)}`,
    emissor: { nome: cd.nome, cnpj: cd.cnpj, endereco: txt(cd.endereco).replace(/\n+/g, ' - ') }, logo,
  });
  const { doc, ESQ, DIR, LARGURA, MEIO } = f;
  const TAM = 10.2, EL = 5.1, FONTE = 'times';
  const paragrafo = (texto) => {
    const n = escreverRico(doc, texto, ESQ, f.y, LARGURA, { tam: TAM, entreLinhas: EL, fonte: FONTE, desenhar: false });
    f.garantir(n * EL + 2);
    escreverRico(doc, texto, ESQ, f.y, LARGURA, { tam: TAM, entreLinhas: EL, fonte: FONTE, justificar: true, cor: 24 });
    f.y += n * EL + 1.6;
  };

  f.titulo('NOTIFICAÇÃO DE COBRANÇA', [['Contrato nº', txt(c.numero)], ['Data', dataBR(c.hoje)], ['Total atualizado', `R$ ${reais(c.totais.total)}`]]);

  f.faixa('Notificado(a)');
  f.y += f.campos([
    [{ r: 'Nome / Razão social', v: ct.nome, w: 0.65 }, { r: rotuloDocumento(ct.documento), v: ct.documento, w: 0.35 }],
    rep.nome && rep.nome !== ct.nome
      ? [{ r: 'Endereço', v: txt(ct.endereco).replace(/\n+/g, ' - '), w: 0.6 },
        { r: 'Representante', v: [rep.nome, rep.cpf && `CPF ${rep.cpf}`].filter(Boolean).join(' · '), w: 0.4 }]
      : [{ r: 'Endereço', v: txt(ct.endereco).replace(/\n+/g, ' - ') }],
  ]) + 6;

  paragrafo('Prezado(a) Senhor(a),');
  paragrafo(`Na qualidade de **CONTRATADA** no **CONTRATO DE DESCONTO DE TÍTULO DE CRÉDITO nº ${txt(c.numero)}**`
    + `${c.data_contrato ? `, firmado em ${dataBR(c.data_contrato)}` : ''}, vimos **NOTIFICAR** V.Sa. de que o(s) título(s) de crédito `
    + `abaixo, objeto(s) da operação, não foi(ram) pago(s) no vencimento. Nos termos da **Cláusula 7ª**, a **CONTRATANTE** `
    + `responde pela solvência de cada título e dispõe do prazo de **${cond.prazoReembolso} (${numeroPorExtenso(cond.prazoReembolso)}) dias**, `
    + 'contados do recebimento desta notificação, para efetuar o reembolso.');
  f.y += 2;

  f.faixa('Títulos não pagos', { minimo: 34 });
  f.tabela([{ t: 'Tipo', w: 31 }, { t: 'Título', w: 15 }, { t: 'Vencimento', w: 21, alinhar: 'center' }, { t: 'Dias', w: 10, alinhar: 'right' },
    { t: 'Valor', w: 23, alinhar: 'right' }, { t: 'Juros de mora', w: 24, alinhar: 'right' }, { t: 'Multa', w: 21, alinhar: 'right' },
    { t: 'Total', w: 25, alinhar: 'right' }],
  c.titulos.map(t => [t.tipo, t.numero || '—', dataBR(t.vencimento), t.dias, reais(t.valor), reais(t.juros), reais(t.multa), reais(t.total)]),
  { total: ['Total', '', '', '', reais(c.totais.valor), reais(c.totais.juros), reais(c.totais.multa), reais(c.totais.total)] });
  f.y += 6;

  // a explicacao final vai junto com a data e as assinaturas: nunca sobra so a assinatura numa pagina
  const contato = [cd.telefone && `telefone ${txt(cd.telefone)}`, cd.email && `e-mail ${txt(cd.email)}`].filter(Boolean).join(' ou ');
  const finais = [
    `Os valores acima foram calculados até ${dataBR(c.hoje)}: juros de mora de ${porcento(cond.jurosMora)} ao mês, calculados `
      + '_pro rata die_ e capitalizados mensalmente a partir do vencimento de cada título, e multa contratual de '
      + `${porcento(cond.multa)} sobre o montante devido após a aplicação dos juros de mora (**Cláusula 8ª**).`,
    'Findo o prazo de reembolso sem o pagamento, incidirão ainda atualização monetária pelo INPC-IBGE e juros remuneratórios '
      + 'à taxa contratada e, em caso de cobrança judicial e/ou extrajudicial, custas, emolumentos e honorários advocatícios de '
      + `${porcento(cond.honorarios)} sobre o valor total devido (**Cláusula 8ª, parágrafo único**).`,
    ...(contato ? [`Para a regularização, entre em contato pelo ${contato}.`] : []),
  ];
  const alturaFinais = finais.reduce((t, p) => t + escreverRico(doc, p, ESQ, f.y, LARGURA, { tam: TAM, entreLinhas: EL, fonte: FONTE, desenhar: false }) * EL + 1.6, 0);
  f.garantir(alturaFinais + 34);
  finais.forEach(paragrafo);

  // data, assinatura da contratada e, ao lado, o "recebi" de quem recebeu (comeca a contar o prazo)
  f.garantir(33);
  f.y += 1;
  f.texto(`${txt(c.local) || 'Foz do Iguaçu'}, ${dataPorExtenso(c.hoje)}.`, MEIO, f.y, { tam: TAM, fonte: FONTE, alinhar: 'center' });
  f.y += 17;
  const meia = (LARGURA - 12) / 2, xr = ESQ + meia + 12;
  doc.setDrawColor(24, 28, 38).setLineWidth(0.3).line(ESQ, f.y, ESQ + meia, f.y);
  f.quebrar(txt(cd.nome), meia, 9.4, FONTE, 'bold').slice(0, 2).forEach((l, k) =>
    f.texto(l, ESQ + meia / 2, f.y + 4.2 + k * 3.9, { tam: 9.4, fonte: FONTE, estilo: 'bold', alinhar: 'center' }));
  f.texto('CONTRATADA', ESQ + meia / 2, f.y + 12.6, { tam: 6.8, estilo: 'bold', cor: [21, 47, 92], alinhar: 'center' });
  doc.setDrawColor(192, 201, 214).setLineDashPattern([1.5, 1.5], 0).setLineWidth(0.3).rect(xr, f.y - 13.5, meia, 28.5).setLineDashPattern([], 0);
  f.texto('RECEBI EM ____/____/________', xr + 3, f.y - 9, { tam: 8.4, estilo: 'bold', cor: [21, 47, 92] });
  doc.setDrawColor(24, 28, 38).setLineWidth(0.3).line(xr + 4, f.y + 7, xr + meia - 4, f.y + 7);
  f.texto('Assinatura do notificado (ou de quem recebeu)', xr + meia / 2, f.y + 11, { tam: 7.2, cor: [100, 110, 126], alinhar: 'center' });
  f.y += 18;

  return f.finalizar(`Notificação de cobrança · contrato nº ${txt(c.numero)}`);
}
