<script setup>
import api from '../services/api';
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { VERSAO } from '../versao';
import { 
  LayoutDashboard, 
  Banknote, 
  Calculator, 
  Users, 
  DollarSign, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  Wallet,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CalendarClock,
  HandCoins
} from 'lucide-vue-next';

const route = useRoute();
const isMobileSidebarOpen = ref(false);
const isSidebarCollapsed = ref(false);  

const secoes = [
  { titulo: 'Operação', itens: [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Títulos', path: '/cheques', icon: Banknote },
    { name: 'Borderô', path: '/bordero', icon: Calculator },
    { name: 'Clientes', path: '/clientes', icon: Users }
  ] },
  { titulo: 'Financeiro', itens: [
    { name: 'Fluxo de Caixa', path: '/fluxo-caixa', icon: DollarSign },
    { name: 'Vales', path: '/vales', icon: HandCoins },
    { name: 'Histórico Mensal', path: '/historico', icon: CalendarClock }
  ] },
  { titulo: 'Controle', itens: [
    { name: 'Auditoria', path: '/auditoria', icon: ShieldCheck },
    { name: 'Ajustes', path: '/configuracoes', icon: Settings }
  ] }
];
const navigation = secoes.flatMap(s => s.itens);
// /clientes/12 tambem acende "Clientes"
const ativo = (path) => route.path === path || (path !== '/' && route.path.startsWith(path + '/'));

let usuario = {};
try { usuario = JSON.parse(localStorage.getItem('user') || '{}') || {}; } catch { usuario = {}; }
const iniciais = (usuario.name || '?').split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();

const toggleMobileSidebar = () => {
  isMobileSidebarOpen.value = !isMobileSidebarOpen.value;
};

const toggleDesktopSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value;
};

const handleLogout = async () => {
  if(confirm("Deseja realmente sair do sistema?")) {
    try {
     
      await api.post('/auth/logout'); 
    } catch (e) {
      console.error("Erro ao registrar logout", e);
    } finally {
     
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/login';
    }
  }
};
</script>

