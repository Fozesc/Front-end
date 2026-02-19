<script setup>
import { ref, reactive, onMounted, watch, nextTick } from 'vue'; 
import { useRouter } from 'vue-router';
import DashboardLayout from '../layouts/DashboardLayout.vue';
import ChequeForm from '../components/layout/finance/ChequeForm.vue'; 
import ChequeDetalhesModal from '../components/layout/finance/ChequeDetalhesModal.vue';

import ProrrogacaoModal from '../components/layout/finance/ProrrogacaoModal.vue'; 

import { 
  Search, Plus, Trash2, ChevronDown, 
  ArrowLeft, ArrowRight, Loader2, Calculator,
  ArrowUpDown, ArrowUp, ArrowDown, Filter, CheckSquare, Square,
  Edit, Download, CalendarClock
} from 'lucide-vue-next';

import checkService from '../services/checkService';

const router = useRouter();
const showModal = ref(false);
const showDetailsModal = ref(false);
const selectedCheque = ref(null);
const loading = ref(false);
const isPrinting = ref(false); 


const showProrrogacaoModal = ref(false);
const chequeParaProrrogar = ref(null);

const chequeParaEditar = ref(null);

const openStatusMenuId = ref(null);
const menuPosition = reactive({ top: 0, left: 0 });
const menuCheque = ref(null);
const showStatusFilter = ref(false);

const dados = ref([]); 
const totalItems = ref(0);
const totalPages = ref(1);
const currentPage = ref(1);
const itemsPerPage = 40; 

const filters = reactive({
  search: '',
  status: [], 
  date_start: new Date().toISOString().split('T')[0], 
  date_end: '',
  sort_by: 'due_date',
  sort_order: 'asc'
});

const statusOptions = ['Aguardando', 'Pago', 'Atrasado', 'Devolvido', 'Juridico'];

const carregarDados = async () => {
  loading.value = true;
  try {
    const params = {
      page: currentPage.value,
      per_page: itemsPerPage,
      search: filters.search,
      status: filters.status.length > 0 ? filters.status.join(',') : '', 
      date_start: filters.date_start,
      date_end: filters.date_end,
      sort_by: filters.sort_by,
      sort_order: filters.sort_order
    };

    const response = await checkService.getAll(params);
    dados.value = response.items;
    totalItems.value = response.total;
    totalPages.value = response.pages;
  } catch (error) {
    console.error("Erro ao carregar:", error);
  } finally {
    loading.value = false;
  }
};

const ordenar = (coluna) => {
  if (filters.sort_by === coluna) {
    filters.sort_order = filters.sort_order === 'asc' ? 'desc' : 'asc';
  } else {
    filters.sort_by = coluna;
    filters.sort_order = 'asc';
  }
  carregarDados();
};

const toggleStatusFilter = (status) => {
  if (filters.status.includes(status)) {
    filters.status = filters.status.filter(s => s !== status);
  } else {
    filters.status.push(status);
  }
};
const isStatusSelected = (status) => filters.status.includes(status);
const toggleAllStatus = () => {
  if (filters.status.length === statusOptions.length) {
    filters.status = [];
  } else {
    filters.status = [...statusOptions];
  }
};

let timeoutSearch = null;
watch(() => filters.search, () => {
  clearTimeout(timeoutSearch);
  timeoutSearch = setTimeout(() => {
    currentPage.value = 1;
    carregarDados();
  }, 400); 
});

watch([() => filters.status, () => filters.date_start, () => filters.date_end], () => {
  currentPage.value = 1;
  carregarDados();
}, { deep: true });

const mudarPagina = (novaPagina) => {
  if (novaPagina >= 1 && novaPagina <= totalPages.value) {
    currentPage.value = novaPagina;
    carregarDados();
  }
};

const closeGlobalMenus = () => {
  openStatusMenuId.value = null;
  menuCheque.value = null;
  showStatusFilter.value = false;
};

