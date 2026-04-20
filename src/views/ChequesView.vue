<script setup>
import { ref, reactive, onMounted, watch, nextTick } from 'vue'; 
import { useRouter } from 'vue-router';
import DashboardLayout from '../layouts/DashboardLayout.vue';
import ChequeForm from '../components/layout/finance/ChequeForm.vue'; 
import ChequeDetalhesModal from '../components/layout/finance/ChequeDetalhesModal.vue';
import ProrrogacaoModal from '../components/layout/finance/ProrrogacaoModal.vue'; 
import api from '../services/api';

import { 
  Search, Plus, Trash2, ChevronDown, 
  ArrowLeft, ArrowRight, Loader2, Calculator,
  ArrowUpDown, ArrowUp, ArrowDown, Filter, CheckSquare, Square,
  Edit, Download, CalendarClock, AlertTriangle 
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
const taxaMulta = ref(2.0);

const fetchSettings = async () => {
  try {
    const { data } = await api.get('/settings/');
    if (data) {
      taxaMulta.value = Number(data.fine_rate || data.taxa_multa || data.multa_devolucao || 2.0);
    }
  } catch (error) {
    console.error("Erro ao buscar configurações", error);
  }
};

const filters = reactive({
  search: '',
  status: [], 
  date_start: new Date().toISOString().split('T')[0], 
  date_end: '',
  sort_by: 'due_date',
  sort_order: 'asc'
});

const statusOptions = ['Aguardando', 'Pago', 'Atrasado', 'Devolvido', 'Juridico'];

const confirmModal = reactive({
  visible: false,
  title: '',
  message: '',
  action: null,
  type: 'danger',
  showAccountSelect: false,
  selectedAccount: 'Dinheiro'
});

const openConfirm = (title, message, actionCallback, type = 'danger', showAccount = false) => {
  confirmModal.title = title;
  confirmModal.message = message;
  confirmModal.action = actionCallback;
  confirmModal.type = type;
  confirmModal.showAccountSelect = showAccount;
  confirmModal.selectedAccount = 'Dinheiro';
  confirmModal.visible = true;
};

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
  filters.status = filters.status.length === statusOptions.length ? [] : [...statusOptions];
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
  fetchSettings(); 
  carregarDados();
  document.addEventListener('click', closeGlobalMenus);
  document.addEventListener('scroll', closeGlobalMenus, true);
});

const abrirNovo = () => { chequeParaEditar.value = null; showModal.value = true; };
const abrirProrrogacao = (cheque) => { chequeParaProrrogar.value = cheque; showProrrogacaoModal.value = true; };
const abrirEdicao = (cheque) => { chequeParaEditar.value = { ...cheque }; showModal.value = true; };

const salvarCheque = async (dadosFormulario) => {
  try {
    loading.value = true;
    if (chequeParaEditar.value) await api.put(`/checks/${chequeParaEditar.value.id}`, dadosFormulario);
    else await api.post('/checks', dadosFormulario); 
    showModal.value = false;
    carregarDados();
  } catch (error) {
    alert(error.response?.data?.error || "Erro ao salvar o cheque.");
  } finally {
    loading.value = false;
  }
};

const alterarStatus = (cheque, novoStatus) => {
  closeGlobalMenus();
  if (cheque.status === novoStatus) return;

  let title = `Alterar Status`;
  let msg = `Tem certeza que deseja mudar o status para "${novoStatus}"?`;
  let alertType = 'warning';
  let requiresAccount = false;
  let payloadData = {};

  if (novoStatus === 'Pago') {
    title = 'Confirmar Recebimento';
    msg = `O valor de ${formatCurrency(cheque.valor_bruto)} entrará no caixa.`;
    alertType = 'success';
    requiresAccount = true;
  } else if (novoStatus === 'Devolvido') {
    title = 'Confirmar Devolução';
    const valorMultaCalculada = cheque.valor_bruto * (taxaMulta.value / 100);
    msg = `A multa de ${formatCurrency(valorMultaCalculada)} entrará no caixa escolhido.`;
    alertType = 'danger';
    requiresAccount = true;
    payloadData.taxa_multa = taxaMulta.value;
  }

  openConfirm(title, msg, async () => {
    try {
      if (requiresAccount) {
        payloadData.method = confirmModal.selectedAccount; 
      }

      await api.patch(`/checks/${cheque.id}/status`, {
          status: novoStatus,
          taxa_multa: payloadData.taxa_multa, 
          payment_data: payloadData 
      });
      
      carregarDados();
    } catch (error) { 
      alert("Erro ao atualizar o status."); 
    }
  }, alertType, requiresAccount);
};

const deletarCheque = (id) => {
  openConfirm('Excluir Cheque', 'Esta ação não pode ser desfeita.', async () => {
    try { await checkService.delete(id); carregarDados(); } catch (e) { alert("Erro ao excluir."); }
  }, 'danger');
};

