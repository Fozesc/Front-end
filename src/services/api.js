import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5001/api',
});



api.interceptors.request.use((config) => {
  
  const userJson = localStorage.getItem('user');
  
  if (userJson) {
    const user = JSON.parse(userJson);
    
    
    
    
    if (user && user.token) {
      config.headers.Authorization = `Bearer ${user.token}`;
    }
  }
  
  return config;
}, (error) => {
  return Promise.reject(error);
});



api.interceptors.response.use(response => response, error => {
  if (error.response && error.response.status === 401) {
    localStorage.removeItem('user');
    window.location.href = '/login';
  }
  return Promise.reject(error);
});

export default api;