onMounted(() => {
  carregarDados();
  document.addEventListener('click', closeGlobalMenus);
  document.addEventListener('scroll', closeGlobalMenus, true);
});

const abrirNovo = () => {
  chequeParaEditar.value = null;
  showModal.value = true;
};


const abrirProrrogacao = (cheque) => {
  chequeParaProrrogar.value = cheque;
  showProrrogacaoModal.value = true;
};

const abrirEdicao = (cheque) => {
  chequeParaEditar.value = { ...cheque }; 
  showModal.value = true;
};

const alterarStatus = async (cheque, novoStatus) => {
  if (novoStatus === 'Pago' && !confirm(`Confirmar recebimento do cheque R$ ${cheque.valor_liquido}?`)) return;
  try {
    await checkService.updateStatus(cheque.id, novoStatus);
    cheque.status = novoStatus; 
    closeGlobalMenus();
  } catch (error) { alert("Erro ao atualizar."); }
};

const deletarCheque = async (id) => {
  if(!confirm("Excluir cheque permanentemente?")) return;
  try {
    await checkService.delete(id);
    carregarDados();
  } catch (error) { alert("Erro ao excluir."); }
};

const abrirDetalhes = (cheque) => { selectedCheque.value = cheque; showDetailsModal.value = true; };
const formatCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const formatDate = (d) => d ? d.split('-').reverse().join('/') : '-';
const getStatusColor = (s) => {
    if(s === 'Pago') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if(s === 'Atrasado') return 'bg-red-100 text-red-700 border-red-200';
    if(s === 'Devolvido') return 'bg-orange-100 text-orange-700 border-orange-200';
    if(s === 'Juridico') return 'bg-purple-100 text-purple-700 border-purple-200';
    if(s === 'Prorrogado') return 'bg-indigo-100 text-indigo-700 border-indigo-200'; 
    return 'bg-blue-50 text-blue-700 border-blue-200';
};

const toggleStatusMenu = (cheque, event) => { 
  event.stopPropagation(); 
  if (openStatusMenuId.value === cheque.id) {
    closeGlobalMenus();
    return;
  }
  const rect = event.currentTarget.getBoundingClientRect();
  menuPosition.top = rect.bottom + 5;
  menuPosition.left = rect.left + (rect.width / 2);
  menuCheque.value = cheque;
  openStatusMenuId.value = cheque.id;
};

const resetFilters = () => {
    filters.search = '';
    filters.status = [];
    filters.date_start = '';
    filters.date_end = '';
    filters.sort_by = 'due_date';
    filters.sort_order = 'asc';
    currentPage.value = 1;
    carregarDados();
};

const exportarTela = () => {
  isPrinting.value = true;
  nextTick(() => {
    window.print();
    isPrinting.value = false;
  });
};
</script>

