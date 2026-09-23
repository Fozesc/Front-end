<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import DashboardLayout from '../layouts/DashboardLayout.vue';
import RelatorioModal from '../components/layout/RelatorioModal.vue';
import { 
  Wallet, TrendingUp, AlertTriangle, Calendar, FileText, Users, DollarSign, Activity, Download,
  CalendarClock, X
} from 'lucide-vue-next';

import {
  Chart as ChartJS,
  Title, Tooltip, Legend, BarElement,
  PointElement, LineElement, CategoryScale, LinearScale, ArcElement, Filler
} from 'chart.js';
import { Bar, Doughnut } from 'vue-chartjs';
import api from '../services/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, Filler);


const loading = ref(true);
const showReportModal = ref(false);
const chartPeriod = ref('meses');
const chartType = ref('lucro');

const kpis = ref({ capital: 0, lucro: 0, inadimplencia: 0, carteira: 0 });
const proximosVencimentos = ref([]);
const chartDataPie = ref([0, 0, 0, 0, 0]); 

// Aviso de vencimento: SO do dia de hoje, e some quando ele fecha. De proposito nao
// acumula os dias anteriores - aviso que cresce sozinho vira paisagem e ninguem le.
const vencemHoje = ref({ data: '', quantidade: 0, total: 0 });
const avisoDispensado = ref(false);

const CHAVE_AVISO = 'fozesc_aviso_vencimento';

const mostrarAvisoHoje = computed(() =>
  !avisoDispensado.value && vencemHoje.value.quantidade > 0
);

const dispensarAviso = () => {
  avisoDispensado.value = true;
  try { localStorage.setItem(CHAVE_AVISO, vencemHoje.value.data); } catch (e) { /* aba anonima */ }
};
const chartEvolution = ref({ labels: [], profit_data: [], cash_data: [] }); 


const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
const formatDate = (iso) => iso ? iso.split('-').reverse().join('/').slice(0, 5) : '-';


const fetchDashboard = async () => {
  loading.value = true;
  try {
    const { data } = await api.get(`/dashboard?period=${chartPeriod.value}`);
    kpis.value = data.kpis;
    proximosVencimentos.value = data.upcoming;
    vencemHoje.value = data.vencem_hoje || { data: '', quantidade: 0, total: 0 };
    try {
      avisoDispensado.value = localStorage.getItem(CHAVE_AVISO) === vencemHoje.value.data;
    } catch (e) {
      avisoDispensado.value = false;
    }
    chartDataPie.value = data.charts.pie_chart; 
   
    chartEvolution.value = {
        labels: data.charts.evolution.labels || [],
        profit_data: data.charts.evolution.profit_data || [],
        cash_data: data.charts.evolution.cash_data || []
    };
  } catch (error) {
    console.error("Erro dashboard:", error);
  } finally {
    loading.value = false;
  }
};

watch(chartPeriod, () => { fetchDashboard(); });
onMounted(() => { fetchDashboard(); });


const STATUS_CARTEIRA = [
  { nome: 'A Receber', cor: '#6366f1' },
  { nome: 'Recebido', cor: '#10b981' },
  { nome: 'Atrasado', cor: '#ef4444' },
  { nome: 'Devolvido', cor: '#f97316' },
  { nome: 'Jurídico', cor: '#a855f7' },
];

// Só o que tem valor. Antes a legenda listava as 5 situações mesmo com R$ 0,00,
// e o buraco da rosca ficava vazio no lugar onde cabe o total.
const fatiasCarteira = computed(() =>
  STATUS_CARTEIRA
    .map((s, i) => ({ ...s, valor: Number(chartDataPie.value[i] || 0) }))
    .filter(s => s.valor > 0)
);

const totalCarteira = computed(() => fatiasCarteira.value.reduce((t, s) => t + s.valor, 0));

const pct = (v) => (totalCarteira.value > 0 ? Math.round((v / totalCarteira.value) * 100) : 0);

const chartDataDoughnut = computed(() => ({
  labels: fatiasCarteira.value.map(s => s.nome),
  datasets: [{
    backgroundColor: fatiasCarteira.value.map(s => s.cor),
    data: fatiasCarteira.value.map(s => s.valor),
    borderWidth: 0,
    hoverOffset: 12
  }]
}));

const chartOptionsDoughnut = {
  responsive: true, 
  maintainAspectRatio: false,
  plugins: { 
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: function(context) {
          let label = context.label || '';
          let value = context.raw || 0;
          let total = context.chart._metasets[context.datasetIndex].total;
          let percentage = Math.round((value / total) * 100) + '%';
         
          let money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
          return `${label}: ${money} (${percentage})`;
        }
      }
    }
  },
  cutout: '65%'
};


