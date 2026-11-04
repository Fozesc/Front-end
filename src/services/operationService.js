import  api  from './api';

export default {
    // Os parametros (page, per_page, sort_by, sort_order) eram recebidos aqui e
    // jogados fora - a chamada ia sem nada e o backend devolvia TODOS os borderos.
    // Agora sao repassados de verdade.
    getAll(params = {}) {
        return api.get('/operations', { params }).then(res => res.data);
    },

   
    // borderôs do cliente em paginas: { items, total, pages, page }
    getByClient(clientId, page = 1, per_page = 10) {
        
        return api.get(`/operations/client/${clientId}`, { params: { page, per_page } }).then(res => res.data);
    },

    create(data) {
        return api.post('/operations', data).then(res => res.data);
    },

    // corrige a empresa do borderô (Fozesc ou PQ); os titulos dele vao junto
    mudarEmpresa(id, empresa) {
        return api.put(`/operations/${id}/empresa`, { empresa }).then(res => res.data);
    },

    // o que apagar o borderô inteiro muda no caixa (nada e' gravado)
    previaExclusao(id) {
        return api.get(`/operations/${id}/exclusao`).then(res => res.data);
    },

    // apaga o borderô e todos os titulos dele, desfazendo no caixa; exige a senha
    apagar(id, senha) {
        return api.delete(`/operations/${id}`, { data: { senha } }).then(res => res.data);
    },

    // o borderô como ficou gravado, para o PDF do borderô e das promissorias
    documento(id) {
        return api.get(`/operations/${id}/documento`).then(res => res.data);
    }
};