import axios from 'axios';
import { encerrarSessao } from '../utils/sessao';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
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
  // 401 de qualquer pedido que nao seja o proprio login: o login venceu ou o usuario saiu
  if (error.response && error.response.status === 401 && !String(error.config?.url || '').includes('/auth/login')) {
    encerrarSessao('Seu login venceu ou foi encerrado. Entre de novo.');
    window.location.href = '/login';
  }
  return Promise.reject(error);
});

export default api;