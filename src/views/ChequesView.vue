<script setup>
import { ref, computed, reactive } from 'vue';
import { useRouter } from 'vue-router'; // Importado para navegar para o Borderô
import DashboardLayout from '../layouts/DashboardLayout.vue';
// Seu caminho personalizado do formulário:
import ChequeForm from '../components/layout/finance/ChequeForm.vue'; 
import { Search, Filter, Plus, MoreVertical, Download, RotateCcw, Calculator } from 'lucide-vue-next';

const router = useRouter(); // Instância do roteador
const showModal = ref(false);
const showFilters = ref(true);

const filters = reactive({
  buscaGlobal: '',
  status: ['Em Carteira', 'Atrasado', 'Jurídico'], 
  cliente: '', emitente: '', destino: '', dataVencInicio: '', dataVencFim: '',
});

const statusOptions = ['Em Carteira', 'Atrasado', 'Jurídico', 'Pago'];

const cheques = ref([
  { id: 1, vencimento: '2022-10-02', cliente: 'Mari de Quadros', banco: 'Santander', emitente: 'Rodrigo Ivan Vicari', num_doc: '38', valor_liquido: 8538.08, juros: 1461.92, dt_operacao: '2021-09-12', status: 'Pago', destino: 'Sicoob Conta Mestra', dt_pagamento: '2022-10-02', observacao: 'Pgto via TED Confirmado' },
  { id: 2, vencimento: '2022-11-15', cliente: 'João Silva Construções', banco: 'Bradesco', emitente: 'Construtora Alfa', num_doc: '102', valor_liquido: 4500.00, juros: 500.00, dt_operacao: '2022-10-10', status: 'Atrasado', destino: 'Inter PJ', dt_pagamento: null, observacao: 'Cliente pediu prorrogação' },
]);

const filteredCheques = computed(() => {
  return cheques.value.filter(c => {
    if (!filters.status.includes(c.status)) return false;
    const searchLower = filters.buscaGlobal.toLowerCase();
    const globalMatch = c.cliente.toLowerCase().includes(searchLower) || c.emitente.toLowerCase().includes(searchLower) || c.num_doc.includes(searchLower) || c.observacao.toLowerCase().includes(searchLower);
    if (!globalMatch) return false;
    if (filters.cliente && !c.cliente.toLowerCase().includes(filters.cliente.toLowerCase())) return false;
    if (filters.emitente && !c.emitente.toLowerCase().includes(filters.emitente.toLowerCase())) return false;
    if (filters.destino && !c.destino.toLowerCase().includes(filters.destino.toLowerCase())) return false;
    if (filters.dataVencInicio && c.vencimento < filters.dataVencInicio) return false;
    if (filters.dataVencFim && c.vencimento > filters.dataVencFim) return false;
    return true;
  });
});

const addCheque = (novoChequeData) => { cheques.value.unshift(novoChequeData); showModal.value = false; };
const toggleStatusFilter = (status) => { if (filters.status.includes(status)) filters.status = filters.status.filter(s => s !== status); else filters.status.push(status); };
const resetFilters = () => { filters.buscaGlobal = ''; filters.status = ['Em Carteira', 'Atrasado', 'Jurídico']; filters.cliente = ''; filters.emitente = ''; filters.destino = ''; filters.dataVencInicio = ''; filters.dataVencFim = ''; };
const exportCSV = () => { /* Logica Export */ };
const formatDate = (d) => d ? d.split('-').reverse().join('/') : '-';
const formatCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const getStatusColor = (s) => {
  if (s === 'Atrasado' || s === 'Jurídico') return 'bg-red-100 text-red-700 border-red-200'; 
  if (s === 'Pago') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  return 'bg-blue-50 text-blue-700 border-blue-200';
};
</script>

