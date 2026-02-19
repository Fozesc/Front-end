import  api  from './api';

export default {
    getAll(params) {
        return api.get('/audit', { params }).then(res => res.data);
    }
};