const temDados = computed(() => chartEvolution.value.labels.length > 0);

// O que o gráfico do caixa mostra é a MOVIMENTAÇÃO do período (entradas - saídas),
// não o saldo acumulado. O rótulo antigo dizia "Saldo Líquido" e enganava: um mês
// sem movimento aparecia como saldo zero. Por isso virou barra, com o mês negativo
// em vermelho abaixo da linha do zero.
const serieLucro = () => ({
  type: 'line',
  label: 'Lucro (juros gerado)',
  data: chartEvolution.value.profit_data,
  borderColor: '#10b981',
  backgroundColor: (context) => {
    const ctx = context.chart.ctx;
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
    return gradient;
  },
  borderWidth: 3,
  pointBackgroundColor: '#fff',
  pointBorderColor: '#10b981',
  pointRadius: 3,
  fill: chartType.value === 'lucro',
  tension: 0.4,
  order: 0,
});

const serieCaixa = () => ({
  type: 'bar',
  label: 'Movimento do caixa',
  data: chartEvolution.value.cash_data,
  backgroundColor: chartEvolution.value.cash_data.map(v => (v < 0 ? '#fca5a5' : '#93c5fd')),
  borderColor: chartEvolution.value.cash_data.map(v => (v < 0 ? '#ef4444' : '#3b82f6')),
  borderWidth: 1,
  borderRadius: 4,
  order: 1,
});

const chartDataLine = computed(() => {
  const datasets = [];
  if (chartType.value !== 'caixa') datasets.push(serieLucro());
  if (chartType.value !== 'lucro') datasets.push(serieCaixa());
  return { labels: chartEvolution.value.labels, datasets };
});

// Total do período: o número que o gráfico desenha, escrito por extenso.
const totalPeriodo = computed(() => {
  const soma = (a) => (a || []).reduce((t, v) => t + Number(v || 0), 0);
  if (chartType.value === 'lucro') return soma(chartEvolution.value.profit_data);
  if (chartType.value === 'caixa') return soma(chartEvolution.value.cash_data);
  return soma(chartEvolution.value.profit_data);
});

const rotuloTotal = computed(() =>
  chartType.value === 'caixa' ? 'Movimento no período' : 'Juros gerado no período'
);

const chartOptionsLine = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { 
      legend: {
        display: true,
        position: 'bottom',
        labels: { usePointStyle: true, boxWidth: 8, font: { size: 11 } }
      },
      tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
              label: function(context) {
                  let value = context.raw;
                  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
              }
          }
      }
  },
  scales: {
    y: { 
      beginAtZero: false, 
      grid: { color: '#f1f5f9' }, 
      ticks: { 
          font: { size: 10 }, 
          color: '#94a3b8',
          callback: (value) => new Intl.NumberFormat('pt-BR', { notation: "compact" }).format(value)
      } 
    },
    x: { 
      grid: { display: false }, 
      ticks: { font: { size: 10 }, color: '#94a3b8' } 
    }
  }
};
</script>

