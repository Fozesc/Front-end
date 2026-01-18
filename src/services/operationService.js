import api from './api';

export default {

  async create(operationData) {
 
    const response = await api.post('/operations', operationData);
    return response.data;
  },

  /
  async getAll() {
    const response = await api.get('/operations');
    return response.data;
  }
};