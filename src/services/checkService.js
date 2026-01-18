import api from './api';

export default {

  async getAll(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    const response = await api.get(`/checks?${params}`);
    return response.data;
  },

  async updateStatus(id, status) {

    const response = await api.patch(`/checks/${id}/status`, { status });
    return response.data;
  },

  async update(id, checkData) {
    const response = await api.put(`/checks/${id}`, checkData);
    return response.data;
  },

  async delete(id) {
    const response = await api.delete(`/checks/${id}`);
    return response.data;
  }
};