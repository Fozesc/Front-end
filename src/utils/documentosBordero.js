// Baixar o borderô e as promissorias de um borderô ja gravado: usado logo depois de efetivar, na ficha
// do cliente e no detalhe do titulo. Os dados vem do servidor, entao saem iguais em qualquer tela.
import operationService from '../services/operationService';
import { gerarBorderoPdf } from './borderoPdf';
import { baixarPromissorias } from './promissoriasPdf';

export const temPromissorias = (titulos = []) => titulos.some(t => (t.tipo || t.type) === 'PROMISSORIA');

export async function baixarBorderoPdf(id) {
  const d = await operationService.documento(id);
  (await gerarBorderoPdf(d)).save(`bordero-${id}.pdf`);
}

export async function baixarPromissoriasDoBordero(id) {
  const d = await operationService.documento(id);
  const proms = d.titulos.filter(t => t.tipo === 'PROMISSORIA');
  if (!proms.length) throw new Error('Este borderô não tem promissórias.');
  await baixarPromissorias({
    credor: d.empresa, emitente: d.cliente, avalista: d.avalista, operacaoId: d.id, dataEmissao: d.data,
    parcelas: proms.map((t, i) => ({ numero: t.numero || `${i + 1}/${proms.length}`, valor: t.valor, vencimento: t.vencimento })),
  });
}
