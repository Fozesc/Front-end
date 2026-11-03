import api from './api';

export default {
  raiz: () => api.get('/guias').then(r => r.data),
  abrir: (id) => api.get(`/guias/${id}`).then(r => r.data),
  buscar: (q) => api.get('/guias/busca', { params: { q } }).then(r => r.data),
  criar: (dados) => api.post('/guias', dados).then(r => r.data),
  salvar: (id, dados) => api.put(`/guias/${id}`, dados).then(r => r.data),
  apagar: (id) => api.delete(`/guias/${id}`),
};
