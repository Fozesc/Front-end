<script setup>
import { ref, computed } from 'vue';
import DashboardLayout from '../layouts/DashboardLayout.vue';
import NovoLancamentoModal from '../components/FluxoCaixa/NovoLancamentoModal.vue';
import { 
  TrendingUp, TrendingDown, Wallet, Building, 
  Banknote, Plus, Calendar, Download, Search, Filter,
  Edit2, Trash2 
} from 'lucide-vue-next';

// --- ESTADOS ---
const showModal = ref(false);
const filtroTexto = ref('');
const filtroData = ref('');

// --- DADOS PATRIMONIAIS (MOCKADOS) ---
const patrimonio = ref({
  capital: 1135000.00,
  efetivo: 4617.50, // Dinheiro vivo
  banco_bb: 21353.65,
  caixa_economica: 28090.60,
  vales: 0.00,
  cheques_carteira: 1170645.14 
});

// Saldo Total Disponível
const saldoCaixa = computed(() => {
  return patrimonio.value.efetivo + patrimonio.value.banco_bb + patrimonio.value.caixa_economica;
});

// --- LANÇAMENTOS (MOCKADOS) ---
const lancamentos = ref([
  { id: 1, data: '2025-01-06', descricao: 'Empréstimo Selma Maria', valor: 995.00, tipo: 'saida', origem: 'Sistema (Borderô)' },
  { id: 2, data: '2025-01-06', descricao: 'Empréstimo Mercado Mais Você', valor: 1813.00, tipo: 'saida', origem: 'Sistema (Borderô)' },
  { id: 3, data: '2025-01-06', descricao: 'Compra pilha controle', valor: 15.00, tipo: 'saida', origem: 'Manual' },
  { id: 4, data: '2025-01-07', descricao: 'Recebimento Juros Cheque Devolvido', valor: 65.00, tipo: 'entrada', origem: 'Manual' },
  { id: 5, data: '2025-01-07', descricao: 'Empréstimo Jefferson Correa', valor: 296.00, tipo: 'saida', origem: 'Sistema (Borderô)' },
  { id: 6, data: '2025-01-31', descricao: 'Pg. DARF - IOF 21.01 a 31.01', valor: 42.01, tipo: 'saida', origem: 'Manual' },
  { id: 7, data: '2025-01-31', descricao: 'Compra de 2 resmas de papel', valor: 81.50, tipo: 'saida', origem: 'Manual' },
]);

// --- LÓGICA DE FILTRO AVANÇADA ---
const lancamentosFiltrados = computed(() => {
  return lancamentos.value.filter(l => {
    // Busca inteligente: procura na descrição, na origem ou no valor
    const termo = filtroTexto.value.toLowerCase();
    const valorString = l.valor.toString();
    
    const matchTexto = 
      l.descricao.toLowerCase().includes(termo) || 
      l.origem.toLowerCase().includes(termo) ||
      valorString.includes(termo);

    const matchData = !filtroData.value || l.data === filtroData.value;
    
    return matchTexto && matchData;
  }).sort((a, b) => new Date(b.data) - new Date(a.data)); // Ordena do mais recente
});

// Totais baseados no filtro atual
const totaisPeriodo = computed(() => {
  return lancamentosFiltrados.value.reduce((acc, item) => {
    if (item.tipo === 'entrada') acc.entradas += item.valor;
    else acc.saidas += item.valor;
    acc.saldo = acc.entradas - acc.saidas;
    return acc;
  }, { entradas: 0, saidas: 0, saldo: 0 });
});

// --- AÇÕES ---
const adicionarLancamentoManual = (novo) => {
  lancamentos.value.unshift(novo);
  if(novo.tipo === 'saida') patrimonio.value.efetivo -= novo.valor;
  else patrimonio.value.efetivo += novo.valor;
};

const editarLancamento = (lancamento) => {
  // Futuramente isso abrirá o modal preenchido
  alert(`Editar lançamento: ${lancamento.descricao}`);
};

const excluirLancamento = (id) => {
  if (confirm('Tem certeza que deseja excluir este lançamento?')) {
    lancamentos.value = lancamentos.value.filter(l => l.id !== id);
  }
};

// Utils
const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
const formatDate = (iso) => iso.split('-').reverse().join('/');
</script>

