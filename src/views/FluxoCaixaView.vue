<script setup>
import { ref, onMounted, reactive, watch, nextTick } from 'vue';
import DashboardLayout from '../layouts/DashboardLayout.vue';
import NovoLancamentoModal from '../components/FluxoCaixa/NovoLancamentoModal.vue';
import ConfiguracaoModal from '../components/FluxoCaixa/ConfiguracaoModal.vue';
import DetalhesLancamentoModal from '../components/FluxoCaixa/DetalhesLancamentoModal.vue';

import { 
  Wallet, Building, Banknote, Plus, Download, Search, 
  Trash2, Edit2, Settings, Filter, ArrowUpCircle, ArrowDownCircle, 
  ChevronDown, Loader2, ArrowLeft, ArrowRight, Eye 
} from 'lucide-vue-next';

import transactionService from '../services/transactionService';
import settingsService from '../services/settingsService';
import checkService from '../services/checkService';

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
const saldos = ref({ bb: 0, caixa: 0, dinheiro: 0, total: 0 });
const chequesCarteiraTotal = ref(0);
const capitalInvestido = ref(0);

const filtros = reactive({
  texto: '',
  data: '',
  tipo: 'todos'
});

const carregarTabela = async () => {
  loading.value = true;
  try {
    const params = {
      page: currentPage.value,
      per_page: itemsPerPage,
      search: filtros.texto,
      date: filtros.data,
      type: filtros.tipo
    };

    const res = await transactionService.getAll(params);
    lancamentos.value = res.items;
    totalItems.value = res.total;
    totalPages.value = res.pages;
    if (res.summary) resumoFiltro.value = res.summary;

  } catch (error) {
    console.error("Erro ao carregar tabela:", error);
  } finally {
    loading.value = false;
  }
};

const carregarSaldos = async () => {
  try {
    const [resSaldos, resCheques, resSettings] = await Promise.all([
      transactionService.getBalances(),
      checkService.getPortfolioTotal(),
      settingsService.get()
    ]);
    saldos.value = resSaldos;
    chequesCarteiraTotal.value = resCheques.total_portfolio || 0;
    capitalInvestido.value = resSettings.capital_social || 0;
  } catch (e) { console.error("Erro saldos:", e); }
};

let timeoutSearch = null;
watch(() => filtros.texto, () => {
  clearTimeout(timeoutSearch);
  timeoutSearch = setTimeout(() => { currentPage.value = 1; carregarTabela(); }, 400);
});

watch([() => filtros.data, () => filtros.tipo], () => {
  currentPage.value = 1;
  carregarTabela();
});

const mudarPagina = (p) => {
  if (p >= 1 && p <= totalPages.value) {
    currentPage.value = p;
    carregarTabela();
  }
};

onMounted(() => {
  carregarTabela();
  carregarSaldos();
});

const abrirModalNovo = () => {
  lancamentoEmEdicao.value = null; 
  showModal.value = true;
};

const abrirModalEdicao = (item) => {
  lancamentoEmEdicao.value = { ...item }; 
  showModal.value = true;
};

const verDetalhes = (item) => {
  lancamentoParaDetalhes.value = item;
};

const salvarLancamento = async (dados) => {
  try {
    if (lancamentoEmEdicao.value && lancamentoEmEdicao.value.id) {
      await transactionService.update(lancamentoEmEdicao.value.id, dados);
    } else {
      await transactionService.create(dados);
    }
    showModal.value = false;
    lancamentoEmEdicao.value = null;
    await carregarTabela();
    await carregarSaldos(); 
  } catch (error) { 
    alert("Erro ao salvar. Verifique os dados."); 
    console.error(error);
  }
};

const excluirLancamento = async (id) => {
  if (!confirm('Tem certeza que deseja excluir este lançamento?')) return;
  try {
    await transactionService.delete(id);
    carregarTabela();
    carregarSaldos();
  } catch (error) { alert("Erro ao excluir."); }
};

const formatMoney = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const formatDate = (d) => d ? d.split('-').reverse().join('/') : '-';

const exportar = () => {
  isPrinting.value = true;
  nextTick(() => { window.print(); isPrinting.value = false; });
};
</script>

