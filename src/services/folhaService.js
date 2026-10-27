import api from './api';

export default {
  listar: () => api.get('/folhas').then(r => r.data),
  criar: (titulo) => api.post('/folhas', { titulo }).then(r => r.data),
  salvar: (id, dados) => api.put(`/folhas/${id}`, dados).then(r => r.data),
  apagar: (id) => api.delete(`/folhas/${id}`),
  refs: () => api.get('/folhas/refs').then(r => r.data),
};
