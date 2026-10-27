import api from './api';
import { avisar } from '../utils/avisos';

export default {
  listar: () => api.get('/recorrentes').then(r => r.data),
  criar: (dados) => api.post('/recorrentes', dados).then(r => r.data),
  editar: (id, dados) => api.put(`/recorrentes/${id}`, dados).then(r => r.data),
  apagar: (id) => api.delete(`/recorrentes/${id}`),
  gerar: () => api.post('/recorrentes/gerar').then(r => r.data.lancados),
  lancar: (id, dados) => api.post(`/recorrentes/${id}/lancar`, dados).then(r => r.data),
  adiar: (id, ate) => api.post(`/recorrentes/${id}/adiar`, { ate }).then(r => r.data),
};

// Debito automatico: o layout chama ao abrir cada tela, mas so vai ao servidor a cada 10 min
// (o servidor nao lanca duas vezes de qualquer jeito: ele trava e avanca a data).
let ultimaVez = 0;
export async function gerarPendentes() {
  if (Date.now() - ultimaVez < 10 * 60 * 1000) return;
  ultimaVez = Date.now();
  try {
    const { lancados } = (await api.post('/recorrentes/gerar')).data;
    if (lancados.length) {
      const nomes = lancados.map(l => l.descricao.replace(/ \(débito automático\)$/, ''));
      avisar(`Débito automático: ${[...new Set(nomes)].join(', ')} lançado(s) no caixa.`, 'info');
    }
  } catch (e) {
    console.error('Débito automático', e);
  }
}
