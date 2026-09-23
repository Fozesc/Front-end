import api from './api';

export default {
    
    getAll: async (params) => {
        const response = await api.get('/transactions', { params });
        return response.data;
    },

    getBalances: async () => {
        const response = await api.get('/transactions/balances');
        return response.data;
    },

    create: async (data) => {
        const response = await api.post('/transactions', data);
        return response.data;
    },

    update: async (id, data) => {
        const response = await api.put(`/transactions/${id}`, data);
        return response.data;
    },

    // apagar lancamento muda o saldo na hora e nao tem desfazer: o backend exige
    // a senha de quem esta logado (mesmo 2o fator da edicao de cheque)
    delete: async (id, senha) => {
        const response = await api.delete(`/transactions/${id}`, { data: { senha } });
        return response.data;
    },
    saveInitialBalances: async (data) => {
        const response = await api.put('/transactions/initial-balances', data);
        return response.data;
    }
};