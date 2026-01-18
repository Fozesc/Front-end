import api from './api';

export default {

  async getAll(filters = {}) {
    
    const params = new URLSearchParams(filters).toString();
    const response = await api.get(`/transactions?${params}`);
    return response.data;
  },


  async create(transactionData) {
    const response = await api.post('/transactions', transactionData);
    return response.data;
  },


  async delete(id) {
    const response = await api.delete(`/transactions/${id}`);
    return response.data;
  },
  
 
  async getSummary() {
    const response = await api.get('/transactions/summary');
    return response.data;
  }
};