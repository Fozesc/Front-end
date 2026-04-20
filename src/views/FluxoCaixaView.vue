<script setup>
import { ref, onMounted, reactive, watch, nextTick, computed } from 'vue';
import DashboardLayout from '../layouts/DashboardLayout.vue';
import NovoLancamentoModal from '../components/FluxoCaixa/NovoLancamentoModal.vue';
import ConfiguracaoModal from '../components/FluxoCaixa/ConfiguracaoModal.vue';
import DetalhesLancamentoModal from '../components/FluxoCaixa/DetalhesLancamentoModal.vue';

import { 
  Wallet, Building, Banknote, Plus, Download, Search, 
  Trash2, Edit2, Settings, Filter, ArrowUpCircle, ArrowDownCircle, 
  ChevronDown, Loader2, ArrowLeft, ArrowRight, Eye, TrendingUp,
  AlertTriangle 
} from 'lucide-vue-next';

import transactionService from '../services/transactionService';

const showModal = ref(false);
const showConfigModal = ref(false);
const loading = ref(true);
const isPrinting = ref(false);

const lancamentoEmEdicao = ref(null);
const lancamentoParaDetalhes = ref(null);

const lancamentos = ref([]);
const totalItems = ref(0);
const totalPages = ref(1);
const currentPage = ref(1);
const itemsPerPage = 40;

const resumoFiltro = ref({ entradas: 0, saidas: 0, resultado: 0 });

const saldos = ref({
  bruto: { bb_total: 0, caixa_total: 0, dinheiro_total: 0 },
  na_rua: { BRASIL: 0, CAIXA: 0, DINHEIRO: 0 }
}); 
const capitalTotal = ref(0); 

const filtros = reactive({ texto: '', data: '', tipo: 'todos' });

// Controle do Modal de Alerta
const confirmModal = reactive({
  visible: false,
  id: null,
  title: 'Excluir Lançamento',
  message: 'Tem certeza que deseja apagar este registro? Esta ação não pode ser desfeita.'
});

// CÁLCULOS
const totalBrutoGeral = computed(() => saldos.value.bruto.bb_total + saldos.value.bruto.caixa_total + saldos.value.bruto.dinheiro_total);
const totalEmprestadoGeral = computed(() => saldos.value.na_rua.BRASIL + saldos.value.na_rua.CAIXA + saldos.value.na_rua.DINHEIRO);
const patrimonioAtual = computed(() => totalBrutoGeral.value + totalEmprestadoGeral.value);
const porcentagemCrescimento = computed(() => {
  if (capitalTotal.value <= 0) return 0;
  return ((patrimonioAtual.value - capitalTotal.value) / capitalTotal.value) * 100;
});

const carregarTabela = async () => {
  loading.value = true;
  try {
    const params = { page: currentPage.value, per_page: itemsPerPage, search: filtros.texto, date: filtros.data, type: filtros.tipo };
    const res = await transactionService.getAll(params);
    lancamentos.value = res.items.filter(i => i.categoria !== 'Saldo Inicial');
    totalItems.value = res.total;
    totalPages.value = res.pages;
    if (res.summary) resumoFiltro.value = res.summary;
  } catch (error) { console.error(error); } finally { loading.value = false; }
};

const carregarSaldos = async () => {
  try {
    const resSaldos = await transactionService.getBalances();
    saldos.value.bruto = resSaldos.bruto;
    saldos.value.na_rua = resSaldos.na_rua;
    capitalTotal.value = resSaldos.capital_total; 
  } catch (e) { console.error(e); }
};

let timeoutSearch = null;
watch(() => filtros.texto, () => {
  clearTimeout(timeoutSearch);
  timeoutSearch = setTimeout(() => { currentPage.value = 1; carregarTabela(); }, 400);
});
watch([() => filtros.data, () => filtros.tipo], () => { currentPage.value = 1; carregarTabela(); });

const mudarPagina = (p) => { if (p >= 1 && p <= totalPages.value) { currentPage.value = p; carregarTabela(); } };

onMounted(() => { carregarTabela(); carregarSaldos(); });

const abrirModalNovo = () => { lancamentoEmEdicao.value = null; showModal.value = true; };
const abrirModalEdicao = (item) => { lancamentoEmEdicao.value = { ...item }; showModal.value = true; };

const salvarLancamento = async (dados) => {
  try {
    if (lancamentoEmEdicao.value?.id) await transactionService.update(lancamentoEmEdicao.value.id, dados);
    else await transactionService.create(dados);
    showModal.value = false;
    await carregarTabela();
    await carregarSaldos(); 
  } catch (error) { alert("Erro ao salvar."); }
};

