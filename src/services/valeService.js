import api from './api';

export default {
    getAll: async (params) => (await api.get('/vales', { params })).data,
    create: async (data) => (await api.post('/vales', data)).data,
    baixar: async (id, data) => (await api.post(`/vales/${id}/baixa`, data)).data
};