<template>
  <div class="flex h-screen app-bg overflow-hidden font-sans">

    <aside
      class="hidden md:flex flex-col bg-white transition-[width] duration-200 ease-in-out fixed h-full z-50 border-r border-slate-200/80"
      :class="isSidebarCollapsed ? 'w-[68px]' : 'w-64'"
    >
      <div class="h-16 flex items-center px-4 flex-shrink-0" :class="isSidebarCollapsed ? 'justify-center px-0' : ''">
        <div class="flex items-center gap-3 overflow-hidden">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center flex-shrink-0 shadow-sm ring-1 ring-inset ring-white/15">
            <Wallet class="w-[18px] h-[18px]" />
          </div>
          <div v-show="!isSidebarCollapsed" class="whitespace-nowrap leading-tight">
            <h1 class="text-[15px] font-semibold text-slate-900">Fozesc</h1>
            <p class="text-xs text-slate-500">Gestão de recebíveis</p>
          </div>
        </div>
      </div>

      <nav class="flex-1 overflow-y-auto px-3 pb-3">
        <div v-for="secao in secoes" :key="secao.titulo" class="mt-3 first:mt-1">
          <div v-if="!isSidebarCollapsed" class="px-3 pb-1.5 pt-2 text-[11px] font-medium uppercase tracking-wider text-slate-400">{{ secao.titulo }}</div>
          <div v-else class="mx-2 my-3 border-t border-slate-100"></div>
          <div class="space-y-0.5">
            <router-link
              v-for="item in secao.itens"
              :key="item.name"
              :to="item.path"
              class="flex items-center h-9 px-3 rounded-lg transition-colors group relative"
              :class="ativo(item.path)
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'"
              :title="isSidebarCollapsed ? item.name : ''"
            >
              <component :is="item.icon" class="w-[18px] h-[18px] flex-shrink-0 transition-colors"
                         :class="[isSidebarCollapsed ? 'mx-auto' : 'mr-3', ativo(item.path) ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600']" />
              <span v-show="!isSidebarCollapsed" class="text-sm font-medium whitespace-nowrap">{{ item.name }}</span>
              <div v-if="isSidebarCollapsed" class="absolute left-14 bg-slate-900 text-white text-xs font-medium px-2.5 py-1.5 rounded-md shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap">
                {{ item.name }}
              </div>
            </router-link>
          </div>
        </div>
      </nav>

      <div class="p-3 flex-shrink-0 border-t border-slate-100">
        <div class="flex items-center gap-3 rounded-xl p-2" :class="isSidebarCollapsed ? 'justify-center' : 'bg-slate-50 ring-1 ring-inset ring-slate-200/70'">
          <div class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center justify-center flex-shrink-0" :title="usuario.name">{{ iniciais }}</div>
          <div v-show="!isSidebarCollapsed" class="min-w-0 flex-1 leading-tight">
            <div class="text-[13px] font-semibold text-slate-800 truncate">{{ usuario.name || 'Usuário' }}</div>
            <div class="text-xs text-slate-500 truncate">{{ usuario.role || '' }}</div>
          </div>
          <button v-show="!isSidebarCollapsed" type="button" @click="handleLogout" title="Sair do sistema"
                  class="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-white hover:shadow-xs transition-colors">
            <LogOut class="w-4 h-4" />
          </button>
        </div>
        <button v-if="isSidebarCollapsed" type="button" @click="handleLogout" title="Sair do sistema"
                class="w-full flex justify-center p-2 mt-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
          <LogOut class="w-4 h-4" />
        </button>
        <div class="flex items-center justify-between px-1 pt-2" :class="isSidebarCollapsed ? 'flex-col gap-1' : ''">
          <span class="text-[11px] text-slate-400 tabular-nums select-none" title="Versão do sistema">{{ isSidebarCollapsed ? 'v' + VERSAO : 'Versão ' + VERSAO }}</span>
          <button @click="toggleDesktopSidebar" :title="isSidebarCollapsed ? 'Expandir menu' : 'Recolher menu'"
                  class="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <ChevronRight v-if="isSidebarCollapsed" class="w-4 h-4" />
            <ChevronLeft v-else class="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>

    <div v-if="isMobileSidebarOpen" class="fixed inset-0 z-40 md:hidden">
      <div class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" @click="toggleMobileSidebar"></div>
      <div class="relative flex-1 flex flex-col max-w-xs w-full bg-white h-full shadow-2xl">
        <div class="absolute top-0 right-0 -mr-12 pt-2">
          <button @click="toggleMobileSidebar" class="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white">
            <X class="h-6 w-6 text-white" />
          </button>
        </div>
        <div class="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
          <div class="flex-shrink-0 flex items-center gap-3 px-5 mb-6">
            <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center shadow-sm">
              <Wallet class="w-[18px] h-[18px]" />
            </div>
            <h1 class="text-lg font-semibold text-slate-900">Fozesc</h1>
          </div>
          <nav class="px-3 space-y-0.5">
            <router-link
              v-for="item in navigation"
              :key="item.name"
              :to="item.path"
              @click="toggleMobileSidebar"
              class="group flex items-center px-3 py-2.5 text-[15px] font-medium rounded-lg"
              :class="ativo(item.path) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'"
            >
              <component :is="item.icon" class="mr-3 h-5 w-5" :class="ativo(item.path) ? 'text-indigo-600' : 'text-slate-400'" />
              {{ item.name }}
            </router-link>

            <button
              @click="handleLogout"
              class="w-full group flex items-center px-3 py-2.5 text-[15px] font-medium rounded-lg text-red-600 hover:bg-red-50"
            >
              <LogOut class="mr-3 h-5 w-5" />
              Sair do Sistema
            </button>
          </nav>
          <p class="px-5 mt-6 text-[11px] text-slate-400 tabular-nums">Versão {{ VERSAO }}</p>
        </div>
      </div>
    </div>

    <div
      class="flex-1 flex flex-col h-screen overflow-hidden transition-[padding] duration-200 ease-in-out"
      :class="isSidebarCollapsed ? 'md:pl-[68px]' : 'md:pl-64'"
    >
      <div class="md:hidden absolute top-3 left-3 z-20">
        <button @click="toggleMobileSidebar" aria-label="Abrir menu"
                class="p-2 rounded-lg text-slate-600 hover:text-slate-900 bg-white shadow-sm ring-1 ring-slate-200">
          <Menu class="h-5 w-5" />
        </button>
      </div>

      <main class="flex-1 overflow-y-auto app-bg p-4 md:px-8 md:py-7 pt-14 md:pt-7">
        <div class="max-w-7xl mx-auto pb-20">
          <slot></slot>
        </div>
      </main>
    </div>

  </div>
</template>
