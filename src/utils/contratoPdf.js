// Contrato de desconto de titulo de credito em PDF: os mesmos quadros e as mesmas clausulas do modelo da
// empresa (teste-contratos/Contrato 398.pdf), preenchidos com os `dados` da tela de Contratos, no visual
// formal de documentoFormal.js (brasão, régua dupla, faixas e marca d'água).
// O texto das clausulas esta igual ao modelo, inclusive a numeracao: mudar so com o advogado.
import { escreverRico } from './textoRico.js';
import { numeroPorExtenso, percentualPorExtenso, numeroFemininoPorExtenso } from './extenso.js';
import { novoDocumentoFormal, AZUL, CINZA, TEXTO } from './documentoFormal.js';


const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// "Foz do Iguaçu, três de Novembro de dois mil e vinte e seis."
export function dataPorExtenso(iso) {
  const [ano, mes, dia] = String(iso || '').split('-').map(Number);
  if (!ano || !mes || !dia) return '';
  return `${dia === 1 ? 'primeiro' : numeroPorExtenso(dia)} de ${MESES[mes - 1]} de ${numeroPorExtenso(ano)}`;
}

// numeros do modelo; Ajustes > Contratos e cada contrato podem mudar ({{prazo}}, {{mora}}... nas clausulas)
export const CONDICOES_MODELO = { jurosMora: 1, multa: 2, honorarios: 10, prazoReembolso: 30, vias: 2 };
const decimal = (v) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const porcento = (v) => `${decimal(v)}% (${percentualPorExtenso(v)})`;

export function textoClausula(texto, condicoes = {}) {
  const c = { ...CONDICOES_MODELO, ...condicoes };
  return texto.replace('{{prazo}}', `${c.prazoReembolso} (${numeroPorExtenso(c.prazoReembolso)})`)
    .replace('{{mora}}', porcento(c.jurosMora)).replace('{{multa}}', porcento(c.multa))
    .replace('{{honorarios}}', porcento(c.honorarios))
    .replace('{{vias}}', `${String(c.vias).padStart(2, '0')} (${numeroFemininoPorExtenso(c.vias)})`);
}

