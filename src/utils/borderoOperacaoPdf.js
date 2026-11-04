// "Borderô da operação desconto" (modelo teste-contratos/Borderô 398.pdf): vai junto com o contrato, no mesmo
// visual formal. `dados` = o contrato da tela (partes, titulos, encargos); `operacao` = numeros do servidor
// (GET /contratos/<id>: situacao, cliente desde, operador, prazo medio, taxas e CET).
import { novoDocumentoFormal } from './documentoFormal.js';

const txt = (s) => String(s ?? '').trim();
const dataBR = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');
const num = (v, casas = 2, minimo = casas) => (v === null || v === undefined || v === '' ? '—'
  : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: minimo, maximumFractionDigits: casas }));
const reais = (v) => num(v, 2);

export async function gerarBorderoOperacaoPdf(dados, operacao, { logo = null, dataOperacao = null } = {}) {
  const numero = txt(dados.numero);
  const cd = dados.contratada || {}, ct = dados.contratante || {}, e = dados.encargos || {}, o = operacao || {};
  const f = await novoDocumentoFormal({
    identificacao: `BORDERÔ DA OPERAÇÃO DESCONTO · Nº ${numero}`,
    emissor: { nome: cd.nome, cnpj: cd.cnpj, endereco: txt(cd.endereco).replace(/\n+/g, ' - ') }, logo,
  });

  f.titulo('BORDERÔ DA OPERAÇÃO DESCONTO', [['Operação', numero], ['Data', dataBR(dataOperacao)], ['Situação', o.situacao || '—']]);

  f.faixa('Dados da operação');
  f.y += f.campos([
    [{ r: cd.esc === false ? 'Empresa' : 'Empresa simples de crédito', v: [txt(cd.cnpj), txt(cd.nome)].filter(Boolean).join(' - ') }],
    [{ r: 'Cliente', v: [txt(ct.documento), txt(ct.nome)].filter(Boolean).join(' - '), w: 0.56 },
      { r: 'Cliente desde', v: dataBR(o.cliente_desde), w: 0.2 }, { r: 'Operador', v: o.operador, w: 0.24 }],
  ]) + 6;

  const qtd = (dados.titulos || []).length || o.qtd_titulos || 0;
  f.faixa('Títulos e taxas');
  f.y += f.campos([
    [{ r: 'Quantidade de títulos informados', v: String(qtd) }, { r: 'Valor informado', v: `R$ ${reais(o.valor_total)}` },
      { r: 'Quantidade de títulos apurados', v: String(qtd) }, { r: 'Valor apurado', v: `R$ ${reais(o.valor_total)}` }],
    [{ r: 'Taxa de juros ao mês (%)', v: num(o.taxa_mensal, 4, 2) }, { r: 'Taxa efetiva ao mês (%)', v: num(o.taxa_efetiva_mes, 6) },
      { r: 'Taxa de juros ao mês ajustado (%)', v: '' }, { r: 'Fórmula de cálculo do juros', v: 'Juros compostos' }],
    [{ r: 'Taxa do período (%)', v: `${num(o.taxa_periodo, 6)}%` }, { r: 'Prazo médio dos títulos', v: num(o.prazo_medio, 2) },
      { r: 'Custo efetivo total ao mês (%)', v: num(o.cet_mes, 2) }, { r: 'Custo efetivo total ao ano (%)', v: num(o.cet_ano, 2) }],
  ]) + 6;

  f.faixa('Demonstrativo de valores', { minimo: 44 });
  f.y += 1;
  f.demonstrativo([
    ['a-', 'Valor Total devido da Operação:', reais(o.valor_total), { negrito: true }],
    ['b-', 'Valor liberado ao cliente:', reais(o.liquido), { negrito: true }],
    ['c-', 'Valor das deduções:', reais((o.juros || 0) + (o.iof_total || 0))],
    ['c1-', 'Valor do Juros Remuneratórios:', reais(o.juros), { recuo: 6 }],
    ['c2-', 'Valor do IOF (item d):', reais(o.iof_total), { recuo: 6 }],
  ]);
  f.y += 6;

  f.faixa('Demonstrativo de IOF', { minimo: 32 });
  f.y += 1;
  f.demonstrativo([
    ['d', 'Valor do IOF total:', txt(e.iofTotal) || reais(o.iof_total), { negrito: true }],
    ['d1-', 'Valor do Iof diário', txt(e.iofDiario), { recuo: 6 }],
    ['d2-', 'Valor do Iof adicional', txt(e.iofAdicional), { recuo: 6 }],
  ]);
  f.y += 6;

  const titulo = 'Títulos de crédito da alienação fiduciária';
  f.faixa(titulo, { minimo: 22 });
  const n = (dados.titulos || []).length;
  f.tabela([{ t: 'Tipo', w: 28 }, { t: 'Título', w: 20 }, { t: 'Sacado', w: 74 }, { t: 'Vencimento', w: 24, alinhar: 'center' },
    { t: 'Valor (R$)', w: 24, alinhar: 'right' }],
  (dados.titulos || []).map((t, i) => [txt(t.tipo), txt(t.numero) || `${String(i + 1).padStart(2, '0')}/${String(n).padStart(3, '0')}`,
    [txt(t.documento), txt(t.emitente)].filter(Boolean).join('  '), txt(t.vencimento), txt(t.valor)]),
  { antesDoCabecalho: () => f.faixa(`${titulo} (continuação)`, { minimo: 20 }) });

  return f.finalizar(`Borderô da operação desconto nº ${numero}`);
}
