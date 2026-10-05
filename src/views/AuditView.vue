<script setup>
import { ref, onMounted, reactive, watch, computed } from 'vue';
import DashboardLayout from '../layouts/DashboardLayout.vue';
import {
  Search, Activity, User, Eye, X,
  ChevronDown, RotateCcw, Filter, ArrowLeft, ArrowRight, Loader2,
  Clock, Target, Hash, FileText, Plus, Pencil, Trash2, LogIn, LogOut,
  ShieldAlert, Merge, BadgeDollarSign
} from 'lucide-vue-next';
import auditService from '../services/auditService';

const logs = ref([]);
const loading = ref(true);
const selectedLog = ref(null);

const totalItems = ref(0);
const totalPages = ref(1);
const currentPage = ref(1);
const itemsPerPage = 20;

// acoes e alvos vem do banco: acao nova (NEGADO, BAIXA, MERGE...) aparece sozinha
const acoesDisponiveis = ref([]);
const alvosDisponiveis = ref([]);

const filtros = reactive({
  busca: '',
  acao: 'TODOS',
  alvo: 'TODOS',
  dataInicio: '',
  dataFim: ''
});

const temFiltro = computed(() =>
  !!filtros.busca || filtros.acao !== 'TODOS' || filtros.alvo !== 'TODOS' ||
  !!filtros.dataInicio || !!filtros.dataFim
);

const intervalo = computed(() => {
  if (!totalItems.value) return '0';
  const de = (currentPage.value - 1) * itemsPerPage + 1;
  const ate = Math.min(currentPage.value * itemsPerPage, totalItems.value);
  return `${de}–${ate} de ${totalItems.value}`;
});

