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
};