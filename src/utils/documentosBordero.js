// Documentos de um borderô ja gravado, para o VisualizadorDocumentos: borderô e promissorias sempre (se tiver),
// contrato e borderô da operação quando o borderô e' da Fozesc (ou ja tem contrato). Os dados vem do servidor,
// entao saem iguais logo depois de efetivar, na ficha do cliente e no detalhe do titulo.
import operationService from '../services/operationService';
import contratoService from '../services/contratoService';
import { gerarBorderoPdf } from './borderoPdf';
import { gerarPromissorias } from './promissoriasPdf';
import { gerarContratoPdf } from './contratoPdf';
import { gerarBorderoOperacaoPdf } from './borderoOperacaoPdf';
import { gerarNotificacaoCobrancaPdf } from './notificacaoCobrancaPdf';
import { logoDoSite } from './documentoFormal';

export const temPromissorias = (titulos = []) => titulos.some(t => (t.tipo || t.type) === 'PROMISSORIA');

const logo = async () => { try { return await logoDoSite(); } catch { return null; } };

// contrato e borderô da operação; `carregar` devolve { dados, operacao, bordero } (GET /contratos/<id>)
export function documentosDoContrato(carregar, numero) {
  return [
    { chave: 'contrato', nome: 'Contrato', arquivo: `contrato-${numero}.pdf`,
      gerar: async () => gerarContratoPdf((await carregar()).dados, { logo: await logo() }) },
    { chave: 'bordero-operacao', nome: 'Borderô da operação', arquivo: `bordero-operacao-${numero}.pdf`,
      gerar: async () => {
        const c = await carregar();
        return gerarBorderoOperacaoPdf(c.dados, c.operacao, { logo: await logo(), dataOperacao: c.bordero.data });
      } },
  ];
}

// notificacao de cobranca (titulos vencidos sem pagar do contrato, com juros de mora e multa ate hoje)
export const documentoCobranca = (id) => ({
  chave: 'cobranca', nome: 'Notificação de cobrança', arquivo: `notificacao-cobranca-${id}.pdf`,
  gerar: async () => gerarNotificacaoCobrancaPdf(await contratoService.cobranca(id), { logo: await logo() }),
});

export async function documentosDoBordero(id) {
  const d = await operationService.documento(id);
  const lista = [{ chave: 'bordero', nome: 'Borderô', arquivo: `bordero-${id}.pdf`, gerar: () => gerarBorderoPdf(d) }];
  const proms = d.titulos.filter(t => t.tipo === 'PROMISSORIA');
  if (proms.length) {
    lista.push({ chave: 'promissorias', nome: `Promissórias (${proms.length})`, arquivo: `promissorias-bordero-${id}.pdf`,
      gerar: () => gerarPromissorias({
        credor: d.empresa, emitente: d.cliente, avalista: d.avalista, operacaoId: d.id, dataEmissao: d.data,
        parcelas: proms.map((t, i) => ({ numero: t.numero || `${i + 1}/${proms.length}`, valor: t.valor, vencimento: t.vencimento })),
      }) });
  }
  if (d.empresa.chave === 'Fozesc' || d.tem_contrato) {
    let contrato = null;
    lista.push(...documentosDoContrato(() => (contrato ||= contratoService.abrir(id)), id));
  }
  return lista;
}
