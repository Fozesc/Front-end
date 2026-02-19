import api from './api';

export default {
  get() {
    return api.get('/settings').then(r => r.data);
  },
  update(data) {
    return api.put('/settings', data).then(r => r.data);
  }
};