const excluirLancamento = (id) => {
  confirmModal.id = id;
  confirmModal.visible = true;
};

const confirmarExclusao = async () => {
  const id = confirmModal.id;
  confirmModal.visible = false;
  try { 
    await transactionService.delete(id); 
    await carregarTabela(); 
    await carregarSaldos(); 
  } catch (error) { 
    alert("Erro ao excluir."); 
  }
};

const formatMoney = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const formatDate = (d) => d ? d.split('-').reverse().join('/') : '-';
</script>

<template>
  <DashboardLayout>
    <NovoLancamentoModal v-if="showModal" :lancamento="lancamentoEmEdicao" @close="showModal = false" @save="salvarLancamento" />
    <ConfiguracaoModal v-if="showConfigModal" @close="showConfigModal = false" @save="carregarSaldos" />
    <DetalhesLancamentoModal v-if="lancamentoParaDetalhes" :lancamento="lancamentoParaDetalhes" @close="lancamentoParaDetalhes = null" />

    <div v-if="confirmModal.visible" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="confirmModal.visible = false"></div>
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm relative z-10 p-6 text-center animate-scale-in">
        <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 text-red-600 mb-6">
          <AlertTriangle class="h-8 w-8" />
        </div>
        <h3 class="text-xl font-bold text-slate-900 mb-2">{{ confirmModal.title }}</h3>
        <p class="text-slate-500 mb-8 text-sm leading-relaxed">{{ confirmModal.message }}</p>
        
        <div class="flex gap-3">
          <button @click="confirmModal.visible = false" class="flex-1 px-4 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm">
            Cancelar
          </button>
          <button @click="confirmarExclusao" class="flex-1 px-4 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-200 text-sm">
            Sim, Apagar
          </button>
        </div>
      </div>
    </div>

    <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
      <h1 class="text-3xl font-bold text-slate-900">Fluxo de Caixa</h1>
      <div class="flex gap-3">
        <button @click="showConfigModal = true" class="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg transition-colors flex items-center gap-1">
          <Settings class="w-4 h-4" /> Capital Social
        </button>
        <button @click="abrirModalNovo" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-bold shadow-md flex items-center text-sm transition-transform active:scale-95">
          <Plus class="w-4 h-4 mr-2" /> Lançamento
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <div class="flex items-center gap-3 mb-4 text-slate-700"><Building class="w-5 h-5" /> <span class="text-xs font-bold uppercase tracking-wider">Saldo Atual (No Caixa)</span></div>
        <div class="space-y-2">
          <div class="flex justify-between items-center"><span class="text-xs text-blue-600 font-bold uppercase">BB</span><span class="text-sm font-bold text-slate-700">{{ formatMoney(saldos.bruto.bb_total) }}</span></div>
          <div class="flex justify-between items-center"><span class="text-xs text-sky-500 font-bold uppercase">Caixa</span><span class="text-sm font-bold text-slate-700">{{ formatMoney(saldos.bruto.caixa_total) }}</span></div>
          <div class="flex justify-between items-center border-t border-slate-100 pt-2 mt-1"><span class="text-xs text-emerald-600 font-bold uppercase">Dinheiro</span><span class="text-sm font-bold text-slate-700">{{ formatMoney(saldos.bruto.dinheiro_total) }}</span></div>
          <div class="flex justify-between items-center pt-1 font-black text-slate-900 uppercase text-[10px]"><span>Total Caixa:</span><span>{{ formatMoney(totalBrutoGeral) }}</span></div>
        </div>
      </div>

      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <div class="flex items-center gap-3 mb-4 text-red-600"><ArrowDownCircle class="w-5 h-5" /> <span class="text-xs font-bold uppercase tracking-wider">Emprestado (Na Rua)</span></div>
        <div class="space-y-2">
          <div class="flex justify-between items-center"><span class="text-xs text-slate-500 font-bold uppercase">Origem BB</span><span class="text-sm font-bold text-red-600">{{ formatMoney(saldos.na_rua.BRASIL) }}</span></div>
          <div class="flex justify-between items-center"><span class="text-xs text-slate-500 font-bold uppercase">Origem Caixa</span><span class="text-sm font-bold text-red-600">{{ formatMoney(saldos.na_rua.CAIXA) }}</span></div>
          <div class="flex justify-between items-center border-t border-slate-100 pt-2 mt-1"><span class="text-xs text-slate-500 font-bold uppercase">Origem Dinheiro</span><span class="text-sm font-bold text-red-600">{{ formatMoney(saldos.na_rua.DINHEIRO) }}</span></div>
          <div class="flex justify-between items-center pt-1 font-black text-red-800 uppercase text-[10px]"><span>Total:</span><span>{{ formatMoney(totalEmprestadoGeral) }}</span></div>
        </div>
      </div>

      <div class="bg-emerald-600 text-white p-5 rounded-xl shadow-lg relative overflow-hidden">
        <div class="absolute right-0 top-0 opacity-10 transform translate-x-4 -translate-y-4"><TrendingUp class="w-24 h-24" /></div>
        <div class="flex items-center gap-3 mb-2 opacity-90"><Banknote class="w-5 h-5" /> <span class="text-xs font-bold uppercase tracking-wider">Patrimônio Total</span></div>
        <div class="text-3xl font-black tracking-tight">{{ formatMoney(patrimonioAtual) }}</div>
        <div class="mt-4 flex justify-between items-end border-t border-emerald-500 pt-3">
          <div><span class="text-[10px] block opacity-70 uppercase font-bold text-emerald-100">Investido</span><span class="text-sm font-bold">{{ formatMoney(capitalTotal) }}</span></div>
          <div class="text-right">
            <span class="text-[10px] block opacity-70 uppercase font-bold text-emerald-100">Crescimento</span>
            <span class="text-sm font-bold bg-white/20 px-2 py-0.5 rounded-full">{{ porcentagemCrescimento > 0 ? '+' : '' }}{{ porcentagemCrescimento.toFixed(1) }}%</span>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div class="p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div class="flex gap-3 w-full md:w-auto">
          <input v-model="filtros.texto" type="text" placeholder="Buscar histórico..." class="w-full md:w-64 px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
          <input v-model="filtros.data" type="date" class="px-3 py-2 border rounded-lg text-sm outline-none" />
        </div>
        <div v-if="!loading" class="flex gap-4 text-sm font-bold">
          <div class="text-emerald-600 uppercase text-[10px] tracking-widest">Entradas: <span class="text-sm">{{ formatMoney(resumoFiltro.entradas) }}</span></div>
          <div class="text-red-600 uppercase text-[10px] tracking-widest">Saídas: <span class="text-sm">{{ formatMoney(resumoFiltro.saidas) }}</span></div>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
            <tr>
              <th class="px-6 py-4">Data</th>
              <th class="px-6 py-4">Descrição</th>
              <th class="px-6 py-4">Conta</th>
              <th class="px-6 py-4 text-right">Entrada</th>
              <th class="px-6 py-4 text-right">Saída</th>
              <th class="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="loading"><td colspan="6" class="px-6 py-10 text-center"><Loader2 class="w-6 h-6 animate-spin mx-auto"/></td></tr>
            <tr v-for="item in lancamentos" :key="item.id" class="hover:bg-slate-50 transition-colors">
              <td class="px-6 py-4 text-slate-500 font-mono text-xs">{{ formatDate(item.data) }}</td>
              <td class="px-6 py-4 font-medium text-slate-800">{{ item.descricao }}</td>
              <td class="px-6 py-4">
                <span class="px-3 py-1 rounded text-[10px] font-bold border uppercase tracking-tighter whitespace-nowrap"
                  :class="{
                    'bg-blue-50 text-blue-700 border-blue-100': (item.origem || '').toLowerCase().includes('brasil') || (item.origem || '').toLowerCase().includes('bb'),
                    'bg-sky-50 text-sky-700 border-sky-100': (item.origem || '').toLowerCase().includes('caixa') || (item.origem || '').toLowerCase().includes('ce'),
                    'bg-emerald-50 text-emerald-700 border-emerald-100': !(item.origem || '').toLowerCase().includes('brasil') && !(item.origem || '').toLowerCase().includes('caixa')
                  }">
                  {{ item.origem }}
                </span>
              </td>
              <td class="px-6 py-4 text-right text-emerald-600 font-bold">{{ item.tipo === 'entrada' ? formatMoney(item.valor) : '-' }}</td>
              <td class="px-6 py-4 text-right text-red-600 font-bold">{{ item.tipo === 'saida' ? formatMoney(item.valor) : '-' }}</td>
              <td class="px-6 py-4 text-right">
                <div class="flex justify-end gap-2 opacity-40 hover:opacity-100 transition-opacity">
                  <button @click="abrirModalEdicao(item)" class="p-1 hover:text-indigo-600"><Edit2 class="w-4 h-4"/></button>
                  <button @click="excluirLancamento(item.id)" class="p-1 hover:text-red-600"><Trash2 class="w-4 h-4"/></button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </DashboardLayout>
</template>

<style scoped>
.animate-scale-in { animation: scaleIn 0.2s ease-out; }
@keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
</style>