<script setup>
import { ref, onMounted, reactive, watch } from 'vue';
import DashboardLayout from '../layouts/DashboardLayout.vue';
import { 
  ShieldCheck, Search, Activity, User, Eye, X, 
  ChevronDown, RotateCcw, Filter, ArrowLeft, ArrowRight, Loader2
} from 'lucide-vue-next';
import auditService from '../services/auditService';

const logs = ref([]);
const loading = ref(true);
const selectedLog = ref(null);


const totalItems = ref(0);
const totalPages = ref(1);
const currentPage = ref(1);
const itemsPerPage = 20;

const filtros = reactive({
  busca: '',
  acao: 'TODOS',
  dataInicio: '',
  dataFim: ''
});


const fetchLogs = async () => {
  loading.value = true;
  try {
    const params = {
      page: currentPage.value,
      per_page: itemsPerPage,
      search: filtros.busca,
      action: filtros.acao,
      date_start: filtros.dataInicio,
      date_end: filtros.dataFim
    };

    const response = await auditService.getAll(params);
    
    logs.value = response.items;
    totalItems.value = response.total;
    totalPages.value = response.pages;

  } catch (error) {
    console.error("Erro logs:", error);
  } finally {
    loading.value = false;
  }
};


let timeoutSearch = null;
watch(() => filtros.busca, () => {
  clearTimeout(timeoutSearch);
  timeoutSearch = setTimeout(() => { currentPage.value = 1; fetchLogs(); }, 400);
});

watch([() => filtros.acao, () => filtros.dataInicio, () => filtros.dataFim], () => {
  currentPage.value = 1;
  fetchLogs();
});

const mudarPagina = (p) => {
  if (p >= 1 && p <= totalPages.value) {
    currentPage.value = p;
    fetchLogs();
  }
};

const resetFilters = () => {
  filtros.busca = ''; filtros.acao = 'TODOS';
  filtros.dataInicio = ''; filtros.dataFim = '';
  currentPage.value = 1;
  fetchLogs();
};

onMounted(fetchLogs);


