import  api  from './api';

export default {
    // Os parametros (page, per_page, sort_by, sort_order) eram recebidos aqui e
    // jogados fora - a chamada ia sem nada e o backend devolvia TODOS os borderos.
    // Agora sao repassados de verdade.
    getAll(params = {}) {
        return api.get('/operations', { params }).then(res => res.data);
    },

   
    getByClient(clientId) {
        
        return api.get(`/operations/client/${clientId}`).then(res => res.data);
    },

    create(data) {
        return api.post('/operations', data).then(res => res.data);
    }
};