<template>
  <DashboardLayout>
    <RelatorioModal v-if="showReportModal" @close="showReportModal = false" />

    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
      <div>
        <h1 class="text-3xl font-bold text-slate-900 tracking-tight">Visão Geral</h1>
        <p class="text-slate-500 text-sm">Resumo financeiro em tempo real.</p>
      </div>
      
      <div class="flex gap-3">
        <button @click="showReportModal = true" class="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-lg font-bold shadow-md shadow-indigo-200 flex items-center transition-all text-sm">
          <Download class="w-4 h-4 mr-2" /> Exportar Relatórios
        </button>
        <div class="bg-white px-4 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 flex items-center shadow-sm">
          <Calendar class="w-4 h-4 mr-2 text-indigo-500" /> {{ new Date().toLocaleDateString('pt-BR') }}
        </div>
      </div>
    </div>

    <div v-if="mostrarAvisoHoje" class="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-4">
      <div class="p-2.5 bg-amber-100 text-amber-700 rounded-xl shrink-0"><CalendarClock class="w-5 h-5" /></div>
      <div class="flex-1">
        <p class="font-bold text-amber-900 text-sm">
          {{ vencemHoje.quantidade === 1 ? '1 cheque vence hoje' : vencemHoje.quantidade + ' cheques vencem hoje' }}
          · {{ formatMoney(vencemHoje.total) }}
        </p>
        <p class="text-xs text-amber-700 mt-0.5">Só os de hoje. O que já venceu antes continua na tela de Títulos.</p>
      </div>
      <router-link to="/cheques" class="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg shrink-0">
        Ver títulos
      </router-link>
      <button @click="dispensarAviso" title="Não mostrar de novo hoje"
              class="p-2 text-amber-500 hover:text-amber-800 hover:bg-amber-100 rounded-lg shrink-0">
        <X class="w-4 h-4" />
      </button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
        <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Wallet class="w-16 h-16 text-slate-800" /></div>
        <div class="flex items-center gap-3 mb-2">
          <div class="p-2 bg-slate-100 rounded-lg text-slate-700"><Wallet class="w-5 h-5" /></div>
          <span class="text-xs font-bold text-slate-500 uppercase">Capital Social</span>
        </div>
        <div class="text-2xl font-bold text-slate-900">{{ formatMoney(kpis.capital) }}</div>
      </div>

      <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
        <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><TrendingUp class="w-16 h-16 text-emerald-600" /></div>
        <div class="flex items-center gap-3 mb-2">
          <div class="p-2 bg-emerald-50 rounded-lg text-emerald-600"><TrendingUp class="w-5 h-5" /></div>
          <span class="text-xs font-bold text-slate-500 uppercase">Lucro Acumulado</span>
        </div>
        <div class="text-2xl font-bold text-slate-900">{{ formatMoney(kpis.lucro) }}</div>
        <div class="text-xs text-emerald-600 font-medium flex items-center mt-1">Juros de cheques já pagos</div>
      </div>

      <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
        <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><DollarSign class="w-16 h-16 text-indigo-600" /></div>
        <div class="flex items-center gap-3 mb-2">
          <div class="p-2 bg-indigo-50 rounded-lg text-indigo-600"><DollarSign class="w-5 h-5" /></div>
          <span class="text-xs font-bold text-slate-500 uppercase">Em Carteira</span>
        </div>
        <div class="text-2xl font-bold text-slate-900">{{ formatMoney(kpis.carteira) }}</div>
        <div class="text-xs text-slate-400 font-medium mt-1">A receber</div>
      </div>

      <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
        <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><AlertTriangle class="w-16 h-16 text-red-600" /></div>
        <div class="flex items-center gap-3 mb-2">
          <div class="p-2 bg-red-50 rounded-lg text-red-600"><AlertTriangle class="w-5 h-5" /></div>
          <span class="text-xs font-bold text-slate-500 uppercase">Inadimplência</span>
        </div>
        <div class="text-2xl font-bold text-slate-900">{{ formatMoney(kpis.inadimplencia) }}</div>
        <div class="text-xs text-red-500 font-medium mt-1">Atrasados + Devolvidos</div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      
      <div class="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <div class="flex bg-slate-100 p-1 rounded-xl">
              <button @click="chartType = 'lucro'" class="px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2" :class="chartType === 'lucro' ? 'bg-white shadow text-emerald-600' : 'text-slate-500 hover:text-slate-700'">
                <TrendingUp class="w-3 h-3" /> Lucro (Juros)
              </button>
              <button @click="chartType = 'caixa'" class="px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2" :class="chartType === 'caixa' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'">
                <Activity class="w-3 h-3" /> Caixa
              </button>
              <button @click="chartType = 'ambos'" class="px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2" :class="chartType === 'ambos' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'">
                <Activity class="w-3 h-3" /> Os dois
              </button>
            </div>
            <div v-if="chartType !== 'ambos'" class="mt-2 ml-1">
              <span class="text-[10px] font-bold uppercase tracking-wide text-slate-400">{{ rotuloTotal }}</span>
              <div class="text-xl font-bold" :class="totalPeriodo < 0 ? 'text-red-600' : 'text-slate-800'">{{ formatMoney(totalPeriodo) }}</div>
            </div>
          </div>
          <div class="flex bg-slate-100 p-1 rounded-lg">
            <button @click="chartPeriod = 'dias'" class="px-3 py-1 text-xs font-bold rounded-md transition-all" :class="chartPeriod === 'dias' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'">Dias</button>
            <button @click="chartPeriod = 'semanas'" class="px-3 py-1 text-xs font-bold rounded-md transition-all" :class="chartPeriod === 'semanas' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'">Semanas</button>
            <button @click="chartPeriod = 'meses'" class="px-3 py-1 text-xs font-bold rounded-md transition-all" :class="chartPeriod === 'meses' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'">12 Meses</button>
          </div>
        </div>
        <div class="flex-1 min-h-[250px] relative">
          <Bar v-if="temDados" :data="chartDataLine" :options="chartOptionsLine" />
          <div v-else class="absolute inset-0 flex flex-col items-center justify-center text-slate-400 text-sm">
            <Activity class="w-8 h-8 mb-2 opacity-40" />
            Nenhum movimento neste período.
          </div>
        </div>
      </div>

      <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
        <h3 class="font-bold text-slate-800 mb-4 flex items-center gap-2"><Users class="w-5 h-5 text-indigo-500" /> Status da Carteira</h3>
        
        <div class="flex-1 flex items-center justify-center relative min-h-[180px]">
          <Doughnut v-if="totalCarteira > 0" :data="chartDataDoughnut" :options="chartOptionsDoughnut" />
          <div v-if="totalCarteira > 0" class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span class="text-[10px] font-bold uppercase tracking-wide text-slate-400">Total</span>
            <span class="text-lg font-bold text-slate-800">{{ formatMoney(totalCarteira) }}</span>
          </div>
          <div v-else class="text-slate-400 text-sm">Nenhum título na carteira.</div>
        </div>

        <div v-if="totalCarteira > 0" class="mt-4 space-y-1.5">
          <div v-for="s in fatiasCarteira" :key="s.nome" class="flex items-center justify-between text-xs">
            <span class="flex items-center gap-2 text-slate-600 font-medium">
              <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: s.cor }"></span>
              {{ s.nome }}
            </span>
            <span class="font-bold text-slate-800">{{ formatMoney(s.valor) }} <span class="text-slate-400 font-medium">({{ pct(s.valor) }}%)</span></span>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 class="font-bold text-slate-800 flex items-center gap-2"><Calendar class="w-4 h-4 text-orange-500" /> Próximos Vencimentos</h3>
          <router-link to="/cheques" class="text-xs font-bold text-indigo-600 hover:text-indigo-800">Ver todos</router-link>
        </div>
        <div class="divide-y divide-slate-100">
          <div v-if="proximosVencimentos.length === 0" class="p-6 text-center text-slate-400 text-sm italic">Nenhum vencimento próximo.</div>
          <div v-for="item in proximosVencimentos" :key="item.id" class="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
            <div class="flex items-center gap-3">
              <div class="bg-orange-100 text-orange-700 font-bold text-xs p-2 rounded-lg text-center w-12">{{ formatDate(item.data) }}</div>
              <div>
                <div class="font-bold text-slate-800 text-sm">{{ item.cliente }}</div>
                <div class="text-xs text-slate-500">{{ item.banco || 'Banco N/A' }}</div>
              </div>
            </div>
            <div class="font-bold text-slate-900 text-sm">{{ formatMoney(item.valor) }}</div>
          </div>
        </div>
      </div>

      <div class="bg-indigo-900 rounded-2xl shadow-lg border border-indigo-800 p-6 text-white relative overflow-hidden">
        <div class="absolute -right-10 -bottom-10 opacity-10"><FileText class="w-48 h-48" /></div>
        <h3 class="font-bold text-lg mb-1 relative z-10">Ações Rápidas</h3>
        <p class="text-indigo-200 text-sm mb-6 relative z-10">O que você deseja fazer agora?</p>
        
        <div class="grid grid-cols-2 gap-4 relative z-10">
          <router-link to="/bordero" class="bg-white/10 hover:bg-white/20 border border-white/10 p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all cursor-pointer">
            <FileText class="w-6 h-6 text-emerald-400" /><span class="font-bold text-sm">Novo Borderô</span>
          </router-link>
          <router-link to="/clientes" class="bg-white/10 hover:bg-white/20 border border-white/10 p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all cursor-pointer">
            <Users class="w-6 h-6 text-blue-400" /><span class="font-bold text-sm">Novo Cliente</span>
          </router-link>
          <router-link to="/fluxo-caixa" class="bg-white/10 hover:bg-white/20 border border-white/10 p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all cursor-pointer">
            <DollarSign class="w-6 h-6 text-amber-400" /><span class="font-bold text-sm">Lançar Despesa</span>
          </router-link>
          
          <div @click="showReportModal = true" class="bg-white/10 hover:bg-white/20 border border-white/10 p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all cursor-pointer">
            <TrendingUp class="w-6 h-6 text-indigo-300" />
            <span class="font-bold text-sm">Relatórios</span>
          </div>
        </div>
      </div>
    </div>
  </DashboardLayout>
</template>