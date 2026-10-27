import api from './api';

export default {
  get() {
    return api.get('/settings').then(r => r.data);
  },
  update(data) {
    return api.put('/settings', data).then(r => r.data);
  },
  getBackup() {
    return api.get('/settings/backup').then(r => r.data);
  },
  updateBackup(data) {
    return api.put('/settings/backup', data).then(r => r.data);
  }
};
