import { createRouter, createWebHistory } from 'vue-router'

// Views
import LoginView from '../views/LoginView.vue'
import DashboardView from '../views/DashboardView.vue'
import BorderoView from '../views/BorderoView.vue'
import ClientesView from '../views/ClientesView.vue'
import ClienteDetalhesView from '../views/ClienteDetalhesView.vue'
import ChequesView from '../views/ChequesView.vue'
import FluxoCaixaView from '../views/FluxoCaixaView.vue'
import ConfiguracoesView from '../views/ConfiguracoesView.vue'
import AuditView from '../views/AuditView.vue' 

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView
    },
    {
      path: '/',
      name: 'dashboard',
      component: DashboardView,
      meta: { requiresAuth: true }
    },
    {
      path: '/bordero',
      name: 'bordero',
      component: BorderoView,
      meta: { requiresAuth: true }
    },
    {
      path: '/clientes',
      name: 'clientes',
      component: ClientesView,
      meta: { requiresAuth: true }
    },
    {
      path: '/clientes/:id',
      name: 'cliente-detalhes',
      component: ClienteDetalhesView,
      meta: { requiresAuth: true }
    },
    {
      path: '/cheques',
      name: 'cheques',
      component: ChequesView,
      meta: { requiresAuth: true }
    },
    {
      path: '/fluxo-caixa',
      name: 'fluxo-caixa',
      component: FluxoCaixaView,
      meta: { requiresAuth: true }
    },
    {
      path: '/configuracoes',
      name: 'configuracoes',
      component: ConfiguracoesView,
      meta: { requiresAuth: true }
    },
    {
      path: '/auditoria',
      name: 'auditoria',
      component: AuditView,
      meta: { requiresAuth: true }
    }
  ]
})

/**
 * GUARDA GLOBAL DE AUTENTICAÇÃO
 */
router.beforeEach((to, from, next) => {
  // 1. Buscamos a chave correta: 'user'
  const userSession = localStorage.getItem('user');

  // 2. Se a rota exige auth E não tem usuário logado => Manda pro Login
  if (to.meta.requiresAuth && !userSession) {
    return next({ name: 'login' })
  }

  if (to.name === 'login' && userSession) {
    return next({ name: 'dashboard' })
  }


  next()
})

export default router