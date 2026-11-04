import api from './api';

export default {
  // filtro: '' (todos) | 'sim' | 'nao' (assinatura) | 'atraso' (com titulo para a notificacao de cobranca)
  listar: (page = 1, q = '', filtro = '') => api.get('/contratos', {
    params: { page, per_page: 20, ...(q ? { q } : {}), ...(filtro === 'atraso' ? { atraso: 'sim' } : filtro ? { assinado: filtro } : {}) } }).then(r => r.data),
  pendencias: () => api.get('/contratos/pendencias').then(r => r.data),
  abrir: (opId) => api.get(`/contratos/${opId}`).then(r => r.data),
  salvar: (opId, dados) => api.put(`/contratos/${opId}`, { dados }).then(r => r.data),
  marcarAssinado: (opId, assinado, senha) => api.put(`/contratos/${opId}/assinado`, { assinado, senha }).then(r => r.data),
  cobranca: (opId) => api.get(`/contratos/${opId}/cobranca`).then(r => r.data),
};
