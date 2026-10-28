import api from './api';

export default {
    // Lista de meses com atividade + resumo (para o seletor)
    getMonths() {
        return api.get('/history/months').then(res => res.data);
    },
    // Detalhe de um mês: saldo por banco, crescimento/perda e lançamentos
    getMonthDetail(year, month, page = 1) {
        return api.get(`/history/month/${year}/${month}`, { params: { page } }).then(res => res.data);
    },
    // Lucro bruto de todos os meses (grafico)
    getLucro() {
        return api.get('/history/lucro').then(res => res.data);
    }
};