export const CLAUSULAS = [
  { p: 'Por este instrumento particular, as partes acima qualificadas, justas e acertadas, celebram o presente **CONTRATO DE DESCONTO DE TÍTULO DE CRÉDITO**, que se regerá pelo art. 421 e seguintes, do Código Civil Brasileiro, pela Lei Complementar 167/19 e pelas cláusulas e condições abaixo descritas:' },
  { titulo: 'DO OBJETO' },
  { p: '**CLÁUSULA 1ª.** A **CONTRATADA** realizará antecipação de crédito à **CONTRATANTE**, do valor consubstanciado no título de crédito descrito no Quadro 02, proveniente das vendas ou serviços realizados pela **CONTRATANTE**.' },
  { titulo: 'DA ANTECIPAÇÃO DO CRÉDITO' },
  { p: '**CLÁUSULA 2ª.** Para solicitação de antecipação do crédito, a **CONTRATANTE** deverá apresentar à **CONTRATADA** o Borderô para Desconto de Título, relativo a cada operação de desconto.' },
  { p: '**Parágrafo 1º.** O Borderô poderá contemplar o desconto de títulos endossados à **CONTRATADA** ou cujos dados lhe sejam enviados, pela **CONTRATANTE**, por meio eletrônico.' },
  { p: '**Parágrafo 2º.** Serão objetos de antecipação os títulos de crédito que atendam as formalidades legais, previstas nos artigos 887 e seguintes, do Código Civil Brasileiro, bem como à legislação esparsa aplicável.' },
  { p: '**CLÁUSULA 3ª.** A solicitação de antecipação por meio eletrônico será feita via _e-mail_, cujo endereço é indicado no Quadro 01. Para tanto, a **CONTRATANTE** deverá enviar à **CONTRATADA** o Borderô de cada operação de antecipação, bem como todas as informações relativas a cada título de crédito, se responsabilizando pela legitimidade e legalidade de cada um deles.' },
  { p: '**Parágrafo único.** A **CONTRATANTE** assume o encargo de fiel depositária dos títulos e demais documentos comprobatórios do negócio que lhe deu causa, se obrigando a guarda-los e entrega-los à **CONTRATADA** a qualquer momento, devidamente endossados.' },
  { titulo: 'DOS ENCARGOS FINANCEIROS' },
  { p: '**CLÁUSULA 4ª.** Sobre cada operação de antecipação de crédito, serão deduzidos dos valores liberados os encargos financeiros descritos no Quadro 03, bem como o valor relativo ao Imposto sobre Operações Financeiras (IOF), incidente sobre operações de crédito, de câmbio e seguro e operações relativas a títulos e valores mobiliários.' },
  { p: '**CLÁUSULA 5ª.** Na operação não incidirá qualquer valor relativo a tarifas ou taxas de empréstimo.' },
  { titulo: 'DA FORMA DE PAGAMENTO' },
  { p: '**CLÁUSULA 6ª.** Como forma de efetivo pagamento das quantias antecipadas, bem como dos encargos previsto no Quadro 03, a **CONTRATANTE** cede e transfere à **CONTRATADA**, em caráter irrevogável e irretratável e de modo _pro solvendo_, as importâncias provenientes do resgate dos títulos de crédito objetos de cada operação devida.' },
  { p: '**Parágrafo único.** A cessão de direito descrita no _caput_ se extinguirá conforme previsão dos artigos 127 e 128, do Código Civil Brasileiro, caso o débito, decorrente da antecipação, seja integralmente quitado pela **CONTRATANTE** até a data de seu vencimento.' },
  { p: '**CLÁUSULA 6ª.** Os valores antecipados em cada operação serão liquidados de uma só vez, na forma e datas estabelecidas para a liquidação de cada título de crédito objeto da operação.' },
  { p: '**Parágrafo 1º.** Após a compensação ou pagamento dos títulos, o valor total líquido será utilizado para amortizar o saldo devedor.' },
  { p: '**Parágrafo 2º.** Os títulos não compensados ou não pagos, independemente do motivo, não serão computador para amortização da dívida e permanecerão em poder da **CONTRATADA** até sua liquidação.' },
  { p: '**CLÁUSULA 7ª.** A **CONTRATANTE** se responsabiliza pela solvência de cada título de crédito não pago em seu vencimento, inclusive aqueles cujo vencimento ocorra após o fim da vigência deste Contrato. Para tanto, contará com prazo de reembolso de {{prazo}} dias, contados a partir do recebimento da notificação de cobrança que será enviada pela **CONTRATADA**.' },
  { p: '**Parágrafo único**. A notificação de cobrança mencionada no _caput_ deverá conter todos os dados pertinentes à operação realizada e não paga, incluindo o número do título de crédito antecipado, a data de vencimento e os valores devidamente discriminados, incluindo juros, multas e qualquer outro encargo cobrado.' },
  { p: '**CLÁUSULA 8ª.** Findo o prazo de reembolso, previsto pela cláusula anterior, sem o pagamento, incidirá, em substituição aos encargos do Quadro 03:' },
  { itens: [
    'atualização monetária pelo INPC-IBGE;',
    'juros remuneratórios, à taxa contratada no período de normalidade contratual',
    'juros de mora fixados em {{mora}} ao mês, calculado _pro rata die_ e capitalizados mensalmente, a partir da data de vencimento do título de crédito antecipado;',
    'multa contratual, fixada em {{multa}} sobre o montante devido, após aplicação dos juros de mora.',
  ] },
  { p: '**Parágrafo único.** Em caso de cobrança judicial e/ou extrajudicial serão devidas custas, emolumentos e honorários advocatícios, estes fixados em {{honorarios}} sobre o valor total devido.' },
  { titulo: 'DO VENCIMENTO ANTECIPADO DA DÍVIDA' },
  { p: '**CLÁUSULA 9ª.** Além dos casos previstos em lei, a **CONTRATADA** poderá considerar antecipadamente vencidos os débitos oriundos do presente Contrato, de pleno direito, com exigibilidade da dívida, independentemente de qualquer aviso ou notificação judicial ou extrajudicial, nos seguintes casos:' },
  { itens: [
    'falta de cumprimento de quaisquer obrigações estipuladas neste Contrato;',
    'alterações no quadro societário da **CONTRATADA** sem que seja devidamente informado à **CONTRATANTE**.',
  ] },
  { titulo: 'DA COBRANÇA TERCEIRIZADA' },
  { p: '**CLÁUSULA 10.** Em caso de inadimplemento deste Contrato, a **CONTRATADA** poderá realizar, a seu critério, cobrança por meio de empresa terceirizada, seja no âmbito de telecobrança ou cobrança especializada.' },
  { titulo: 'DAS DISPOSIÇÕES GERAIS' },
  { p: '**CLÁUSULA 11.** A tolerância de uma das partes, quanto ao inadimplemento das obrigações assumidas pela outra, não implica em novação ou modificação das cláusulas aqui ajustadas, constituindo-se mera liberalidade.' },
  { p: '**CLÁUSULA 12.** A **CONTRATANTE**, seus representantes legais e/ou garantidores asseguram a veracidade de todas as informações passadas à **CONTRATADA**, especialmente acerca da licitude da origem da renda e patrimônio, bem como declaram estar cientes das disposições previstas na Lei n° 9.613/98.' },
  { p: '**CLÁUSULA 13.** A **CONTRATANTE** se compromete a informar à **CONTRATADA** sobre eventuais alterações em seus dados cadastrais, sendo de sua responsabilidade todas as consequências decorrentes do descumprimento dessa obrigação. A **CONTRATADA** poderá, sempre que necessário, solicitar a atualização dos dados cadastrais das partes envolvidas neste Contrato, inclusive do(s) garantidor(es).' },
  { p: '**CLÁUSULA 14.** A **CONTRATANTE** autoriza a **CONTRATADA** a:' },
  { itens: [
    'transmitir e consultar informações, inclusive as relativas a esta operação de Empréstimo, à Centrais de Risco de Crédito, podendo utilizá-las para análise de capacidade de crédito;',
    'fornecer tais informações a terceiros contratados para prestar serviços de controle e cobrança, por quaisquer meios, das obrigações assumidas neste Contrato;',
    'levar a registro este Contrato em Entidade Registradora autorizada pelo Banco Central; e',
    'em caso de inadimplência, inserir seu nome e de seus garantidores nos cadastros de proteção ao crédito.',
  ] },
  { p: '**CLÁUSULA 15.** A **CONTRATADA** declara estar sujeita à mecanismos de controle para fins de prevenção contra lavagem de dinheiro e ao dever de comunicação ao Conselho de Controle de Atividades Financeiras (COAF) de operações que possam estar configuradas na Lei nº 9.613/98 (Lei de Lavagem de Dinheiro) e demais leis pertinentes.' },
  { titulo: 'DO FORO DE ELEIÇÃO' },
  { p: '**CLÁUSULA 16.** As partes elegem o foro da sede da **CONTRATADA** para solucionar qualquer controvérsia decorrente deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.' },
  { p: 'E, por estarem assim justas e acertadas, firmam o presente instrumento em {{vias}} vias de igual teor, na presença de duas testemunhas, para que surta seus efeitos legais.' },
];