const fetchLogs = async () => {
  loading.value = true;
  try {
    const response = await auditService.getAll({
      page: currentPage.value,
      per_page: itemsPerPage,
      search: filtros.busca,
      action: filtros.acao,
      target: filtros.alvo,
      date_start: filtros.dataInicio,
      date_end: filtros.dataFim
    });
    logs.value = response.items;
    totalItems.value = response.total;
    totalPages.value = response.pages || 1;
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

watch([() => filtros.acao, () => filtros.alvo, () => filtros.dataInicio, () => filtros.dataFim], () => {
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
  filtros.busca = ''; filtros.acao = 'TODOS'; filtros.alvo = 'TODOS';
  filtros.dataInicio = ''; filtros.dataFim = '';
  currentPage.value = 1;
  fetchLogs();
};

const iso = (d) => d.toISOString().split('T')[0];
const periodoRapido = (dias) => {
  const hoje = new Date();
  const inicio = new Date();
  inicio.setDate(hoje.getDate() - dias);
  filtros.dataInicio = iso(dias === 0 ? hoje : inicio);
  filtros.dataFim = iso(hoje);
};

onMounted(async () => {
  fetchLogs();
  try {
    const f = await auditService.getFiltros();
    acoesDisponiveis.value = f.acoes || [];
    alvosDisponiveis.value = f.alvos || [];
  } catch (e) { console.error(e); }
});

// NEGADO = tentativa barrada por senha errada em operação sensível (apagar
// lançamento do caixa, editar cheque, juntar cliente). É o que mais importa
// numa auditoria, então tem cor própria e não some no cinza.
const getActionStyle = (action) => {
  switch (action) {
    case 'CREATE': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'UPDATE': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'DELETE': return 'bg-red-50 text-red-700 border-red-200';
    case 'NEGADO': return 'bg-rose-600 text-white border-rose-600';
    case 'BAIXA': return 'bg-teal-50 text-teal-700 border-teal-200';
    case 'MERGE': return 'bg-violet-50 text-violet-700 border-violet-200';
    case 'LOGIN': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'LOGOUT': return 'bg-slate-100 text-slate-600 border-slate-200';
    default: return 'bg-slate-50 text-slate-700 border-slate-200';
  }
};

const getActionIcon = (action) => {
  switch (action) {
    case 'CREATE': return Plus;
    case 'UPDATE': return Pencil;
    case 'DELETE': return Trash2;
    case 'NEGADO': return ShieldAlert;
    case 'BAIXA': return BadgeDollarSign;
    case 'MERGE': return Merge;
    case 'LOGIN': return LogIn;
    case 'LOGOUT': return LogOut;
    default: return Activity;
  }
};

const getActionLabel = (action) => {
  const map = {
    CREATE: 'Criação', UPDATE: 'Edição', DELETE: 'Exclusão',
    NEGADO: 'Barrado', BAIXA: 'Baixa', MERGE: 'Mesclagem',
    LOGIN: 'Login', LOGOUT: 'Logout'
  };
  return map[action] || action;
};

const formatDate = (iso) => {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('pt-BR');
};

const formatHora = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return { data: d.toLocaleDateString('pt-BR'), hora: d.toLocaleTimeString('pt-BR') };
};
</script>

<template>
  <DashboardLayout>

    <div v-if="selectedLog" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="selectedLog = null"></div>
      <div class="bg-white w-full max-w-2xl rounded-2xl shadow-2xl relative z-10 overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">

        <div class="px-6 py-5 border-b border-slate-200 flex justify-between items-start">
          <div class="flex items-center gap-4">
            <div :class="getActionStyle(selectedLog.action)" class="w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0">
              <component :is="getActionIcon(selectedLog.action)" class="w-6 h-6" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span :class="getActionStyle(selectedLog.action)" class="px-2 py-0.5 rounded-md text-xs font-medium border">
                  {{ getActionLabel(selectedLog.action) }}
                </span>
                <span class="text-slate-400 text-xs tabular-nums flex items-center"><Hash class="w-3 h-3" />{{ selectedLog.id }}</span>
              </div>
              <h3 class="text-lg font-semibold text-slate-900 mt-1">Detalhes do registro</h3>
            </div>
          </div>
          <button @click="selectedLog = null" class="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="p-6 overflow-y-auto space-y-6">
          <p v-if="selectedLog.action === 'NEGADO'" class="flex items-start gap-2 text-sm text-rose-800 bg-rose-50 border border-rose-200 rounded-xl p-4">
            <ShieldAlert class="w-5 h-5 mt-0.5 shrink-0" />
            <span><strong>Tentativa barrada.</strong> Alguém tentou uma operação que exige senha e a senha estava errada. Nada foi alterado.</span>
          </p>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="bg-slate-50/70 border border-slate-200 rounded-xl p-4">
              <div class="flex items-center gap-1.5 text-slate-500 mb-1"><User class="w-3.5 h-3.5" /><span class="text-xs font-medium">Usuário</span></div>
              <div class="font-semibold text-slate-900 text-sm truncate">{{ selectedLog.user }}</div>
            </div>
            <div class="bg-slate-50/70 border border-slate-200 rounded-xl p-4">
              <div class="flex items-center gap-1.5 text-slate-500 mb-1"><Target class="w-3.5 h-3.5" /><span class="text-xs font-medium">Alvo</span></div>
              <div class="font-semibold text-slate-900 text-sm truncate">{{ selectedLog.target }}</div>
            </div>
            <div class="bg-slate-50/70 border border-slate-200 rounded-xl p-4">
              <div class="flex items-center gap-1.5 text-slate-500 mb-1"><Clock class="w-3.5 h-3.5" /><span class="text-xs font-medium">Data / Hora</span></div>
              <div class="font-semibold text-slate-900 text-sm">{{ formatDate(selectedLog.date) }}</div>
            </div>
          </div>

          <div>
            <div class="flex items-center gap-1.5 text-slate-500 mb-2"><FileText class="w-4 h-4" /><span class="text-xs font-medium">Descrição do evento</span></div>
            <div class="bg-slate-900 rounded-xl p-5 font-mono text-xs md:text-sm text-slate-100 whitespace-pre-wrap leading-relaxed shadow-inner">{{ selectedLog.details }}</div>
          </div>
        </div>

        <div class="px-6 py-4 bg-slate-50/70 border-t border-slate-200 flex justify-end">
          <button @click="selectedLog = null" class="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg shadow-xs hover:bg-slate-50 transition-colors">Fechar</button>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-3 mb-7">
      <div>
        <h1 class="text-2xl font-semibold text-slate-900 tracking-tight">Auditoria</h1>
        <div class="flex items-center gap-2 mt-1">
          <p class="text-slate-500 text-sm">Tudo que foi feito no sistema, por quem e quando.</p>
          <span v-if="loading" class="text-xs text-indigo-600 font-medium ml-2 flex items-center"><Loader2 class="w-3 h-3 mr-1 animate-spin" /> Buscando...</span>
          <span v-else class="text-xs bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md font-medium">
            {{ temFiltro ? `${totalItems} encontrados` : `${totalItems} eventos` }}
          </span>
        </div>
      </div>
    </div>

    <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200/80 mb-4">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-sm font-semibold text-slate-900 flex items-center"><Filter class="w-4 h-4 mr-2 text-slate-400" /> Filtros</h3>
        <button @click="resetFilters" :disabled="!temFiltro" class="text-xs text-slate-500 hover:text-indigo-600 disabled:opacity-40 disabled:hover:text-slate-400 flex items-center transition-colors font-medium"><RotateCcw class="w-3.5 h-3.5 mr-1" /> Restaurar</button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
        <div class="md:col-span-4 relative">
          <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Busca</label>
          <div class="relative">
            <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input v-model="filtros.busca" type="text" placeholder="Usuário, detalhe ou alvo..." class="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg outline-none text-sm transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs" />
          </div>
        </div>

        <div class="md:col-span-2">
          <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Ação</label>
          <div class="relative">
            <Activity class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select v-model="filtros.acao" class="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-lg outline-none text-sm appearance-none cursor-pointer focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow">
              <option value="TODOS">Todas</option>
              <option v-for="a in acoesDisponiveis" :key="a" :value="a">{{ getActionLabel(a) }}</option>
            </select>
            <ChevronDown class="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div class="md:col-span-2">
          <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Alvo</label>
          <div class="relative">
            <Target class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select v-model="filtros.alvo" class="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-lg outline-none text-sm appearance-none cursor-pointer focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow">
              <option value="TODOS">Todos</option>
              <option v-for="t in alvosDisponiveis" :key="t" :value="t">{{ t }}</option>
            </select>
            <ChevronDown class="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div class="md:col-span-2">
          <label class="block text-[13px] font-medium text-slate-700 mb-1.5">De</label>
          <input v-model="filtros.dataInicio" type="date" class="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm outline-none text-slate-600 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" />
        </div>

        <div class="md:col-span-2">
          <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Até</label>
          <input v-model="filtros.dataFim" type="date" class="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm outline-none text-slate-600 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" />
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-100">
        <span class="text-xs font-medium text-slate-500 mr-1">Atalhos</span>
        <button @click="periodoRapido(0)" class="h-7 px-3 text-xs font-medium rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors">Hoje</button>
        <button @click="periodoRapido(7)" class="h-7 px-3 text-xs font-medium rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors">7 dias</button>
        <button @click="periodoRapido(30)" class="h-7 px-3 text-xs font-medium rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors">30 dias</button>
        <button @click="filtros.acao = 'NEGADO'" class="h-7 px-3 text-xs font-medium rounded-full bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors flex items-center gap-1">
          <ShieldAlert class="w-3 h-3" /> Tentativas barradas
        </button>
        <button @click="filtros.acao = 'DELETE'" class="h-7 px-3 text-xs font-medium rounded-full bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors flex items-center gap-1">
          <Trash2 class="w-3 h-3" /> Exclusões
        </button>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col min-h-[400px]">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm whitespace-nowrap">
          <thead class="bg-slate-50/80 border-b border-slate-200 text-xs font-medium text-slate-500">
            <tr>
              <th class="px-4 py-2.5">Data</th>
              <th class="px-4 py-2.5">Usuário</th>
              <th class="px-4 py-2.5 text-center">Ação</th>
              <th class="px-4 py-2.5">Alvo</th>
              <th class="px-4 py-2.5">Resumo</th>
              <th class="px-4 py-2.5 text-right">Ver</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="logs.length === 0 && !loading">
              <td colspan="6" class="px-6 py-10 text-center text-slate-400">
                {{ temFiltro ? 'Nenhum registro com esses filtros.' : 'Nenhum registro encontrado.' }}
              </td>
            </tr>
            <tr v-for="log in logs" :key="log.id"
                class="hover:bg-slate-50 cursor-pointer group transition-colors"
                :class="log.action === 'NEGADO' ? 'bg-rose-50/60 hover:bg-rose-50' : ''"
                @click="selectedLog = log">
              <td class="px-4 py-2.5 tabular-nums text-xs text-slate-500">
                <div class="text-slate-800 font-medium text-[13px]">{{ formatHora(log.date).data }}</div>
                <div class="text-slate-400">{{ formatHora(log.date).hora }}</div>
              </td>
              <td class="px-4 py-2.5 font-medium text-slate-800">
                <span class="flex items-center gap-2"><User class="w-3 h-3 text-slate-400" /> {{ log.user }}</span>
              </td>
              <td class="px-4 py-2.5 text-center">
                <span :class="getActionStyle(log.action)" class="px-2 py-0.5 rounded-md text-xs font-medium border inline-flex items-center gap-1">
                  <component :is="getActionIcon(log.action)" class="w-3 h-3" />
                  {{ getActionLabel(log.action) }}
                </span>
              </td>
              <td class="px-4 py-2.5 font-medium text-slate-800">{{ log.target }}</td>
              <td class="px-4 py-2.5 text-slate-500 max-w-xs truncate">{{ log.details }}</td>
              <td class="px-4 py-2.5 text-right">
                <button class="text-slate-400 group-hover:text-indigo-600 p-1.5 rounded-md hover:bg-indigo-50 transition-colors"><Eye class="w-[18px] h-[18px]" /></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="px-5 py-3 border-t border-slate-200 flex justify-between items-center mt-auto">
        <span class="text-[13px] text-slate-500">
          {{ intervalo }} · Página {{ currentPage }} de {{ totalPages }}
        </span>
        <div class="flex gap-2">
          <button @click="mudarPagina(1)" :disabled="currentPage === 1" class="h-8 px-3 bg-white border border-slate-300 rounded-lg shadow-xs text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:shadow-none">Primeira</button>
          <button @click="mudarPagina(currentPage - 1)" :disabled="currentPage === 1" class="h-8 w-8 flex items-center justify-center bg-white border border-slate-300 rounded-lg shadow-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:shadow-none"><ArrowLeft class="w-4 h-4" /></button>
          <button @click="mudarPagina(currentPage + 1)" :disabled="currentPage === totalPages" class="h-8 w-8 flex items-center justify-center bg-white border border-slate-300 rounded-lg shadow-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:shadow-none"><ArrowRight class="w-4 h-4" /></button>
          <button @click="mudarPagina(totalPages)" :disabled="currentPage === totalPages" class="h-8 px-3 bg-white border border-slate-300 rounded-lg shadow-xs text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:shadow-none">Última</button>
        </div>
      </div>
    </div>
  </DashboardLayout>
</template>

<style scoped>
.animate-scale-in { animation: scaleIn 0.2s ease-out; }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
</style>
