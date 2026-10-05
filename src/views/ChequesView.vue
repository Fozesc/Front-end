<script setup>
import { ref, reactive, computed, onMounted, watch, nextTick } from 'vue'; 
import { useRouter } from 'vue-router';
import DashboardLayout from '../layouts/DashboardLayout.vue';
import ChequeForm from '../components/layout/finance/ChequeForm.vue'; 
import EditarChequeModal from '../components/layout/finance/EditarChequeModal.vue';
import ChequeDetalhesModal from '../components/layout/finance/ChequeDetalhesModal.vue';
import ProrrogacaoModal from '../components/layout/finance/ProrrogacaoModal.vue'; 
import RecebimentoModal from '../components/layout/finance/RecebimentoModal.vue';
import StatusChequeModal from '../components/layout/finance/StatusChequeModal.vue';
import api from '../services/api';

import { 
  Search, Plus, Trash2, ChevronDown, 
  ArrowLeft, ArrowRight, Loader2, Calculator,
  ArrowUpDown, ArrowUp, ArrowDown, Filter, CheckSquare, Square,
  Edit, Download, CalendarClock, AlertTriangle, Pencil,
  HandCoins
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
const showEditModal = ref(false);
// Cheque em recebimento. O modal proprio existe porque a baixa pode ser DIVIDIDA
// (parte no dinheiro, parte no banco) - nao cabe no confirm generico.
const chequeParaReceber = ref(null);
// troca de status pelo botao da lista (Devolvido, Juridico...): { cheque, status }
const mudancaStatus = ref(null);


const openStatusMenuId = ref(null);
const menuPosition = reactive({ top: 0, left: 0 });
const menuCheque = ref(null);
const showStatusFilter = ref(false);

const dados = ref([]); 
const totalItems = ref(0);
const resumo = ref(null);
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

const EM_ABERTO = ['Aguardando', 'Atrasado', 'Devolvido', 'Juridico'];

const filters = reactive({
  search: '',
  status: [...EM_ABERTO],
  date_start: '',
  date_end: '',
  calculo: '',        // '' = todos | 'dentro' = so os que contam | 'fora' = so historico
  sort_by: 'due_date',
  sort_order: 'asc'
});

const statusOptions = ['Aguardando', 'Pago', 'Atrasado', 'Devolvido', 'Juridico'];
// o banco grava 'Juridico'; na tela vai com acento
const rotuloStatus = (s) => (s === 'Juridico' ? 'Jurídico' : s);

const confirmModal = reactive({
  visible: false,
  title: '',
  message: '',
  action: null,
  type: 'danger'
});

const openConfirm = (title, message, actionCallback, type = 'danger') => {
  confirmModal.title = title;
  confirmModal.message = message;
  confirmModal.action = actionCallback;
  confirmModal.type = type;
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
      calculo: filters.calculo,
      sort_by: filters.sort_by,
      sort_order: filters.sort_order
    };
    const response = await checkService.getAll(params);
    dados.value = response.items;
    totalItems.value = response.total;
    resumo.value = response.resumo;
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
const rotuloFiltroStatus = computed(() => {
  const s = filters.status;
  if (!s.length || s.length === statusOptions.length) return 'Todos';
  if (s.length === EM_ABERTO.length && EM_ABERTO.every(x => s.includes(x))) return 'Em aberto';
  if (s.length === 1) return rotuloStatus(s[0]);
  return `${s.length} selecionados`;
});

let timeoutSearch = null;
watch(() => filters.search, () => {
  clearTimeout(timeoutSearch);
  timeoutSearch = setTimeout(() => {
    currentPage.value = 1;
    carregarDados();
  }, 400); 
});

watch([() => filters.status, () => filters.date_start, () => filters.date_end, () => filters.calculo], () => {
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

const abrirNovo = () => { showModal.value = true; };
const abrirProrrogacao = (cheque) => { chequeParaProrrogar.value = cheque; showProrrogacaoModal.value = true; };

const salvarCheque = async (dadosFormulario) => {
  try {
    loading.value = true;
    // Só criação: o ChequeForm é o formulário de cheque manual (não preenche cheque
    // existente). A edição de cheque agora é o EditarChequeModal, que pede a senha.
    await api.post('/checks', dadosFormulario);
    showModal.value = false;
    carregarDados();
  } catch (error) {
    alert(error.response?.data?.error || "Erro ao salvar o cheque.");
  } finally {
    loading.value = false;
  }
};

const abrirRecebimento = (cheque) => {
  closeGlobalMenus();
  if (cheque.status === 'Pago') return;
  chequeParaReceber.value = cheque;
};

const alterarStatus = (cheque, novoStatus) => {
  closeGlobalMenus();
  if (cheque.status === novoStatus) return;

  // receber tem tela propria (uma conta ou dividido em partes, com ou sem imposto)
  if (novoStatus === 'Pago') { abrirRecebimento(cheque); return; }
  mudancaStatus.value = { cheque, status: novoStatus };
};

const abrirEdicaoCheque = (cheque) => {
  chequeParaEditar.value = cheque;
  showEditModal.value = true;
};

const deletarCheque = (id) => {
  openConfirm('Excluir Cheque', 'Esta ação não pode ser desfeita.', async () => {
    try { await checkService.delete(id); carregarDados(); } catch (e) { alert("Erro ao excluir."); }
  }, 'danger');
};

const abrirDetalhes = (cheque) => { selectedCheque.value = cheque; showDetailsModal.value = true; };
const hojeISO = new Date().toLocaleDateString('en-CA');
// dias de atraso de quem ainda deve (o "Atrasado" da lista ja vem do backend)
const atraso = (c) => {
  if (c.status === 'Pago' || !c.vencimento || c.vencimento >= hojeISO) return 0;
  return Math.round((new Date(hojeISO + 'T12:00:00') - new Date(c.vencimento + 'T12:00:00')) / 86400000);
};
const formatCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const formatDate = (d) => d ? d.split('-').reverse().join('/') : '-';
const getStatusColor = (s) => {
    if(s === 'Pago') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if(s === 'Atrasado') return 'bg-red-50 text-red-700 border-red-200';
    if(s === 'Devolvido') return 'bg-orange-50 text-orange-700 border-orange-200';
    if(s === 'Juridico') return 'bg-purple-50 text-purple-700 border-purple-200';
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
    filters.search = ''; filters.status = [...EM_ABERTO]; filters.date_start = ''; filters.date_end = '';
    filters.calculo = '';
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
    <ChequeForm v-if="showModal" @close="showModal = false" @save="salvarCheque" />
    <EditarChequeModal v-if="showEditModal && chequeParaEditar" :cheque="chequeParaEditar"
                       @close="showEditModal = false"
                       @saved="() => { showEditModal = false; carregarDados(); }" />
    <ProrrogacaoModal v-if="showProrrogacaoModal" :cheque="chequeParaProrrogar" :isOpen="showProrrogacaoModal" @close="showProrrogacaoModal = false" @save="() => { showProrrogacaoModal = false; carregarDados(); }" />
    <RecebimentoModal v-if="chequeParaReceber" :cheque="chequeParaReceber"
                      @close="chequeParaReceber = null" @confirmado="carregarDados" />
    <StatusChequeModal v-if="mudancaStatus" :cheque="mudancaStatus.cheque" :novoStatus="mudancaStatus.status"
                       :taxaMulta="taxaMulta" @close="mudancaStatus = null" @confirmado="carregarDados" />

    <div v-if="confirmModal.visible" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="confirmModal.visible = false"></div>
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm relative z-10 p-6 text-center animate-scale-in">
        <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4"
             :class="confirmModal.type === 'danger' ? 'bg-red-100 text-red-600' : (confirmModal.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600')">
          <AlertTriangle v-if="confirmModal.type !== 'success'" class="h-6 w-6" />
          <CheckSquare v-else class="h-6 w-6" />
        </div>
        <h3 class="text-lg font-semibold text-slate-900 mb-1">{{ confirmModal.title }}</h3>
        <p class="text-slate-500 mb-6 text-sm">{{ confirmModal.message }}</p>

        <div class="flex gap-3 justify-center">
          <button @click="confirmModal.visible = false" class="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg shadow-xs hover:bg-slate-50 transition-colors w-full text-sm">Cancelar</button>
          <button @click="() => { confirmModal.action(); confirmModal.visible = false; }" 
                  class="px-4 py-2.5 text-white font-semibold rounded-lg shadow-xs transition-colors w-full text-sm"
                  :class="confirmModal.type === 'danger' ? 'bg-red-600 hover:bg-red-700' : (confirmModal.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-500 hover:bg-amber-600')">
            Confirmar
          </button>
        </div>
      </div>
    </div>

    <div class="print:hidden">
      <div class="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 class="text-2xl font-semibold text-slate-900 tracking-tight">Títulos</h1>
          <div class="text-slate-500 text-sm mt-1">Total de <span class="font-semibold text-slate-700">{{ totalItems }}</span> registros</div>
        </div>
        <div class="flex gap-2.5">
          <button @click="exportarTela" class="bg-white border border-slate-300 text-slate-700 h-9 px-3.5 rounded-lg font-semibold text-sm flex items-center shadow-xs hover:bg-slate-50 transition-colors">
            <Download class="w-4 h-4 mr-2 text-slate-500" /> Exportar
          </button>
          <button @click="router.push('/bordero')" class="bg-white border border-slate-300 text-slate-700 h-9 px-3.5 rounded-lg font-semibold text-sm flex items-center shadow-xs hover:bg-slate-50 transition-colors">
            <Calculator class="w-4 h-4 mr-2 text-slate-500"/> Novo borderô
          </button>
          <button @click="abrirNovo" class="bg-indigo-600 hover:bg-indigo-700 text-white h-9 px-3.5 rounded-lg font-semibold text-sm flex items-center shadow-xs ring-1 ring-inset ring-white/10 transition-colors">
            <Plus class="w-4 h-4 mr-2"/> Novo cheque
          </button>
        </div>
      </div>

      <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200/80 mb-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
        <div class="md:col-span-3 relative">
          <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Busca</label>
          <Search class="w-4 h-4 absolute left-3 top-[35px] text-slate-400" />
          <input v-model="filters.search" type="text" placeholder="Nome, Banco, Doc..." class="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 outline-none shadow-xs transition-shadow" />
        </div>
        <div class="md:col-span-2"><label class="block text-[13px] font-medium text-slate-700 mb-1.5">De</label><input v-model="filters.date_start" type="date" class="w-full px-2 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 outline-none shadow-xs transition-shadow" /></div>
        <div class="md:col-span-2"><label class="block text-[13px] font-medium text-slate-700 mb-1.5">Até</label><input v-model="filters.date_end" type="date" class="w-full px-2 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 outline-none shadow-xs transition-shadow" /></div>
        <div class="md:col-span-2 relative">
          <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Status</label>
          <button @click.stop="showStatusFilter = !showStatusFilter" class="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm flex justify-between items-center shadow-xs hover:bg-slate-50 transition-colors">
            <span class="truncate">{{ rotuloFiltroStatus }}</span>
            <Filter class="w-4 h-4 text-slate-400" />
          </button>
          <div v-if="showStatusFilter" @click.stop class="absolute top-full left-0 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-1">
            <div class="flex gap-1 p-1 mb-1 border-b border-slate-100">
              <button @click="filters.status = [...EM_ABERTO]" class="flex-1 px-1.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap" :class="rotuloFiltroStatus === 'Em aberto' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'">Em aberto</button>
              <button @click="filters.status = []" class="flex-1 px-1.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap" :class="rotuloFiltroStatus === 'Todos' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'">Todos</button>
            </div>
            <div v-for="s in statusOptions" :key="s" @click="toggleStatusFilter(s)" class="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded-md cursor-pointer">
              <CheckSquare v-if="isStatusSelected(s)" class="w-4 h-4 text-indigo-600" />
              <Square v-else class="w-4 h-4 text-slate-300" />
              <span class="text-sm text-slate-700">{{ rotuloStatus(s) }}</span>
            </div>
          </div>
        </div>
        <div class="md:col-span-2">
          <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Cálculo</label>
          <select v-model="filters.calculo" class="w-full px-2 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 outline-none shadow-xs transition-shadow">
            <option value="">Todos</option>
            <option value="dentro">Só os que contam</option>
            <option value="fora">Só histórico (fora)</option>
          </select>
        </div>
        <div class="md:col-span-1"><button @click="resetFilters" class="w-full py-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-sm font-medium transition-colors">Limpar</button></div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col min-h-[400px]">
        <div v-if="resumo" class="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center gap-2">
          <div class="mr-4">
            <div class="text-xs font-medium text-slate-500">Total do filtro</div>
            <div class="text-xl font-semibold text-slate-900 tracking-tight tabular-nums">{{ formatCurrency(resumo.valor) }}
              <span class="text-xs font-medium text-slate-500 tracking-normal">· {{ resumo.qtd }} cheque(s)</span></div>
          </div>
          <div v-for="s in resumo.por_status" :key="s.status"
               :class="['px-2.5 py-1 rounded-md border text-xs', getStatusColor(s.status)]">
            <span class="font-medium">{{ rotuloStatus(s.status) }}</span>
            <span class="font-semibold tabular-nums ml-1">{{ formatCurrency(s.valor) }}</span>
            <span class="opacity-70 ml-1">({{ s.qtd }})</span>
          </div>
          <div v-if="resumo.fora.qtd" class="px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 text-slate-600 text-xs"
               title="Já estão somados acima; são histórico e não entram nos números do painel">
            <span class="font-medium">Fora do cálculo</span>
            <span class="font-semibold tabular-nums ml-1">{{ formatCurrency(resumo.fora.valor) }}</span>
            <span class="opacity-70 ml-1">({{ resumo.fora.qtd }})</span>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-[13px]">
            <thead class="bg-slate-50/80 border-b border-slate-200">
              <tr class="text-xs font-medium text-slate-500">
                <th @click="ordenar('due_date')" class="px-3 py-2.5 cursor-pointer hover:text-slate-800 whitespace-nowrap">Vencimento</th>
                <th @click="ordenar('issuer_name')" class="px-3 py-2.5 cursor-pointer hover:text-slate-800">Cliente / Emitente</th>
                <th class="px-3 py-2.5 whitespace-nowrap">Banco / Doc</th>
                <th class="px-3 py-2.5">Borderô</th>
                <th @click="ordenar('amount')" class="px-3 py-2.5 cursor-pointer hover:text-slate-800 text-right">Valor</th>
                <th class="px-3 py-2.5">Status</th>
                <th class="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="cheque in dados" :key="cheque.id" @click="abrirDetalhes(cheque)"
                  :class="['hover:bg-slate-50 cursor-pointer transition-colors', cheque.fora_do_calculo ? 'bg-slate-50/70' : '']">
                <td class="px-3 py-2.5 whitespace-nowrap align-top">
                  <div class="font-semibold text-slate-800 tabular-nums">{{ formatDate(cheque.vencimento) }}</div>
                  <div v-if="atraso(cheque)" class="text-[11px] font-medium text-red-600">há {{ atraso(cheque) }} dia{{ atraso(cheque) > 1 ? 's' : '' }}</div>
                  <div v-if="cheque.prorrogacoes" data-campo="marca-prorrogado"
                       :title="`Prorrogado ${cheque.prorrogacoes > 1 ? cheque.prorrogacoes + ' vezes' : 'uma vez'} · vencimento original ${formatDate(cheque.vencimento_original)}`"
                       class="mt-1 inline-flex items-center gap-1 px-1.5 py-px rounded-md border border-amber-200 bg-amber-50 text-amber-700 text-[11px] font-medium">
                    <CalendarClock class="w-3 h-3" /> prorrogado{{ cheque.prorrogacoes > 1 ? ` ${cheque.prorrogacoes}x` : '' }}
                  </div>
                </td>
                <td class="px-3 py-2.5 max-w-[300px] align-top">
                  <div class="font-semibold text-slate-900 truncate" :title="cheque.cliente">{{ cheque.cliente }}</div>
                  <div class="text-xs text-slate-500 truncate" :title="cheque.emitente">{{ cheque.emitente }}</div>
                </td>
                <td class="px-3 py-2.5 max-w-[160px] align-top">
                  <div class="text-slate-700 truncate" :title="cheque.banco">{{ cheque.banco || '—' }}</div>
                  <div class="text-xs text-slate-500 truncate">{{ cheque.num_doc ? 'doc ' + cheque.num_doc : (cheque.tipo === 'PROMISSORIA' ? 'promissória' : '') }}</div>
                </td>
                <td class="px-3 py-2.5 whitespace-nowrap align-top">
                  <div class="text-slate-700 tabular-nums">#{{ cheque.operation_id }}</div>
                  <div class="flex gap-1 mt-0.5">
                    <span v-if="cheque.fora_do_calculo" class="px-1.5 py-px rounded-md bg-slate-100 text-slate-600 text-[11px] font-medium">fora do cálculo</span>
                    <span v-if="cheque.importado" class="px-1.5 py-px rounded-md border border-slate-200 text-slate-500 text-[11px] font-medium">importado</span>
                  </div>
                </td>
                <td class="px-3 py-2.5 font-semibold text-slate-900 text-right tabular-nums whitespace-nowrap align-top">{{ formatCurrency(cheque.valor_bruto) }}</td>
                <td class="px-3 py-2.5 align-top">
                  <button @click.stop="toggleStatusMenu(cheque, $event)" :class="['pl-2 pr-1.5 py-0.5 rounded-md text-xs font-medium border inline-flex items-center gap-1.5 whitespace-nowrap before:w-1.5 before:h-1.5 before:rounded-full before:bg-current before:opacity-80', getStatusColor(cheque.status)]">
                     {{ rotuloStatus(cheque.status) }} <ChevronDown class="w-3 h-3 opacity-60"/>
                  </button>
                </td>
                <td class="px-2 py-2 align-top">
                  <div class="flex justify-end gap-0.5">
                    <button v-if="cheque.status !== 'Pago'" @click.stop="abrirRecebimento(cheque)"
                            title="Receber (uma conta ou dividido)"
                            class="p-1.5 rounded-md text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors"><HandCoins class="w-4 h-4"/></button>
                    <button v-if="cheque.status !== 'Pago'" @click.stop="abrirProrrogacao(cheque)" title="Prorrogar / receber parte" class="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"><CalendarClock class="w-4 h-4"/></button>
                    <button @click.stop="abrirEdicaoCheque(cheque)" title="Editar nome/datas (pede senha)" class="p-1.5 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"><Pencil class="w-4 h-4"/></button>
                    <button @click.stop="deletarCheque(cheque.id)" title="Excluir" class="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 class="w-4 h-4"/></button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="px-5 py-3 border-t border-slate-200 flex justify-between items-center">
          <span class="text-[13px] text-slate-500">Página <span class="font-semibold text-slate-700">{{ currentPage }}</span> de <span class="font-semibold text-slate-700">{{ totalPages }}</span></span>
          <div class="flex gap-2">
            <button @click="mudarPagina(currentPage - 1)" :disabled="currentPage === 1" class="h-8 w-8 flex items-center justify-center bg-white border border-slate-300 rounded-lg shadow-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:shadow-none"><ArrowLeft class="w-4 h-4" /></button>
            <button @click="mudarPagina(currentPage + 1)" :disabled="currentPage === totalPages" class="h-8 w-8 flex items-center justify-center bg-white border border-slate-300 rounded-lg shadow-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:shadow-none"><ArrowRight class="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="openStatusMenuId && menuCheque" 
         :style="{ top: menuPosition.top + 'px', left: menuPosition.left + 'px' }" 
         class="fixed z-[9999] -translate-x-1/2 w-36 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden text-left p-1"
         @click.stop>
      <div v-for="opt in statusOptions" :key="opt" @click="alterarStatus(menuCheque, opt)" class="px-2.5 py-1.5 text-[13px] font-medium rounded-md hover:bg-slate-100 cursor-pointer text-slate-700">{{ rotuloStatus(opt) }}</div>
    </div>
  </DashboardLayout>
</template>

<style scoped>
.animate-scale-in { animation: scaleIn 0.2s ease-out; }
@keyframes scaleIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
</style>