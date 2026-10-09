import api from './api';

export default {
  getAll(params) {

    return api.get('/checks/', { params }).then(res => res.data);
  },
  // nomes de emitente ja usados (os mais frequentes primeiro)
  emitentes(q) {
    return api.get('/checks/emitentes', { params: { q, limit: 10 } }).then(res => res.data);
  },
  getPortfolioTotal() {
    return api.get('/checks/portfolio-total').then(res => res.data);
  },
  updateStatus(id, status, paymentData = null) {
    return api.patch(`/checks/${id}/status`, { status, ...paymentData }).then(res => res.data);
  },
  // titulo com o borderô de origem, os outros titulos dele e o historico (tela de detalhes)
  detalhes(id) {
    return api.get(`/checks/${id}`).then(res => res.data);
  },
  prorrogate(id, payload) {
    return api.post(`/checks/${id}/prorrogate`, payload).then(res => res.data);
  },
  // o que apagar o titulo muda no caixa (nada e' gravado)
  previaExclusao(id) {
    return api.get(`/checks/${id}/exclusao`).then(res => res.data);
  },
  delete(id, senha) {
    return api.delete(`/checks/${id}`, { data: { senha } }).then(res => res.data);
  },
  // Edicao de nome/datas: o backend exige a senha de quem esta logado no corpo.
  update(id, data) {
    return api.put(`/checks/${id}`, data).then(res => res.data);
  }
};