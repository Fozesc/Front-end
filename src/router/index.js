import { createRouter, createWebHistory } from 'vue-router'
import ChequesView from '../views/ChequesView.vue'
import BorderoView from '../views/BorderoView.vue' 
import ClientesView from '../views/ClientesView.vue'
import ClienteDetalhesView from '../views/ClienteDetalhesView.vue' 
import FluxoCaixaView from '../views/FluxoCaixaView.vue'
import DashboardView from '../views/DashboardView.vue'
import LoginView from '../views/LoginView.vue'
import ConfiguracoesView from '../views/ConfiguracoesView.vue'
import AuditView from '../views/AuditView.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: DashboardView
    },
    {
      path: '/cheques',
      name: 'cheques',
      component: ChequesView
    },
    {
      path: '/bordero', 
      name: 'bordero',
      component: BorderoView
    },
    {
        path: '/clientes',
        name: 'clientes',
        component: ClientesView
    },
    {
      path: '/clientes/:id', // Rota Dinâmica
      name: 'cliente-detalhes',
      component: ClienteDetalhesView
    },
    {
      path: '/fluxo-caixa',
      name: 'fluxo-caixa',
      component: FluxoCaixaView
    },
    {
    path: '/login',
    name: 'login',
    component: LoginView
  },
  {
    path: '/configuracoes',
    name: 'configuracoes',
    component: ConfiguracoesView
  },
  {
  path: '/auditoria',
  name: 'auditoria',
  component: AuditView
  }
    
  ]
})

export default router