const getActionStyle = (action) => {
  switch(action) {
    case 'CREATE': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'UPDATE': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'DELETE': return 'bg-red-100 text-red-700 border-red-200';
    case 'LOGIN': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    default: return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

const formatDate = (iso) => {
  if(!iso) return '-';
  return new Date(iso).toLocaleString('pt-BR');
};
</script>

<template>
  <DashboardLayout>
    
    <div v-if="selectedLog" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="selectedLog = null"></div>
      <div class="bg-white w-full max-w-2xl rounded-2xl shadow-2xl relative z-10 overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">
        <div class="bg-slate-50 p-6 border-b border-slate-100 flex justify-between items-start">
          <div>
            <span :class="getActionStyle(selectedLog.action)" class="px-2 py-1 rounded text-xs font-bold border uppercase tracking-wide mb-2 inline-block">
              {{ selectedLog.action }}
            </span>
            <h3 class="text-xl font-bold text-slate-800 flex items-center gap-2">
              Detalhes da Auditoria <span class="text-slate-400 text-sm font-normal">#{{ selectedLog.id }}</span>
            </h3>
            <p class="text-sm text-slate-500 mt-1">Realizado por <b>{{ selectedLog.user }}</b> em {{ formatDate(selectedLog.date) }}</p>
          </div>
          <button @click="selectedLog = null" class="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
            <X class="w-6 h-6" />
          </button>
        </div>
        <div class="p-8 overflow-y-auto">
          <div class="bg-slate-50 border border-slate-200 rounded-xl p-6 font-mono text-xs md:text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
            {{ selectedLog.details }}
          </div>
        </div>
        <div class="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button @click="selectedLog = null" class="px-6 py-2 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900">Fechar</button>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-3 mb-8">
      <div class="bg-slate-800 p-2 rounded-lg text-white shadow-lg"><ShieldCheck class="w-6 h-6" /></div>
      <div>
        <h1 class="text-3xl font-bold text-slate-900">Auditoria</h1>
        <div class="flex items-center gap-2 mt-1">
          <p class="text-slate-500 text-sm">Registro de segurança.</p>
          <span v-if="loading" class="text-xs text-indigo-500 font-bold ml-2 flex items-center"><Loader2 class="w-3 h-3 mr-1 animate-spin" /> Buscando...</span>
          <span v-else class="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">Total: {{ totalItems }} eventos</span>
        </div>
      </div>
    </div>

    <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 mb-6">
      <div class="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
        <h3 class="text-xs font-bold text-emerald-600 uppercase tracking-widest flex items-center"><Filter class="w-3 h-3 mr-1.5" /> Filtragem</h3>
        <button @click="resetFilters" class="text-xs text-slate-400 hover:text-emerald-600 flex items-center transition-colors font-medium"><RotateCcw class="w-3.5 h-3.5 mr-1" /> Restaurar</button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
        <div class="md:col-span-4 relative">
          <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Busca Textual</label>
          <div class="relative">
            <Search class="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input v-model="filtros.busca" type="text" placeholder="Usuário, detalhe ou alvo..." class="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all" />
          </div>
        </div>
        
        <div class="md:col-span-2">
          <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Ação</label>
          <div class="relative">
            <Activity class="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <select v-model="filtros.acao" class="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm appearance-none cursor-pointer">
              <option value="TODOS">Todas</option>
              <option value="LOGIN">Login</option>
              <option value="CREATE">Criação</option>
              <option value="UPDATE">Edição</option>
              <option value="DELETE">Exclusão</option>
            </select>
            <ChevronDown class="w-4 h-4 absolute right-3 top-2.5 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div class="md:col-span-3">
          <label class="block text-xs font-bold text-slate-500 uppercase mb-1">De</label>
          <input v-model="filtros.dataInicio" type="date" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600" />
        </div>

        <div class="md:col-span-3">
          <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Até</label>
          <input v-model="filtros.dataFim" type="date" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600" />
        </div>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[400px]">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm whitespace-nowrap">
          <thead class="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
            <tr>
              <th class="px-6 py-3">Data</th>
              <th class="px-6 py-3">Usuário</th>
              <th class="px-6 py-3 text-center">Ação</th>
              <th class="px-6 py-3">Alvo</th>
              <th class="px-6 py-3">Resumo</th>
              <th class="px-6 py-3 text-right">Ver</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="logs.length === 0 && !loading">
              <td colspan="6" class="px-6 py-10 text-center text-slate-400">Nenhum registro encontrado.</td>
            </tr>
            <tr v-for="log in logs" :key="log.id" class="hover:bg-slate-50 cursor-pointer group transition-colors" @click="selectedLog = log">
              <td class="px-6 py-4 font-mono text-xs text-slate-500">{{ formatDate(log.date) }}</td>
              <td class="px-6 py-4 font-bold text-slate-700 flex items-center gap-2"><User class="w-3 h-3 text-slate-400" /> {{ log.user }}</td>
              <td class="px-6 py-4 text-center">
                <span :class="getActionStyle(log.action)" class="px-2 py-1 rounded text-[10px] font-bold border uppercase tracking-wide">{{ log.action }}</span>
              </td>
              <td class="px-6 py-4 font-medium text-slate-800">{{ log.target }}</td>
              <td class="px-6 py-4 text-slate-500 max-w-xs truncate">{{ log.details }}</td>
              <td class="px-6 py-4 text-right">
                <button class="text-indigo-600 hover:text-indigo-800 p-2 rounded-full hover:bg-indigo-50 transition-colors"><Eye class="w-5 h-5" /></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center mt-auto">
        <span class="text-xs text-slate-500 font-bold">Página {{ currentPage }} de {{ totalPages }}</span>
        <div class="flex gap-2">
          <button @click="mudarPagina(currentPage - 1)" :disabled="currentPage === 1" class="px-3 py-1 bg-white border border-slate-300 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-50"><ArrowLeft class="w-4 h-4" /></button>
          <button @click="mudarPagina(currentPage + 1)" :disabled="currentPage === totalPages" class="px-3 py-1 bg-white border border-slate-300 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-50"><ArrowRight class="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  </DashboardLayout>
</template>

<style scoped>
.animate-scale-in { animation: scaleIn 0.2s ease-out; }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
</style>