const txt = (s) => String(s ?? '').trim();
const rotuloDocumento = (numero) => (String(numero || '').replace(/\D/g, '').length === 11 ? 'CPF' : 'CNPJ');
const dataBR = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');

export async function gerarContratoPdf(dados, { logo = null } = {}) {
  const numero = txt(dados.numero);
  const cd = dados.contratada || {}, ct = dados.contratante || {};
  const condicoes = { ...CONDICOES_MODELO, ...(dados.condicoes || {}) };
  const f = await novoDocumentoFormal({
    identificacao: `CONTRATO DE DESCONTO DE TÍTULO DE CRÉDITO · Nº ${numero}`,
    emissor: { nome: cd.nome, cnpj: cd.cnpj, endereco: txt(cd.endereco).replace(/\n+/g, ' - ') }, logo, rubricas: true,
  });
  const { doc, ESQ, DIR, LARGURA, MEIO } = f;

  f.titulo('CONTRATO DE DESCONTO DE TÍTULO DE CRÉDITO', [
    ['Nº do contrato', numero], ['Valor antecipado', `R$ ${txt(dados.valorAntecipado)}`], ['Data', dataBR(dados.data)]]);

  // QUADRO 01 - partes lado a lado, cada uma com o seu representante
  const meia = (LARGURA - 6) / 2;
  const parte = (p, rotDoc) => {
    const rep = p.rep || {};
    return {
      dados: [[{ r: 'Nome / Razão social', v: p.nome }],
        [{ r: rotDoc, v: p.cnpj ?? p.documento, w: 0.5 }, { r: 'Telefone', v: p.telefone, w: 0.5 }],
        [{ r: 'Endereço', v: txt(p.endereco).replace(/\n+/g, ' - ') }], [{ r: 'E-mail', v: p.email }]],
      rep: [[{ r: 'Nome', v: rep.nome }],
        [{ r: 'CPF', v: rep.cpf, w: 0.5 }, { r: 'RG / órgão emissor', v: rep.rg, w: 0.5 }],
        [{ r: 'Nacionalidade', v: rep.nacionalidade, w: 0.5 }, { r: 'Estado civil', v: rep.estadoCivil, w: 0.5 }],
        [{ r: 'Endereço', v: txt(rep.endereco).replace(/\n+/g, ' - ') }]],
    };
  };
  const colunas = [
    { x: ESQ, titulo: 'I · Contratada', tituloRep: 'I.1 · Representante da contratada', ...parte(cd, 'CNPJ') },
    { x: ESQ + meia + 6, titulo: 'II · Contratante', tituloRep: 'II.1 · Representante da contratante', ...parte(ct, rotuloDocumento(ct.documento)) },
  ];
  // os dois blocos de representante comecam na mesma altura, mesmo se um nome quebrar linha
  const alturaDados = Math.max(...colunas.map(c => f.campos(c.dados, { largura: meia, desenhar: false })));
  const alturaRep = Math.max(...colunas.map(c => f.campos(c.rep, { largura: meia, desenhar: false })));
  const alturaQuadro1 = 7.5 + alturaDados + 4 + 7.5 + alturaRep;
  f.faixa('Quadro 01 · Partes', { minimo: alturaQuadro1 + 14 });
  const topo = f.y + 3;
  for (const c of colunas) {
    f.subtitulo(c.titulo, c.x, topo, meia);
    f.campos(c.dados, { x: c.x, largura: meia, y: topo + 7.5 });
    f.subtitulo(c.tituloRep, c.x, topo + 7.5 + alturaDados + 4, meia, { claro: true });
    f.campos(c.rep, { x: c.x, largura: meia, y: topo + 7.5 + alturaDados + 4 + 7.5 });
  }
  f.y = topo + alturaQuadro1 + 7;

  // QUADRO 02 - titulos
  const titulo2 = 'Quadro 02 – Título de crédito objeto da operação';
  f.faixa(titulo2, { minimo: 32 });
  f.tabela([{ t: 'Tipo', w: 28 }, { t: 'Emitente', w: 56 }, { t: 'CPF / CNPJ', w: 36 }, { t: 'Vencimento', w: 22, alinhar: 'center' },
    { t: 'Valor (R$)', w: 28, alinhar: 'right' }],
  (dados.titulos || []).map(t => [txt(t.tipo), txt(t.emitente), txt(t.documento), txt(t.vencimento), txt(t.valor)]),
  { antesDoCabecalho: () => f.faixa(`${titulo2} (continuação)`, { minimo: 20 }) });
  f.y += 7;

  // QUADRO 03 - encargos
  const e = dados.encargos || {};
  const encargos = [
    [{ r: 'Valor antecipado', v: e.valorAntecipado }, { r: 'Taxa de juros', v: e.taxaJuros },
      { r: 'Taxa de juros moratórios', v: dados.condicoes ? `${Number(condicoes.jurosMora).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%` : e.jurosMora },
      { r: 'Valor total IOF', v: e.iofTotal }],
    [{ r: '% IOF adicional', v: e.iofAdicionalPct }, { r: '% IOF saldo devedor diário', v: e.iofDiarioPct }, { r: 'Valor IOF adicional', v: e.iofAdicional }, { r: 'Valor IOF saldo devedor', v: e.iofDiario }],
  ];
  f.faixa('Quadro 03 – Encargos financeiros', { minimo: 34 });
  f.y += f.campos(encargos) + 10;
  // a 1a folha e' a qualificacao (quadros 01 a 03); as clausulas comecam na folha seguinte
  if (doc.internal.getCurrentPageInfo().pageNumber === 1) f.novaPagina();

  // clausulas: Times, justificadas; o titulo de secao nunca fica sozinho no fim da pagina
  const TAM = 10.8, EL = 5.7, FONTE = 'times';
  const linhasDe = (bloco) => (bloco.itens ? bloco.itens : [bloco.p]).reduce((t, p) => t + escreverRico(doc, p, ESQ, f.y,
    bloco.itens ? LARGURA - 7 : LARGURA, { tam: TAM, entreLinhas: EL, fonte: FONTE, desenhar: false }), 0);
  CLAUSULAS.forEach((bloco, i) => {
    if (bloco.titulo) {
      f.garantir(EL * 2 + 6 + Math.min(linhasDe(CLAUSULAS[i + 1]), 3) * EL);
      f.y += 4;
      f.texto(bloco.titulo, MEIO, f.y, { tam: 10, fonte: FONTE, estilo: 'bold', cor: AZUL, alinhar: 'center' });
      const l = doc.getTextWidth(bloco.titulo) / 2 + 4;
      doc.setDrawColor(...AZUL).setLineWidth(0.3).line(ESQ + 18, f.y - 1.2, MEIO - l, f.y - 1.2).line(MEIO + l, f.y - 1.2, DIR - 18, f.y - 1.2);
      f.y += EL + 1.2;
    } else if (bloco.itens) {
      for (const item of bloco.itens) {
        const texto = textoClausula(item, condicoes);
        const n = escreverRico(doc, texto, ESQ + 7, f.y, LARGURA - 7, { tam: TAM, entreLinhas: EL, fonte: FONTE, desenhar: false });
        f.garantir(n * EL);
        f.texto('•', ESQ + 2.5, f.y, { tam: TAM, fonte: FONTE, cor: AZUL });
        escreverRico(doc, texto, ESQ + 7, f.y, LARGURA - 7, { tam: TAM, entreLinhas: EL, fonte: FONTE, justificar: true, cor: 24 });
        f.y += n * EL;
      }
      f.y += 2;
    } else {
      const texto = textoClausula(bloco.p, condicoes);
      const n = escreverRico(doc, texto, ESQ, f.y, LARGURA, { tam: TAM, entreLinhas: EL, fonte: FONTE, desenhar: false });
      f.garantir(n * EL);
      escreverRico(doc, texto, ESQ, f.y, LARGURA, { tam: TAM, entreLinhas: EL, fonte: FONTE, justificar: true, cor: 24 });
      f.y += n * EL + 2.8;
    }
  });

  f.garantir(60);   // a data vai junto com a 1a linha de assinaturas
  f.y += 5;
  f.texto(`${txt(dados.local) || 'Foz do Iguaçu'}, ${dataPorExtenso(dados.data) || '____ de ______________ de ________'}.`,
    MEIO, f.y, { tam: 10.8, fonte: FONTE, alinhar: 'center' });
  f.y += 4;

  // assinaturas
  const meiaAss = (LARGURA - 14) / 2;
  const assinatura = (x, papel, nome, extras) => {
    doc.setDrawColor(...TEXTO).setLineWidth(0.3).line(x, f.y + 14, x + meiaAss, f.y + 14);
    f.quebrar(nome || ' ', meiaAss, 9.8, FONTE, 'bold').slice(0, 2).forEach((l, k) =>
      f.texto(l, x + meiaAss / 2, f.y + 18.3 + k * 4, { tam: 9.8, fonte: FONTE, estilo: 'bold', alinhar: 'center' }));
    const desloc = f.quebrar(nome || ' ', meiaAss, 9.8, FONTE, 'bold').slice(0, 2).length * 4;
    extras.forEach((l, k) => f.texto(l, x + meiaAss / 2, f.y + 18.3 + desloc + k * 3.6, { tam: 7.8, cor: CINZA, alinhar: 'center' }));
    f.texto(papel, x + meiaAss / 2, f.y + 18.3 + desloc + extras.length * 3.6 + 0.6, { tam: 6.8, estilo: 'bold', cor: AZUL, alinhar: 'center' });
  };
  const rep = ct.rep || {};
  const assina = rep.nome ? { nome: rep.nome, cpf: rep.cpf, rg: rep.rg } : { nome: ct.nome, cpf: ct.documento, rg: '' };
  const linhaAss = (esq, dir) => {
    f.garantir(40);
    assinatura(ESQ, ...esq);
    if (dir) assinatura(ESQ + meiaAss + 14, ...dir);
    f.y += 40;
  };
  linhaAss(['CONTRATADA', cd.nome, [cd.cnpj ? `CNPJ ${txt(cd.cnpj)}` : '']],
    ['CONTRATANTE', assina.nome, [`CPF ${txt(assina.cpf) || '______________'}   RG ${txt(assina.rg) || '__________'}`]]);
  linhaAss(['REPRESENTANTE', rep.nome, [`CPF ${txt(rep.cpf) || '______________'}   RG/órgão emissor ${txt(rep.rg) || '__________'}`]]);
  f.garantir(48);
  f.y += f.subtitulo('Testemunhas', ESQ, f.y, LARGURA) + 2;
  const [t1 = {}, t2 = {}] = dados.testemunhas || [];
  const testemunha = (papel, t) => [papel, txt(t.nome) || ' ', [
    ...(txt(t.nome) ? [] : ['Nome: ______________________________']),
    `CPF ${txt(t.cpf) || '______________'}   RG ${txt(t.rg) || '__________'}`]];
  linhaAss(testemunha('TESTEMUNHA 1', t1), testemunha('TESTEMUNHA 2', t2));

  return f.finalizar(`Contrato de desconto de título de crédito nº ${numero}`);
}
