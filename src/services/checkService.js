import api from './api';

export default {
  getAll(params) {

    return api.get('/checks/', { params }).then(res => res.data);
  },
  getPortfolioTotal() {
    return api.get('/checks/portfolio-total').then(res => res.data);
  },
  updateStatus(id, status, paymentData = null) {
    return api.patch(`/checks/${id}/status`, { status, ...paymentData }).then(res => res.data);
  },
  prorrogate(id, payload) {
    return api.post(`/checks/${id}/prorrogate`, payload).then(res => res.data);
  },
  delete(id) {
    return api.delete(`/checks/${id}`).then(res => res.data);
  },
  // Edicao de nome/datas: o backend exige a senha de quem esta logado no corpo.
  update(id, data) {
    return api.put(`/checks/${id}`, data).then(res => res.data);
  },
  // Tira/devolve cheques do calculo em lote. Ou `ids` (marcados na tela), ou
  // `filtros` (todos os que batem com o filtro atual) - nunca os dois.
  definirCalculo(payload) {
    return api.patch('/checks/calculo', payload).then(res => res.data);
  }
};