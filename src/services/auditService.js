import  api  from './api';

export default {
    getAll(params) {
        return api.get('/audit', { params }).then(res => res.data);
    },
    // acoes e alvos que existem no banco - a tela nao tem lista fixa
    getFiltros() {
        return api.get('/audit/filtros').then(res => res.data);
    }
};