<template>
  <DashboardLayout>
    <NovoLancamentoModal 
      v-if="showModal" 
      :lancamento="lancamentoEmEdicao"
      @close="showModal = false" 
      @save="salvarLancamento" 
    />
    
    <ConfiguracaoModal 
      v-if="showConfigModal" 
      @close="showConfigModal = false" 
      @save="carregarSaldos" 
    />

    <DetalhesLancamentoModal 
      v-if="lancamentoParaDetalhes" 
      :lancamento="lancamentoParaDetalhes"
      @close="lancamentoParaDetalhes = null" 
    />

    <div class="print:hidden">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 class="text-3xl font-bold text-slate-900 tracking-tight">Fluxo de Caixa</h1>
          <div class="flex items-center gap-2 mt-1">
            <span class="text-xs flex items-center gap-1 text-slate-500 bg-slate-100 px-2 py-1 rounded">
               Total: <strong>{{ totalItems }}</strong> registros
            </span>
          </div>
        </div>
        <div class="flex gap-3">
          <button @click="showConfigModal = true" class="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-bold bg-indigo-50 px-3 py-2 rounded-lg transition-colors">
              <Settings class="w-4 h-4" /> Saldos Iniciais
          </button>
          <button @click="exportar" class="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2.5 rounded-lg font-bold shadow-sm flex items-center text-sm">
            <Download class="w-4 h-4 mr-2" /> Exportar
          </button>
          <button @click="abrirModalNovo" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-bold shadow-md shadow-indigo-200 flex items-center text-sm transition-transform active:scale-95">
            <Plus class="w-4 h-4 mr-2" /> Lançamento
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div class="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-5 rounded-xl shadow-lg md:col-span-1 relative overflow-hidden group">
          <div class="absolute right-0 top-0 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform"><Wallet class="w-32 h-32" /></div>
          <div class="flex items-center gap-3 mb-2 opacity-80"><Wallet class="w-5 h-5" /> <span class="text-xs font-bold uppercase tracking-wider">Saldo Disponível</span></div>
          <div class="text-2xl font-bold tracking-tight" :class="saldos.total < 0 ? 'text-red-300' : 'text-white'">{{ formatMoney(saldos.total) }}</div>
          <div class="mt-4 pt-4 border-t border-slate-700/50"><span class="text-xs text-slate-400">Total Geral (Bancos + Cofre)</span></div>
        </div>

        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
          <div class="flex items-center gap-3 mb-4 text-blue-600"><Building class="w-5 h-5" /> <span class="text-xs font-bold uppercase tracking-wider">Por Conta</span></div>
          <div class="space-y-3">
            <div class="flex justify-between items-center"><span class="text-xs text-slate-500 font-bold uppercase">BB</span><span class="text-sm font-bold font-mono" :class="saldos.bb < 0 ? 'text-red-600' : 'text-slate-700'">{{ formatMoney(saldos.bb) }}</span></div>
            <div class="flex justify-between items-center"><span class="text-xs text-slate-500 font-bold uppercase">Caixa</span><span class="text-sm font-bold font-mono" :class="saldos.caixa < 0 ? 'text-red-600' : 'text-slate-700'">{{ formatMoney(saldos.caixa) }}</span></div>
            <div class="flex justify-between items-center border-t border-slate-100 pt-2 mt-2"><span class="text-xs text-slate-500 font-bold uppercase">Dinheiro</span><span class="text-sm font-bold font-mono" :class="saldos.dinheiro < 0 ? 'text-red-600' : 'text-emerald-700'">{{ formatMoney(saldos.dinheiro) }}</span></div>
          </div>
        </div>

        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
          <div class="flex items-center gap-3 mb-4 text-emerald-600"><Banknote class="w-5 h-5" /> <span class="text-xs font-bold uppercase tracking-wider">Cheques Carteira</span></div>
          <div class="text-2xl font-bold text-slate-900 mb-1 tracking-tight">{{ formatMoney(chequesCarteiraTotal) }}</div>
          <div class="mt-3 text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded inline-block font-bold">Patrimônio: {{ formatMoney(saldos.total + chequesCarteiraTotal) }}</div>
        </div>

        <div class="bg-slate-50 p-5 rounded-xl border border-slate-200 flex flex-col justify-center">
          <span class="text-xs font-bold uppercase text-slate-400 mb-1">Capital Investido</span>
          <div class="text-xl font-bold text-slate-700">{{ formatMoney(capitalInvestido) }}</div>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col lg:flex-row gap-4 justify-between items-center">
          <div class="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <div class="relative w-full sm:w-64">
              <Search class="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input v-model="filtros.texto" type="text" placeholder="Buscar histórico..." class="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm" />
            </div>
            <div class="relative">
              <input v-model="filtros.data" type="date" class="w-full sm:w-auto pl-3 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600 font-medium shadow-sm" />
            </div>
            <div class="relative">
              <div class="absolute left-3 top-2.5 pointer-events-none"><Filter class="w-4 h-4 text-slate-400" /></div>
              <select v-model="filtros.tipo" class="w-full sm:w-auto pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 appearance-none font-bold text-slate-600 cursor-pointer shadow-sm">
                <option value="todos">Todos</option>
                <option value="entrada">Entradas</option>
                <option value="saida">Saídas</option>
              </select>
              <div class="absolute right-3 top-3 pointer-events-none"><ChevronDown class="w-3 h-3 text-slate-400" /></div>
            </div>
          </div>

          <div v-if="!loading" class="flex gap-4 text-sm bg-white px-4 py-2 rounded-lg border border-slate-100 shadow-sm w-full lg:w-auto justify-end">
            <div class="text-right"><div class="text-[10px] uppercase font-bold text-slate-400">Entradas</div><div class="font-bold text-emerald-600 text-xs sm:text-sm">+ {{ formatMoney(resumoFiltro.entradas) }}</div></div>
            <div class="text-right border-l border-slate-100 pl-4"><div class="text-[10px] uppercase font-bold text-slate-400">Saídas</div><div class="font-bold text-red-600 text-xs sm:text-sm">- {{ formatMoney(Math.abs(resumoFiltro.saidas)) }}</div></div>
            <div class="text-right border-l border-slate-100 pl-4"><div class="text-[10px] uppercase font-bold text-slate-400">Saldo Filtro</div><div class="font-bold text-xs sm:text-sm" :class="resumoFiltro.resultado >= 0 ? 'text-slate-800' : 'text-red-600'">{{ formatMoney(resumoFiltro.resultado) }}</div></div>
          </div>
        </div>

        <div class="overflow-x-auto min-h-[300px]">
          <table class="w-full text-left text-sm whitespace-nowrap">
            <thead class="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
              <tr>
                <th class="px-6 py-3 w-32">Data</th>
                <th class="px-6 py-3">Histórico / Descrição</th>
                <th class="px-6 py-3 w-40">Origem / Conta</th>
                <th class="px-6 py-3 text-right w-32">Entrada</th>
                <th class="px-6 py-3 text-right w-32">Saída</th>
                <th class="px-6 py-3 text-right w-24">Ações</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-if="loading">
                <td colspan="6" class="px-6 py-12 text-center text-slate-400"><Loader2 class="w-6 h-6 animate-spin mx-auto mb-2"/>Carregando dados...</td>
              </tr>
              <tr v-else-if="lancamentos.length === 0">
                <td colspan="6" class="px-6 py-12 text-center text-slate-400">Nenhum lançamento encontrado.</td>
              </tr>
              <tr v-else v-for="item in lancamentos" :key="item.id" class="group hover:bg-indigo-50/30 transition-colors">
                <td class="px-6 py-3 font-mono text-slate-600 text-xs">{{ formatDate(item.data) }}</td>
                <td class="px-6 py-3 font-medium text-slate-800 flex items-center gap-2">
                  <ArrowUpCircle v-if="item.tipo === 'entrada'" class="w-4 h-4 text-emerald-500" />
                  <ArrowDownCircle v-else class="w-4 h-4 text-red-500" />
                  {{ item.descricao }}
                </td>
                <td class="px-6 py-3">
                  <span class="text-[10px] font-bold px-2 py-1 rounded-full uppercase border" 
                    :class="{
                      'bg-blue-50 text-blue-700 border-blue-100': (item.origem || '').toLowerCase().includes('brasil') || (item.origem || '').toLowerCase().includes('bb'),
                      'bg-sky-50 text-sky-700 border-sky-100': (item.origem || '').toLowerCase().includes('caixa') || (item.origem || '').toLowerCase().includes('ce'),
                      'bg-emerald-50 text-emerald-700 border-emerald-100': !(item.origem || '').toLowerCase().includes('brasil') && !(item.origem || '').toLowerCase().includes('caixa')
                    }">
                    {{ item.origem || 'S/ Origem' }}
                  </span>
                </td>
                <td class="px-6 py-3 text-right font-bold text-emerald-600 bg-emerald-50/10">{{ item.tipo === 'entrada' ? formatMoney(item.valor) : '-' }}</td>
                <td class="px-6 py-3 text-right font-bold text-red-600 bg-red-50/10">{{ item.tipo === 'saida' ? formatMoney(item.valor) : '-' }}</td>
                <td class="px-6 py-3 text-right">
                  <div class="flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button @click="verDetalhes(item)" class="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"><Eye class="w-4 h-4" /></button>
                    <button @click="abrirModalEdicao(item)" class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"><Edit2 class="w-4 h-4" /></button>
                    <button @click="excluirLancamento(item.id)" class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 class="w-4 h-4" /></button>
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
        <div class="flex justify-between items-center mb-6 border-b border-black pb-4">
           <div>
             <h1 class="text-3xl font-bold">Relatório Financeiro</h1>
             <p class="text-sm text-gray-500">Fluxo de Caixa e Saldos</p>
           </div>
           <div class="text-right">
             <div class="text-sm font-bold">{{ new Date().toLocaleDateString('pt-BR') }}</div>
             <div class="text-xs">{{ new Date().toLocaleTimeString('pt-BR') }}</div>
           </div>
        </div>

        <div class="grid grid-cols-3 gap-6 mb-8 text-sm">
           
           <div class="border border-gray-300 p-3 rounded">
              <div class="font-bold text-gray-600 text-xs uppercase mb-1">Saldo Disponível</div>
              <div class="text-2xl font-bold mb-2">{{ formatMoney(saldos.total) }}</div>
              <div class="text-xs space-y-1 text-gray-500 border-t pt-1 mt-1">
                 <div class="flex justify-between"><span>BB</span> <span>{{ formatMoney(saldos.bb) }}</span></div>
                 <div class="flex justify-between"><span>Caixa</span> <span>{{ formatMoney(saldos.caixa) }}</span></div>
                 <div class="flex justify-between"><span>Dinheiro</span> <span>{{ formatMoney(saldos.dinheiro) }}</span></div>
              </div>
           </div>

           <div class="border border-gray-300 p-3 rounded">
              <div class="font-bold text-gray-600 text-xs uppercase mb-1">Cheques em Carteira</div>
              <div class="text-2xl font-bold mb-2">{{ formatMoney(chequesCarteiraTotal) }}</div>
              <div class="text-xs font-bold text-emerald-700 bg-emerald-50 p-1 rounded mt-2 text-center border border-emerald-100">
                Patrimônio: {{ formatMoney(saldos.total + chequesCarteiraTotal) }}
              </div>
           </div>

           <div class="border border-gray-300 p-3 rounded bg-gray-50">
              <div class="font-bold text-gray-600 text-xs uppercase mb-1">Resumo da Listagem</div>
              <div class="space-y-1 mt-2">
                <div class="flex justify-between"><span>Entradas:</span> <span class="font-bold text-emerald-600">{{ formatMoney(resumoFiltro.entradas) }}</span></div>
                <div class="flex justify-between"><span>Saídas:</span> <span class="font-bold text-red-600">{{ formatMoney(resumoFiltro.saidas) }}</span></div>
                <div class="flex justify-between border-t border-gray-300 pt-1 mt-1 font-bold text-base"><span>Resultado:</span> <span>{{ formatMoney(resumoFiltro.resultado) }}</span></div>
              </div>
           </div>
        </div>

        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="border-b-2 border-black">
              <th class="py-2 w-24">Data</th>
              <th class="py-2">Histórico</th>
              <th class="py-2 w-24 text-center">Origem</th>
              <th class="py-2 w-24 text-right">Entrada</th>
              <th class="py-2 w-24 text-right">Saída</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in lancamentos" :key="item.id" class="border-b border-gray-200">
              <td class="py-2">{{ formatDate(item.data) }}</td>
              <td class="py-2 pr-2">{{ item.descricao }}</td>
              <td class="py-2 text-center uppercase text-[10px]">{{ item.origem }}</td>
              <td class="py-2 text-right font-bold text-emerald-700">
                {{ item.tipo === 'entrada' ? formatMoney(item.valor) : '-' }}
              </td>
              <td class="py-2 text-right font-bold text-red-700">
                {{ item.tipo === 'saida' ? formatMoney(item.valor) : '-' }}
              </td>
            </tr>
          </tbody>
        </table>
        
        <div class="mt-8 pt-4 border-t border-black text-center text-xs text-gray-400">
           Relatório gerado pelo sistema - Página 1 de 1
        </div>
      </div>
    </div>
  </DashboardLayout>
</template>

<style>
@media print {
  body { background: white !important; }
  .print-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: white; z-index: 9999; padding: 10mm; }
  .print:hidden { display: none !important; }
}
</style>