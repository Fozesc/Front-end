import  api  from './api';

export default {
    getAll() {
        return api.get('/operations').then(res => res.data);
    },

   
    getByClient(clientId) {
        
        return api.get(`/operations/client/${clientId}`).then(res => res.data);
    },

    create(data) {
        return api.post('/operations', data).then(res => res.data);
    }
};