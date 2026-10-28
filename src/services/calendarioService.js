import api from './api';

export default {
    periodo: async (params) => (await api.get('/calendario', { params })).data,
    avisos: async () => (await api.get('/calendario/avisos')).data,
    criar: async (dados) => (await api.post('/calendario/eventos', dados)).data,
    editar: async (id, dados) => (await api.put(`/calendario/eventos/${id}`, dados)).data,
    apagar: async (id) => api.delete(`/calendario/eventos/${id}`)
};
