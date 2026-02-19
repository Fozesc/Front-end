<script setup>
import api from '../services/api';
import { ref } from 'vue';
import { useRoute } from 'vue-router';
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
  ShieldCheck
} from 'lucide-vue-next';

const route = useRoute();
const isMobileSidebarOpen = ref(false);
const isSidebarCollapsed = ref(false);  

const navigation = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Titulos', path: '/cheques', icon: Banknote },
  { name: 'Borderô', path: '/bordero', icon: Calculator },
  { name: 'Clientes', path: '/clientes', icon: Users },
  { name: 'Fluxo de Caixa', path: '/fluxo-caixa', icon: DollarSign },
  { name: 'Auditoria', path: '/auditoria', icon: ShieldCheck }
];

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
  <div class="flex h-screen bg-slate-50 overflow-hidden">
    
    <aside 
      class="hidden md:flex flex-col bg-slate-900 text-white transition-all duration-300 ease-in-out fixed h-full z-50 border-r border-slate-800"
      :class="isSidebarCollapsed ? 'w-20' : 'w-64'"
    >
      <div class="h-16 flex items-center px-4 border-b border-slate-800 transition-all" :class="isSidebarCollapsed ? 'justify-center' : 'justify-between'">
        <div class="flex items-center gap-3 overflow-hidden">
          <div class="bg-indigo-600 p-2 rounded-lg text-white shadow-lg flex-shrink-0">
            <Wallet class="w-6 h-6" />
          </div>
          
          <div v-show="!isSidebarCollapsed" class="whitespace-nowrap transition-opacity duration-300">
            <h1 class="text-lg font-bold tracking-wide">Fozesc</h1>
            <p class="text-[10px] text-slate-400 uppercase tracking-widest">Management</p>
          </div>
        </div>
      </div>

      <nav class="flex-1 overflow-y-auto py-6 px-3 space-y-1">
        <router-link 
          v-for="item in navigation" 
          :key="item.name" 
          :to="item.path"
          class="flex items-center px-3 py-3 rounded-lg transition-all group relative"
          :class="route.path === item.path 
            ? 'bg-indigo-600 text-white shadow-md' 
            : 'text-slate-400 hover:bg-slate-800 hover:text-white'"
          :title="isSidebarCollapsed ? item.name : ''"
        >
          <component 
            :is="item.icon" 
            class="w-5 h-5 transition-transform group-hover:scale-110 flex-shrink-0" 
            :class="isSidebarCollapsed ? 'mx-auto' : 'mr-3'"
          />
          
          <span v-show="!isSidebarCollapsed" class="font-bold text-sm whitespace-nowrap">
            {{ item.name }}
          </span>

          <div v-if="isSidebarCollapsed" class="absolute left-14 bg-slate-800 text-white text-xs font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap">
            {{ item.name }}
          </div>
        </router-link>
      </nav>

      <div class="p-4 border-t border-slate-800 flex flex-col gap-2">
        <button 
          @click="toggleDesktopSidebar"
          class="w-full flex items-center justify-center p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          <ChevronRight v-if="isSidebarCollapsed" class="w-5 h-5" />
          <ChevronLeft v-else class="w-5 h-5" />
        </button>

        <div class="pt-2 border-t border-slate-800 mt-2">
          <router-link to="/configuracoes" class="flex items-center px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-800 transition-colors mb-1" :class="isSidebarCollapsed ? 'justify-center' : ''">
            <Settings class="w-5 h-5" :class="!isSidebarCollapsed ? 'mr-3' : ''" />
            <span v-show="!isSidebarCollapsed" class="text-sm font-bold">Ajustes</span>
          </router-link>
          
          <button 
            type="button"
            @click="handleLogout" 
            class="w-full flex items-center px-3 py-2 rounded-lg text-red-400 hover:bg-red-900/20 transition-colors cursor-pointer" 
            :class="isSidebarCollapsed ? 'justify-center' : ''"
          >
            <LogOut class="w-5 h-5 flex-shrink-0" :class="!isSidebarCollapsed ? 'mr-3' : ''" />
            <span v-show="!isSidebarCollapsed" class="text-sm font-bold">Sair</span>
          </button>
        </div>
      </div>
    </aside>

    <div v-if="isMobileSidebarOpen" class="fixed inset-0 z-40 md:hidden">
      <div class="fixed inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity" @click="toggleMobileSidebar"></div>
      <div class="relative flex-1 flex flex-col max-w-xs w-full bg-slate-900 h-full shadow-xl">
        <div class="absolute top-0 right-0 -mr-12 pt-2">
          <button @click="toggleMobileSidebar" class="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white">
            <X class="h-6 w-6 text-white" />
          </button>
        </div>
        <div class="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
          <div class="flex-shrink-0 flex items-center px-4 mb-8">
            <Wallet class="w-8 h-8 text-indigo-500 mr-3" />
            <h1 class="text-2xl font-bold text-white">Fozesc</h1>
          </div>
          <nav class="px-2 space-y-1">
            <router-link 
              v-for="item in navigation" 
              :key="item.name" 
              :to="item.path"
              @click="toggleMobileSidebar"
              class="group flex items-center px-2 py-3 text-base font-medium rounded-md text-slate-300 hover:bg-slate-800 hover:text-white"
              :class="route.path === item.path ? 'bg-slate-800 text-white' : ''"
            >
              <component :is="item.icon" class="mr-4 h-6 w-6 text-slate-400 group-hover:text-white" />
              {{ item.name }}
            </router-link>
            
            <button 
              @click="handleLogout"
              class="w-full group flex items-center px-2 py-3 text-base font-medium rounded-md text-red-400 hover:bg-red-900/20"
            >
              <LogOut class="mr-4 h-6 w-6 text-red-400" />
              Sair do Sistema
            </button>
          </nav>
        </div>
      </div>
    </div>

    <div 
      class="flex-1 flex flex-col h-screen overflow-hidden transition-all duration-300 ease-in-out"
      :class="isSidebarCollapsed ? 'md:pl-20' : 'md:pl-64'"
    >
      <div class="md:hidden absolute top-2 left-2 z-10">
        <button @click="toggleMobileSidebar" class="p-2 rounded-md text-slate-500 hover:text-slate-900 bg-white shadow-sm border border-slate-200">
          <Menu class="h-6 w-6" />
        </button>
      </div>

      <main class="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-8">
        <div class="max-w-7xl mx-auto pb-20">
          <slot></slot>
        </div>
      </main>
    </div>

  </div>
</template>