const abrirDetalhes = (cheque) => { selectedCheque.value = cheque; showDetailsModal.value = true; };
const formatCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const formatDate = (d) => d ? d.split('-').reverse().join('/') : '-';
const getStatusColor = (s) => {
    if(s === 'Pago') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if(s === 'Atrasado') return 'bg-red-100 text-red-700 border-red-200';
    if(s === 'Devolvido') return 'bg-orange-100 text-orange-700 border-orange-200';
    if(s === 'Juridico') return 'bg-purple-100 text-purple-700 border-purple-200';
    return 'bg-blue-50 text-blue-700 border-blue-200';
};

const toggleStatusMenu = (cheque, event) => { 
  event.stopPropagation(); 
  if (openStatusMenuId.value === cheque.id) { closeGlobalMenus(); return; }
  const rect = event.currentTarget.getBoundingClientRect();
  menuPosition.top = rect.bottom + 5;
  menuPosition.left = rect.left + (rect.width / 2);
  menuCheque.value = cheque;
  openStatusMenuId.value = cheque.id;
};

const resetFilters = () => {
    filters.search = ''; filters.status = []; filters.date_start = ''; filters.date_end = '';
    currentPage.value = 1; carregarDados();
};

const exportarTela = () => {
  isPrinting.value = true;
  nextTick(() => { window.print(); isPrinting.value = false; });
};
</script>

