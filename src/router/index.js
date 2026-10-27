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
import HistoricoView from '../views/HistoricoView.vue'
import ValesView from '../views/ValesView.vue'
import RelatorioCaixaView from '../views/RelatorioCaixaView.vue'
import CalendarioView from '../views/CalendarioView.vue'
import FolhasView from '../views/FolhasView.vue'
import RecorrentesView from '../views/RecorrentesView.vue'
import { gerarPendentes } from '../services/recorrenteService'

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
    },
    {
      path: '/historico',
      name: 'historico',
      component: HistoricoView,
      meta: { requiresAuth: true }
    },
    {
      path: '/vales',
      name: 'vales',
      component: ValesView,
      meta: { requiresAuth: true }
    },
    {
      path: '/relatorio-caixa',
      name: 'relatorio-caixa',
      component: RelatorioCaixaView,
      meta: { requiresAuth: true }
    },
    {
      path: '/calendario',
      name: 'calendario',
      component: CalendarioView,
      meta: { requiresAuth: true }
    },
    {
      path: '/calculos',
      name: 'calculos',
      component: FolhasView,
      meta: { requiresAuth: true }
    },
    {
      path: '/recorrentes',
      name: 'recorrentes',
      component: RecorrentesView,
      meta: { requiresAuth: true }
    }
  ]
})

/**
 * GUARDA GLOBAL DE AUTENTICAÇÃO
 */
router.beforeEach(async (to, from, next) => {
  // 1. Buscamos a chave correta: 'user'
  const userSession = localStorage.getItem('user');

  // 2. Se a rota exige auth E não tem usuário logado => Manda pro Login
  if (to.meta.requiresAuth && !userSession) {
    return next({ name: 'login' })
  }

  if (to.name === 'login' && userSession) {
    return next({ name: 'dashboard' })
  }

  // debito automatico das despesas recorrentes ANTES da tela carregar, para o caixa que ela
  // mostra ja vir com o que venceu (no maximo um pedido a cada 10 min; falha nao trava a tela)
  if (to.meta.requiresAuth) await gerarPendentes();


  next()
})

export default router