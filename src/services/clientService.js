import api from './api';

export default {
    getAll(params) {
       
        return api.get('/clients', { params }).then(res => res.data);
    },
    
    getById(id) {
        return api.get(`/clients/${id}`).then(res => res.data);
    },

    create(data) {
        return api.post('/clients', data);
    },

    update(id, data) {
        return api.put(`/clients/${id}`, data);
    },

    // junta dois cadastros do mesmo cliente (exige a senha de quem esta logado)
    merge(data) {
        return api.post('/clients/merge', data);
    },

    notas(id, params) {
        return api.get(`/clients/${id}/notas`, { params }).then(res => res.data);
    },

    criarNota(id, texto) {
        return api.post(`/clients/${id}/notas`, { texto }).then(res => res.data);
    },

    editarNota(id, notaId, texto) {
        return api.put(`/clients/${id}/notas/${notaId}`, { texto }).then(res => res.data);
    },

    apagarNota(id, notaId) {
        return api.delete(`/clients/${id}/notas/${notaId}`);
    },
};