<template>
  <DashboardLayout>
    
    <NovoLancamentoModal v-if="showModal" @close="showModal = false" @save="adicionarLancamentoManual" />

    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
      <div>
        <h1 class="text-3xl font-bold text-slate-900 tracking-tight">Fluxo de Caixa e Balanço</h1>
        <p class="text-slate-500 text-sm">Controle de caixa diário e resumo patrimonial.</p>
      </div>
      <div class="flex gap-3">
        <button class="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2.5 rounded-lg font-bold shadow-sm flex items-center transition-all">
          <Download class="w-5 h-5 mr-2" /> Exportar Relatório
        </button>
        <button @click="showModal = true" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-bold shadow-md shadow-indigo-200 flex items-center transition-all">
          <Plus class="w-5 h-5 mr-2" /> Lançamento Manual
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <div class="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-5 rounded-xl shadow-lg md:col-span-1">
        <div class="flex items-center gap-3 mb-2 opacity-80">
          <Wallet class="w-5 h-5" /> <span class="text-xs font-bold uppercase tracking-wider">Saldo em Caixa (Disp)</span>
        </div>
        <div class="text-2xl font-bold">{{ formatMoney(saldoCaixa) }}</div>
        <div class="mt-4 pt-4 border-t border-slate-700 grid grid-cols-2 gap-2 text-xs">
          <div>
            <span class="block text-slate-400">Efetivo (Dinheiro)</span>
            <span class="font-bold">{{ formatMoney(patrimonio.efetivo) }}</span>
          </div>
          <div>
            <span class="block text-slate-400">Vales</span>
            <span class="font-bold">{{ formatMoney(patrimonio.vales) }}</span>
          </div>
        </div>
      </div>

      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <div class="flex items-center gap-3 mb-4 text-blue-600">
          <Building class="w-5 h-5" /> <span class="text-xs font-bold uppercase tracking-wider">Saldos Bancários</span>
        </div>
        <div class="space-y-3">
          <div class="flex justify-between items-center">
            <span class="text-sm text-slate-600 font-medium">Banco do Brasil</span>
            <span class="text-sm font-bold text-slate-900">{{ formatMoney(patrimonio.banco_bb) }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm text-slate-600 font-medium">Caixa Econômica</span>
            <span class="text-sm font-bold text-slate-900">{{ formatMoney(patrimonio.caixa_economica) }}</span>
          </div>
        </div>
      </div>

      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <div class="flex items-center gap-3 mb-4 text-emerald-600">
          <Banknote class="w-5 h-5" /> <span class="text-xs font-bold uppercase tracking-wider">Cheques em Carteira</span>
        </div>
        <div class="text-2xl font-bold text-slate-900 mb-1">{{ formatMoney(patrimonio.cheques_carteira) }}</div>
        <div class="text-xs text-slate-500">Total Documentos a compensar</div>
        <div class="mt-3 text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded inline-block font-bold">
          Patrimônio Total: {{ formatMoney(saldoCaixa + patrimonio.cheques_carteira) }}
        </div>
      </div>

      <div class="bg-slate-50 p-5 rounded-xl border border-slate-200 flex flex-col justify-center">
        <span class="text-xs font-bold uppercase text-slate-400 mb-1">Capital Investido</span>
        <div class="text-xl font-bold text-slate-700">{{ formatMoney(patrimonio.capital) }}</div>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      
      <div class="p-4 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/50">
        
        <div class="flex gap-3 w-full md:w-auto">
          <div class="relative flex-1 md:w-64">
            <Search class="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input v-model="filtroTexto" type="text" placeholder="Buscar histórico, origem ou valor..." class="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
          <div class="relative">
            <input v-model="filtroData" type="date" class="pl-3 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500 text-slate-600 font-medium" />
          </div>
        </div>

        <div class="flex gap-6 text-sm">
          <div class="flex flex-col items-end">
            <span class="text-[10px] uppercase font-bold text-slate-400">Total Entradas</span>
            <span class="font-bold text-emerald-600">+ {{ formatMoney(totaisPeriodo.entradas) }}</span>
          </div>
          <div class="flex flex-col items-end">
            <span class="text-[10px] uppercase font-bold text-slate-400">Total Saídas</span>
            <span class="font-bold text-red-600">- {{ formatMoney(totaisPeriodo.saidas) }}</span>
          </div>
          <div class="flex flex-col items-end border-l border-slate-300 pl-6">
            <span class="text-[10px] uppercase font-bold text-slate-400">Saldo Período</span>
            <span class="font-bold" :class="totaisPeriodo.saldo >= 0 ? 'text-slate-800' : 'text-red-600'">{{ formatMoney(totaisPeriodo.saldo) }}</span>
          </div>
        </div>
      </div>

      <div class="overflow-x-auto min-h-[300px]">
        <table class="w-full text-left text-sm whitespace-nowrap">
          <thead class="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
            <tr>
              <th class="px-6 py-3">Data</th>
              <th class="px-6 py-3">Histórico / Descrição</th>
              <th class="px-6 py-3">Origem</th>
              <th class="px-6 py-3 text-right">Entrada</th>
              <th class="px-6 py-3 text-right">Saída</th>
              <th class="px-6 py-3 text-right w-20">Ações</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="item in lancamentosFiltrados" :key="item.id" class="group hover:bg-slate-50 transition-colors">
              <td class="px-6 py-3 font-mono text-slate-600">{{ formatDate(item.data) }}</td>
              <td class="px-6 py-3 font-medium text-slate-800">{{ item.descricao }}</td>
              <td class="px-6 py-3">
                <span class="text-[10px] font-bold px-2 py-1 rounded-full uppercase"
                  :class="item.origem.includes('Sistema') ? 'bg-indigo-50 text-indigo-600' : 'bg-orange-50 text-orange-600'">
                  {{ item.origem }}
                </span>
              </td>
              <td class="px-6 py-3 text-right font-bold text-emerald-600">
                {{ item.tipo === 'entrada' ? formatMoney(item.valor) : '-' }}
              </td>
              <td class="px-6 py-3 text-right font-bold text-red-600">
                {{ item.tipo === 'saida' ? formatMoney(item.valor) : '-' }}
              </td>
              
              <td class="px-6 py-3 text-right">
                <div class="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    @click="editarLancamento(item)" 
                    class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" 
                    title="Editar">
                    <Edit2 class="w-4 h-4" />
                  </button>
                  <button 
                    @click="excluirLancamento(item.id)" 
                    class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" 
                    title="Excluir">
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="lancamentosFiltrados.length === 0">
              <td colspan="6" class="px-6 py-12 text-center text-slate-400 italic">Nenhum lançamento encontrado para este filtro.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </DashboardLayout>
</template>