<template>
  <DashboardLayout>
    <ChequeDetalhesModal v-if="showDetailsModal" :cheque="selectedCheque" :isOpen="showDetailsModal" @close="showDetailsModal = false" />
    <ChequeForm v-if="showModal" :cheque="chequeParaEditar" @close="showModal = false" @save="() => { showModal = false; carregarDados(); }" />
    
    <ProrrogacaoModal 
      v-if="showProrrogacaoModal" 
      :cheque="chequeParaProrrogar" 
      :isOpen="showProrrogacaoModal" 
      @close="showProrrogacaoModal = false" 
      @save="() => { showProrrogacaoModal = false; carregarDados(); }" 
    />

    <div class="print:hidden">
      <div class="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 class="text-3xl font-bold text-slate-900 tracking-tight">Gerenciamento de Cheques</h1>
          <div class="flex items-center gap-2 mt-1">
            <span class="text-slate-500 text-sm">
              Total Encontrado: <strong>{{ totalItems }}</strong> registros
            </span>
            <span v-if="loading" class="text-xs text-indigo-500 font-bold ml-2 flex items-center">
              <Loader2 class="w-3 h-3 mr-1 animate-spin" /> Buscando...
            </span>
          </div>
        </div>
        <div class="flex gap-3">
          <button @click="exportarTela" class="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg font-bold shadow-sm flex items-center text-sm">
            <Download class="w-4 h-4 mr-2" /> Exportar
          </button>
          
          <button @click="router.push('/bordero')" class="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center">
            <Calculator class="w-4 h-4 mr-2"/> Novo Borderô
          </button>
          <button @click="abrirNovo" class="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center">
            <Plus class="w-4 h-4 mr-2"/> Novo Cheque
          </button>
        </div>
      </div>

      <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
        <div class="md:col-span-4 relative">
          <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Busca Rápida</label>
          <Search class="w-4 h-4 absolute left-3 top-8 text-slate-400" />
          <input v-model="filters.search" type="text" placeholder="Nome, Banco, Doc ou #Op..." class="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>

        <div class="md:col-span-2">
          <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Vencimento De</label>
          <input v-model="filters.date_start" type="date" class="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs" />
        </div>
        <div class="md:col-span-2">
          <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Vencimento Até</label>
          <input v-model="filters.date_end" type="date" class="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs" />
        </div>

        <div class="md:col-span-3 relative">
          <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
          <button @click.stop="showStatusFilter = !showStatusFilter" 
                  class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm flex justify-between items-center hover:bg-slate-100">
            <span class="truncate">
              {{ filters.status.length === 0 ? 'Todos os Status' : filters.status.length + ' selecionados' }}
            </span>
            <Filter class="w-4 h-4 text-slate-400" />
          </button>

          <div v-if="showStatusFilter" 
               @click.stop 
               class="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-2">
            <div class="flex justify-between text-xs px-2 py-1 mb-2 border-b border-slate-100">
               <span @click="toggleAllStatus" class="cursor-pointer text-indigo-600 font-bold hover:underline">Selecionar Todos</span>
               <span @click="filters.status = []" class="cursor-pointer text-red-500 hover:underline">Limpar</span>
            </div>
            <div class="max-h-48 overflow-y-auto space-y-1">
              <div v-for="s in statusOptions" :key="s" 
                   @click="toggleStatusFilter(s)"
                   class="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer">
                <CheckSquare v-if="isStatusSelected(s)" class="w-4 h-4 text-indigo-600" />
                <Square v-else class="w-4 h-4 text-slate-300" />
                <span class="text-sm text-slate-700">{{ s }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="md:col-span-1">
            <button @click="resetFilters" class="w-full py-2 text-slate-400 hover:text-red-500 text-xs font-bold border border-transparent hover:border-red-100 rounded">Limpar</button>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[400px]">
        <div class="overflow-x-auto">
          <table class="w-full text-left whitespace-nowrap">
            <thead class="bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Op #</th>
                <th @click="ordenar('due_date')" class="px-6 py-3 text-xs font-bold text-slate-500 uppercase cursor-pointer hover:bg-slate-100 select-none group">
                  <div class="flex items-center gap-1">Vencimento <ArrowUpDown class="w-3 h-3 text-slate-300"/></div>
                </th>
                <th @click="ordenar('issuer_name')" class="px-6 py-3 text-xs font-bold text-slate-500 uppercase cursor-pointer hover:bg-slate-100 select-none group">
                  <div class="flex items-center gap-1">Cliente / Emitente <ArrowUpDown class="w-3 h-3 text-slate-300"/></div>
                </th>
                <th class="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Banco / Doc</th>
                <th @click="ordenar('amount')" class="px-6 py-3 text-xs font-bold text-slate-500 uppercase cursor-pointer hover:bg-slate-100 select-none group">
                  <div class="flex items-center gap-1">Valor <ArrowUpDown class="w-3 h-3 text-slate-300"/></div>
                </th>
                <th class="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-center">Status</th>
                <th class="px-6 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-if="dados.length === 0 && !loading">
                <td colspan="7" class="px-6 py-10 text-center text-slate-400">Nenhum registro encontrado.</td>
              </tr>
              <tr v-for="cheque in dados" :key="cheque.id" @click="abrirDetalhes(cheque)" class="hover:bg-indigo-50 cursor-pointer transition-colors group">
                <td class="px-6 py-4 text-xs font-mono font-bold text-indigo-600">#{{ cheque.operation_id }}</td>
                <td class="px-6 py-4 text-sm font-bold text-slate-700">{{ formatDate(cheque.vencimento) }}</td>
                <td class="px-6 py-4">
                  <div class="font-bold text-slate-900 text-sm">{{ cheque.cliente }}</div>
                  <div class="text-xs text-slate-500">{{ cheque.emitente }}</div>
                </td>
                <td class="px-6 py-4 text-xs text-slate-600">
                  <div>{{ cheque.banco }}</div>
                  <div>Doc: {{ cheque.num_doc }}</div>
                </td>
                <td class="px-6 py-4 font-bold text-emerald-600 text-sm">{{ formatCurrency(cheque.valor_liquido) }}</td>
                <td class="px-6 py-4 text-center">
                  <button @click="toggleStatusMenu(cheque, $event)" :class="['px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1 mx-auto w-28 justify-between', getStatusColor(cheque.status)]">
                     {{ cheque.status }} <ChevronDown class="w-3 h-3 opacity-50"/>
                  </button>
                </td>
                <td class="px-6 py-4 text-right">
                  <div class="flex justify-end gap-1">
                    
                    <button @click.stop="abrirProrrogacao(cheque)" class="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Prorrogar Título">
                      <CalendarClock class="w-4 h-4" />
                    </button>
                    <button @click.stop="deletarCheque(cheque.id)" class="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Excluir">
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
          <span class="text-xs text-slate-500 font-bold">Página {{ currentPage }} de {{ totalPages }}</span>
          <div class="flex gap-2">
            <button @click="mudarPagina(currentPage - 1)" :disabled="currentPage === 1" class="px-3 py-1 bg-white border border-slate-300 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-50"><ArrowLeft class="w-4 h-4" /></button>
            <button @click="mudarPagina(currentPage + 1)" :disabled="currentPage === totalPages" class="px-3 py-1 bg-white border border-slate-300 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-50"><ArrowRight class="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="isPrinting" class="print-overlay">
      <div class="print-paper">
        <h1 class="text-2xl font-bold mb-4">Relatório de Cheques</h1>
        <div class="text-xs mb-4 text-gray-500">Gerado em: {{ new Date().toLocaleString() }}</div>
        
        <table class="w-full text-left text-sm border-collapse">
          <thead>
            <tr class="border-b border-black">
              <th class="py-2">Vencimento</th>
              <th class="py-2">Cliente</th>
              <th class="py-2">Banco/Doc</th>
              <th class="py-2 text-right">Valor</th>
              <th class="py-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cheque in dados" :key="cheque.id" class="border-b border-gray-200">
              <td class="py-2">{{ formatDate(cheque.vencimento) }}</td>
              <td class="py-2">{{ cheque.cliente }}</td>
              <td class="py-2">{{ cheque.banco }} - {{ cheque.num_doc }}</td>
              <td class="py-2 text-right">{{ formatCurrency(cheque.valor_liquido) }}</td>
              <td class="py-2 text-center font-bold text-xs">{{ cheque.status }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="openStatusMenuId && menuCheque" 
         :style="{ top: menuPosition.top + 'px', left: menuPosition.left + 'px' }" 
         class="fixed z-[9999] -translate-x-1/2 w-32 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden text-left"
         @click.stop>
      <div v-for="opt in statusOptions" :key="opt" @click="alterarStatus(menuCheque, opt)" class="px-3 py-2 text-xs font-bold hover:bg-slate-50 cursor-pointer text-slate-600">{{ opt }}</div>
    </div>
  </DashboardLayout>
</template>

<style>
@media print {
  body { background: white !important; }
  .print-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: white; z-index: 9999; padding: 20mm; }
  .print:hidden { display: none !important; }
}
</style>