<template>
  <DashboardLayout>
    <ChequeDetalhesModal v-if="showDetailsModal" :cheque="selectedCheque" :isOpen="showDetailsModal" @close="showDetailsModal = false" />
    <ChequeForm v-if="showModal" :cheque="chequeParaEditar" @close="showModal = false" @save="salvarCheque" />
    <ProrrogacaoModal v-if="showProrrogacaoModal" :cheque="chequeParaProrrogar" :isOpen="showProrrogacaoModal" @close="showProrrogacaoModal = false" @save="() => { showProrrogacaoModal = false; carregarDados(); }" />

    <div v-if="confirmModal.visible" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="confirmModal.visible = false"></div>
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm relative z-10 p-6 text-center animate-scale-in">
        <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full mb-6"
             :class="confirmModal.type === 'danger' ? 'bg-red-100 text-red-600' : (confirmModal.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600')">
          <AlertTriangle v-if="confirmModal.type !== 'success'" class="h-8 w-8" />
          <CheckSquare v-else class="h-8 w-8" />
        </div>
        <h3 class="text-xl font-bold text-slate-900 mb-2">{{ confirmModal.title }}</h3>
        <p class="text-slate-500 mb-2 text-sm">{{ confirmModal.message }}</p>
        
        <div v-if="confirmModal.showAccountSelect" class="mt-4 mb-6 text-left bg-slate-50 p-4 rounded-lg border border-slate-200">
          <label class="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Entrar na conta:</label>
          <select v-model="confirmModal.selectedAccount" class="w-full bg-white border border-slate-300 rounded-lg py-2.5 px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700">
            <option value="Dinheiro">Dinheiro (Cofre)</option>
            <option value="BB">Banco do Brasil</option>
            <option value="Caixa">Caixa Econômica</option>
          </select>
        </div>

        <div class="flex gap-3 justify-center">
          <button @click="confirmModal.visible = false" class="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors w-full text-sm">Cancelar</button>
          <button @click="() => { confirmModal.action(); confirmModal.visible = false; }" 
                  class="px-5 py-2.5 text-white font-bold rounded-lg shadow-md transition-colors w-full text-sm"
                  :class="confirmModal.type === 'danger' ? 'bg-red-600 hover:bg-red-700' : (confirmModal.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-500 hover:bg-amber-600')">
            Confirmar
          </button>
        </div>
      </div>
    </div>

    <div class="print:hidden">
      <div class="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 class="text-3xl font-bold text-slate-900 tracking-tight">Gerenciamento de Cheques</h1>
          <div class="text-slate-500 text-sm mt-1">Total: <strong>{{ totalItems }}</strong> registros</div>
        </div>
        <div class="flex gap-3">
          <button @click="exportarTela" class="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg font-bold text-sm flex items-center shadow-sm hover:bg-slate-50">
            <Download class="w-4 h-4 mr-2" /> Exportar
          </button>
          <button @click="router.push('/bordero')" class="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center">
            <Calculator class="w-4 h-4 mr-2"/> Novo Borderô
          </button>
          <button @click="abrirNovo" class="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center shadow-md">
            <Plus class="w-4 h-4 mr-2"/> Novo Cheque
          </button>
        </div>
      </div>

      <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
        <div class="md:col-span-4 relative">
          <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Busca</label>
          <Search class="w-4 h-4 absolute left-3 top-8 text-slate-400" />
          <input v-model="filters.search" type="text" placeholder="Nome, Banco, Doc..." class="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
        </div>
        <div class="md:col-span-2"><label class="block text-xs font-bold text-slate-500 uppercase mb-1">De</label><input v-model="filters.date_start" type="date" class="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs" /></div>
        <div class="md:col-span-2"><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Até</label><input v-model="filters.date_end" type="date" class="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs" /></div>
        <div class="md:col-span-3 relative">
          <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
          <button @click.stop="showStatusFilter = !showStatusFilter" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm flex justify-between items-center">
            <span class="truncate">{{ filters.status.length === 0 ? 'Todos' : filters.status.length + ' selecionados' }}</span>
            <Filter class="w-4 h-4 text-slate-400" />
          </button>
          <div v-if="showStatusFilter" @click.stop class="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-2">
            <div v-for="s in statusOptions" :key="s" @click="toggleStatusFilter(s)" class="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer">
              <CheckSquare v-if="isStatusSelected(s)" class="w-4 h-4 text-indigo-600" />
              <Square v-else class="w-4 h-4 text-slate-300" />
              <span class="text-sm text-slate-700">{{ s }}</span>
            </div>
          </div>
        </div>
        <div class="md:col-span-1"><button @click="resetFilters" class="w-full py-2 text-slate-400 hover:text-red-500 text-xs font-bold">Limpar</button></div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[400px]">
        <div class="overflow-x-auto">
          <table class="w-full text-left whitespace-nowrap">
            <thead class="bg-slate-50 border-b border-slate-200">
              <tr class="text-xs font-bold text-slate-500 uppercase">
                <th class="px-6 py-3">Op #</th>
                <th @click="ordenar('due_date')" class="px-6 py-3 cursor-pointer hover:bg-slate-100">Vencimento</th>
                <th @click="ordenar('issuer_name')" class="px-6 py-3 cursor-pointer hover:bg-slate-100">Cliente / Emitente</th>
                <th class="px-6 py-3">Banco / Doc</th>
                <th @click="ordenar('amount')" class="px-6 py-3 cursor-pointer hover:bg-slate-100">Valor</th>
                <th class="px-6 py-3 text-center">Status</th>
                <th class="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="cheque in dados" :key="cheque.id" @click="abrirDetalhes(cheque)" class="hover:bg-indigo-50 cursor-pointer transition-colors text-sm">
                <td class="px-6 py-4 text-xs font-mono font-bold text-indigo-600">#{{ cheque.operation_id }}</td>
                <td class="px-6 py-4 font-bold text-slate-700">{{ formatDate(cheque.vencimento) }}</td>
                <td class="px-6 py-4"><div class="font-bold text-slate-900">{{ cheque.cliente }}</div><div class="text-xs text-slate-500">{{ cheque.emitente }}</div></td>
                <td class="px-6 py-4 text-xs text-slate-600"><div>{{ cheque.banco }}</div><div>Doc: {{ cheque.num_doc }}</div></td>
                <td class="px-6 py-4 font-bold text-emerald-600">{{ formatCurrency(cheque.valor_bruto) }}</td>
                <td class="px-6 py-4 text-center">
                  <button @click.stop="toggleStatusMenu(cheque, $event)" :class="['px-3 py-1 rounded-full text-[10px] font-black border flex items-center gap-1 mx-auto w-28 justify-between uppercase tracking-tighter', getStatusColor(cheque.status)]">
                     {{ cheque.status }} <ChevronDown class="w-3 h-3 opacity-50"/>
                  </button>
                </td>
                <td class="px-6 py-4 text-right">
                  <div class="flex justify-end gap-1">
                    <button @click.stop="abrirProrrogacao(cheque)" class="p-2 text-slate-300 hover:text-indigo-600 transition-colors"><CalendarClock class="w-4 h-4"/></button>
                    <button @click.stop="deletarCheque(cheque.id)" class="p-2 text-slate-300 hover:text-red-600 transition-colors"><Trash2 class="w-4 h-4"/></button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
          <span class="text-xs text-slate-500 font-bold">Página {{ currentPage }} de {{ totalPages }}</span>
          <div class="flex gap-2">
            <button @click="mudarPagina(currentPage - 1)" :disabled="currentPage === 1" class="px-3 py-1 bg-white border rounded text-slate-600 hover:bg-slate-100 disabled:opacity-50"><ArrowLeft class="w-4 h-4" /></button>
            <button @click="mudarPagina(currentPage + 1)" :disabled="currentPage === totalPages" class="px-3 py-1 bg-white border rounded text-slate-600 hover:bg-slate-100 disabled:opacity-50"><ArrowRight class="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="openStatusMenuId && menuCheque" 
         :style="{ top: menuPosition.top + 'px', left: menuPosition.left + 'px' }" 
         class="fixed z-[9999] -translate-x-1/2 w-32 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden text-left"
         @click.stop>
      <div v-for="opt in statusOptions" :key="opt" @click="alterarStatus(menuCheque, opt)" class="px-3 py-2 text-[10px] font-black uppercase hover:bg-slate-50 cursor-pointer text-slate-600 border-b border-slate-50 last:border-0">{{ opt }}</div>
    </div>
  </DashboardLayout>
</template>

<style scoped>
.animate-scale-in { animation: scaleIn 0.2s ease-out; }
@keyframes scaleIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
</style>