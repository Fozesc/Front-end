import api from './api';

export default {
    // Lista de meses com atividade + resumo (para o seletor)
    getMonths() {
        return api.get('/history/months').then(res => res.data);
    },
    // Detalhe de um mês: saldo por banco, crescimento/perda e lançamentos
    getMonthDetail(year, month) {
        return api.get(`/history/month/${year}/${month}`).then(res => res.data);
    }
};