<template>
  <DashboardLayout>
    <div class="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h1 class="text-3xl font-bold text-slate-900 tracking-tight">Gerenciamento de Cheques</h1>
        <div class="flex items-center gap-2 mt-1">
          <span class="text-slate-500 text-sm">Mostrando {{ filteredCheques.length }} registros</span>
          <span v-if="!filters.status.includes('Pago')" class="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">Ocultando Pagos</span>
        </div>
      </div>
      
      <div class="flex gap-3">
        <button @click="showFilters = !showFilters" :class="showFilters ? 'bg-slate-200 text-slate-800' : 'bg-white text-slate-600'" class="px-4 py-2.5 rounded-lg border border-slate-300 font-medium hover:bg-slate-100 transition-colors flex items-center">
          <Filter class="w-4 h-4 mr-2" /> Filtros
        </button>
        
        <button @click="exportCSV" class="bg-white text-slate-700 border border-slate-300 px-4 py-2.5 rounded-lg font-medium hover:bg-slate-50 transition-colors flex items-center shadow-sm">
          <Download class="w-4 h-4 mr-2" /> Exportar
        </button>

        <button @click="router.push('/bordero')" class="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-lg font-bold shadow-md transition-all flex items-center hover:-translate-y-0.5">
          <Calculator class="w-4 h-4 mr-2" /> Novo Borderô
        </button>

        <button @click="showModal = true" class="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-bold shadow-md shadow-emerald-200 transition-all flex items-center hover:-translate-y-0.5">
          <Plus class="w-5 h-5 mr-2" /> Novo Cheque
        </button>
      </div>
    </div>

    <div v-if="showFilters" class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 mb-6 animate-fade-in-down">
      <div class="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
        <h3 class="text-xs font-bold text-emerald-600 uppercase tracking-widest flex items-center"><Filter class="w-3 h-3 mr-1.5" /> Filtragem Avançada</h3>
        <button @click="resetFilters" class="text-xs text-slate-400 hover:text-emerald-600 flex items-center transition-colors font-medium group"><RotateCcw class="w-3.5 h-3.5 mr-1.5 group-hover:-rotate-180 transition-transform duration-500" /> Restaurar Padrão</button>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4">
        
        <div class="md:col-span-2">
          <label class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Busca Rápida</label>
          <div class="relative"><Search class="w-4 h-4 text-slate-400 absolute left-3 top-2.5" /><input v-model="filters.buscaGlobal" type="text" placeholder="Nome, Doc ou Obs..." class="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" /></div>
        </div>

        <div class="md:col-span-4 lg:col-span-4">
          <label class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Status</label>
          <div class="flex flex-wrap gap-2">
            <button v-for="status in statusOptions" :key="status" @click="toggleStatusFilter(status)" class="flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-all border select-none" :class="filters.status.includes(status) ? 'bg-emerald-100 text-emerald-800 border-emerald-300 shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300 opacity-60'">
              {{ status }}
            </button>
          </div>
        </div>

        <div class="md:col-span-2"><label class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Cliente / Emitente</label><input v-model="filters.cliente" type="text" class="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm outline-none focus:border-emerald-500" /></div>
        <div class="md:col-span-1"><label class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">De</label><input v-model="filters.dataVencInicio" type="date" class="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm outline-none focus:border-emerald-500" /></div>
        <div class="md:col-span-1"><label class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Até</label><input v-model="filters.dataVencFim" type="date" class="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm outline-none focus:border-emerald-500" /></div>
        <div class="md:col-span-2"><label class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Destino</label><input v-model="filters.destino" type="text" class="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm outline-none focus:border-emerald-500" /></div>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div class="overflow-x-auto min-h-[400px]">
        <table class="w-full text-left whitespace-nowrap">
          <thead class="bg-slate-50 border-b border-slate-200">
            <tr>
              <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Vencimento</th>
              <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Cliente / Emitente</th>
              <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Banco / Doc</th>
              <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Valores</th>
              <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Destino</th>
              <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">Status</th>
              <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Obs</th>
              <th class="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="cheque in filteredCheques" :key="cheque.id" class="bg-white even:bg-slate-50 hover:bg-slate-100 transition-colors">
              <td class="px-6 py-4 text-sm font-bold text-slate-700">{{ formatDate(cheque.vencimento) }}<div class="text-[10px] font-normal text-slate-400">Op: {{ formatDate(cheque.dt_operacao) }}</div></td>
              <td class="px-6 py-4"><div class="text-sm font-bold text-slate-900">{{ cheque.cliente }}</div><div class="text-xs text-slate-500">{{ cheque.emitente }}</div></td>
              <td class="px-6 py-4"><div class="text-sm text-slate-700">{{ cheque.banco }}</div><div class="text-xs text-slate-400">Doc: {{ cheque.num_doc }}</div></td>
              <td class="px-6 py-4 text-right"><div class="text-sm font-bold text-emerald-600">{{ formatCurrency(cheque.valor_liquido) }}</div><div class="text-[10px] text-slate-400">Juros: {{ formatCurrency(cheque.juros) }}</div></td>
              <td class="px-6 py-4 text-sm text-slate-600">{{ cheque.destino }}</td>
              <td class="px-6 py-4 text-center"><span :class="['px-2.5 py-1 rounded-full text-xs font-bold border', getStatusColor(cheque.status)]">{{ cheque.status }}</span></td>
              <td class="px-6 py-4 text-sm text-slate-500 max-w-[150px] truncate" :title="cheque.observacao">{{ cheque.observacao }}</td>
              <td class="px-6 py-4 text-right"><button class="text-slate-300 hover:text-emerald-600 transition-colors"><MoreVertical class="w-5 h-5" /></button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <ChequeForm v-if="showModal" @close="showModal = false" @save="addCheque" />
  </DashboardLayout>
</template>

<style scoped>
.animate-fade-in-down { animation: fadeInDown 0.3s ease-out forwards; }
</style>