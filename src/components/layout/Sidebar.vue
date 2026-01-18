<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router'; // <--- IMPORTANTE: Hook para saber a rota atual
import { LayoutDashboard, Wallet, Users, FileText, Calculator, Banknote, LogOut, ChevronLeft, ChevronRight, Moon, DollarSign } from 'lucide-vue-next';

defineProps({ isCollapsed: Boolean });
defineEmits(['toggle']);

const route = useRoute(); // <--- Pegamos a rota atual aqui

const toggleDarkMode = () => {
  console.log("Modo escuro em breve.");
};

onMounted(() => {
  document.documentElement.classList.remove('dark');
  localStorage.removeItem('theme');
});

// Removemos o "active: true" manual daqui, pois o Router vai decidir isso agora
const menuItems = [
  { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { name: 'Cheques', icon: Banknote, path: '/cheques' }, 
  { name: 'Borderô', icon: Calculator, path: '/bordero' }, 
  { name: 'Clientes', icon: Users, path: '/clientes' },
  { name: 'Fluxo de Caixa', icon: DollarSign, path: '/fluxo-caixa' }

  



];
</script>

<template>
  <aside 
    class="fixed left-0 top-0 z-50 h-screen flex flex-col bg-slate-900 text-white shadow-xl transition-all duration-300 border-r border-slate-800"
    :class="isCollapsed ? 'w-20' : 'w-64'"
  >
    <div class="flex h-20 items-center px-6 border-b border-slate-800 overflow-hidden whitespace-nowrap shrink-0">
      <Wallet class="shrink-0 h-8 w-8 text-emerald-500" />
      <div class="ml-3 transition-opacity duration-300" :class="isCollapsed ? 'opacity-0 w-0' : 'opacity-100'">
        <h1 class="text-xl font-bold tracking-wide text-white">CreditoFacil</h1>
        <p class="text-[11px] uppercase tracking-wider text-slate-400">Gestão de Crédito</p>
      </div>
    </div>

    <nav class="flex-1 space-y-1 px-3 py-6 overflow-x-hidden custom-scrollbar overflow-y-auto">
      <router-link 
        v-for="item in menuItems" 
        :key="item.name"
        :to="item.path"
        class="group flex items-center rounded-lg px-3 py-3 transition-all duration-200 relative"
        :class="route.path === item.path 
          ? 'bg-emerald-600 text-white font-bold shadow-md'  // ESTILO ATIVO
          : 'text-slate-400 hover:bg-slate-800 hover:text-white' // ESTILO INATIVO
        "
        :title="isCollapsed ? item.name : ''"
      >
        <component 
          :is="item.icon" 
          class="shrink-0 h-5 w-5 transition-transform group-hover:scale-110"
          :class="route.path === item.path ? 'text-white' : 'text-slate-400 group-hover:text-white'"
        />
        <span class="ml-3 font-medium whitespace-nowrap transition-all duration-300" :class="isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100 block'">{{ item.name }}</span>
      </router-link>
    </nav>

    <div class="border-t border-slate-800 p-4 space-y-2 flex flex-col items-center shrink-0">
      <button 
        @click="toggleDarkMode" 
        class="flex items-center justify-center w-full rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-not-allowed opacity-50"
        title="Em breve"
      >
        <Moon class="h-5 w-5" />
        <span v-if="!isCollapsed" class="ml-3 text-sm">Tema Escuro</span>
      </button>

      <button @click="$emit('toggle')" class="flex items-center justify-center w-full rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
        <ChevronRight v-if="isCollapsed" class="h-5 w-5" />
        <ChevronLeft v-else class="h-5 w-5" />
        <span v-if="!isCollapsed" class="ml-3 text-sm">Recolher</span>
      </button>
      
       <a href="#" class="flex items-center justify-center w-full rounded-lg p-2 text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors">
        <LogOut class="h-5 w-5" />
        <span v-if="!isCollapsed" class="ml-3 text-sm">Sair</span>
      </a>
    </div>
  </aside>
</template>