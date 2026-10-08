import api from './api';

export default {
    getAll: async (params) => (await api.get('/vales', { params })).data,
    getOne: async (id) => (await api.get(`/vales/${id}`)).data,
    create: async (data) => (await api.post('/vales', data)).data,
    pagar: async (id, data) => (await api.post(`/vales/${id}/pagamentos`, data)).data,
    editar: async (id, data) => (await api.put(`/vales/${id}`, data)).data,
    // apaga o vale e as linhas dele no caixa (saida e pagamentos): exige a senha de quem esta logado
    apagar: async (id, senha) => (await api.delete(`/vales/${id}`, { data: { senha } })).data
};
