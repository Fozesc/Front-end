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
ChartJS.defaults.font.family = "'Inter', ui-sans-serif, system-ui, sans-serif";
ChartJS.defaults.color = '#64748b';
Object.assign(ChartJS.defaults.plugins.tooltip, {
  backgroundColor: '#0f172a', padding: 10, cornerRadius: 8, boxPadding: 4,
  titleFont: { weight: '600', size: 12 }, bodyFont: { size: 12 }
});


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
    if (!data?.kpis) throw new Error('resposta inesperada do servidor');
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
    borderWidth: 2,
    borderColor: '#ffffff',
    borderRadius: 4,
    hoverOffset: 6
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
  cutout: '74%'
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
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.22)');
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
    return gradient;
  },
  borderWidth: 2.5,
  pointBackgroundColor: '#fff',
  pointBorderColor: '#10b981',
  pointBorderWidth: 2,
  pointRadius: 0,
  pointHoverRadius: 5,
  fill: chartType.value === 'lucro',
  tension: 0.4,
  order: 0,
});

const serieCaixa = () => ({
  type: 'bar',
  label: 'Movimento do caixa',
  data: chartEvolution.value.cash_data,
  backgroundColor: chartEvolution.value.cash_data.map(v => (v < 0 ? '#f87171' : '#818cf8')),
  borderWidth: 0,
  borderRadius: 6,
  maxBarThickness: 28,
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
        labels: { usePointStyle: true, boxWidth: 6, boxHeight: 6, padding: 16, font: { size: 12 } }
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
      border: { display: false },
      ticks: { 
          font: { size: 11 }, 
          color: '#94a3b8',
          padding: 8,
          callback: (value) => new Intl.NumberFormat('pt-BR', { notation: "compact" }).format(value)
      } 
    },
    x: { 
      grid: { display: false },
      border: { display: false },
      ticks: { font: { size: 11 }, color: '#94a3b8' } 
    }
  }
};
</script>

<template>
  <DashboardLayout>
    <RelatorioModal v-if="showReportModal" @close="showReportModal = false" />

    <div class="flex flex-col md:flex-row justify-between items-start md:items-end mb-7 gap-4">
      <div>
        <h1 class="text-2xl font-semibold text-slate-900 tracking-tight">Visão Geral</h1>
        <p class="text-slate-500 text-sm mt-1">Resumo financeiro em tempo real.</p>
      </div>

      <div class="flex gap-2.5">
        <div class="bg-white h-9 px-3.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 flex items-center shadow-xs">
          <Calendar class="w-4 h-4 mr-2 text-slate-400" /> {{ new Date().toLocaleDateString('pt-BR') }}
        </div>
        <button @click="showReportModal = true" class="bg-indigo-600 text-white hover:bg-indigo-700 h-9 px-3.5 rounded-lg font-semibold shadow-xs ring-1 ring-inset ring-white/10 flex items-center transition-colors text-sm">
          <Download class="w-4 h-4 mr-2" /> Exportar relatórios
        </button>
      </div>
    </div>

    <div v-if="mostrarAvisoHoje" class="mb-6 bg-amber-50 border border-amber-200/80 rounded-xl p-4 flex items-center gap-4 shadow-xs">
      <div class="w-10 h-10 bg-white text-amber-600 rounded-lg ring-1 ring-inset ring-amber-200 flex items-center justify-center shrink-0"><CalendarClock class="w-5 h-5" /></div>
      <div class="flex-1">
        <p class="font-semibold text-amber-900 text-sm">
          {{ vencemHoje.quantidade === 1 ? '1 cheque vence hoje' : vencemHoje.quantidade + ' cheques vencem hoje' }}
          · {{ formatMoney(vencemHoje.total) }}
        </p>
        <p class="text-[13px] text-amber-700 mt-0.5">Só os de hoje. O que já venceu antes continua na tela de Títulos.</p>
      </div>
      <router-link to="/cheques" class="h-8 px-3.5 inline-flex items-center bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-xs shrink-0 transition-colors">
        Ver títulos
      </router-link>
      <button @click="dispensarAviso" title="Não mostrar de novo hoje"
              class="p-2 text-amber-500 hover:text-amber-800 hover:bg-amber-100 rounded-lg shrink-0">
        <X class="w-4 h-4" />
      </button>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6" data-campo="kpis">
      <div class="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200 flex items-center justify-center"><Wallet class="w-[18px] h-[18px]" /></div>
          <span class="text-sm font-medium text-slate-500">Capital social</span>
        </div>
        <div class="mt-4 text-xl xl:text-2xl font-semibold text-slate-900 tracking-tight tabular-nums truncate">{{ formatMoney(kpis.capital) }}</div>
        <div class="text-xs text-slate-500 mt-1">valor investido</div>
      </div>
      <div class="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100 flex items-center justify-center"><TrendingUp class="w-[18px] h-[18px]" /></div>
          <span class="text-sm font-medium text-slate-500">Lucro acumulado</span>
        </div>
        <div class="mt-4 text-xl xl:text-2xl font-semibold text-slate-900 tracking-tight tabular-nums truncate">{{ formatMoney(kpis.lucro) }}</div>
        <div class="text-xs text-slate-500 mt-1">juros de cheques já pagos</div>
      </div>
      <div class="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100 flex items-center justify-center"><DollarSign class="w-[18px] h-[18px]" /></div>
          <span class="text-sm font-medium text-slate-500">Em carteira</span>
        </div>
        <div class="mt-4 text-xl xl:text-2xl font-semibold text-slate-900 tracking-tight tabular-nums truncate">{{ formatMoney(kpis.carteira) }}</div>
        <div class="text-xs text-slate-500 mt-1">a receber</div>
      </div>
      <div class="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-red-50 text-red-600 ring-1 ring-inset ring-red-100 flex items-center justify-center"><AlertTriangle class="w-[18px] h-[18px]" /></div>
          <span class="text-sm font-medium text-slate-500">Inadimplência</span>
        </div>
        <div class="mt-4 text-xl xl:text-2xl font-semibold text-red-700 tracking-tight tabular-nums truncate">{{ formatMoney(kpis.inadimplencia) }}</div>
        <div class="text-xs text-red-600 mt-1">Jurídico</div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

      <div class="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200/80 flex flex-col">
        <div class="flex flex-col md:flex-row justify-between items-start gap-4 mb-5">
          <div>
            <div v-if="chartType !== 'ambos'">
              <span class="text-sm font-medium text-slate-500">{{ rotuloTotal }}</span>
              <div class="text-2xl font-semibold tracking-tight mt-0.5" :class="totalPeriodo < 0 ? 'text-red-600' : 'text-slate-900'">{{ formatMoney(totalPeriodo) }}</div>
            </div>
            <div v-else>
              <span class="text-sm font-medium text-slate-500">Lucro e movimento do caixa</span>
              <div class="text-2xl font-semibold tracking-tight mt-0.5 text-slate-900">Comparativo</div>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <div class="flex bg-slate-100 p-0.5 rounded-lg">
              <button @click="chartType = 'lucro'" class="px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5" :class="chartType === 'lucro' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'">
                <TrendingUp class="w-3.5 h-3.5" :class="chartType === 'lucro' ? 'text-emerald-600' : ''" /> Lucro
              </button>
              <button @click="chartType = 'caixa'" class="px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5" :class="chartType === 'caixa' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'">
                <Activity class="w-3.5 h-3.5" :class="chartType === 'caixa' ? 'text-indigo-600' : ''" /> Caixa
              </button>
              <button @click="chartType = 'ambos'" class="px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5" :class="chartType === 'ambos' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'">
                Os dois
              </button>
            </div>
            <div class="flex bg-slate-100 p-0.5 rounded-lg">
              <button @click="chartPeriod = 'dias'" class="px-3 py-1.5 text-xs font-medium rounded-md transition-all" :class="chartPeriod === 'dias' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'">Dias</button>
              <button @click="chartPeriod = 'semanas'" class="px-3 py-1.5 text-xs font-medium rounded-md transition-all" :class="chartPeriod === 'semanas' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'">Semanas</button>
              <button @click="chartPeriod = 'meses'" class="px-3 py-1.5 text-xs font-medium rounded-md transition-all" :class="chartPeriod === 'meses' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'">12 meses</button>
            </div>
          </div>
        </div>
        <div class="flex-1 min-h-[260px] relative">
          <Bar v-if="temDados" :data="chartDataLine" :options="chartOptionsLine" />
          <div v-else class="absolute inset-0 flex flex-col items-center justify-center text-slate-400 text-sm">
            <Activity class="w-8 h-8 mb-2 opacity-40" />
            Nenhum movimento neste período.
          </div>
        </div>
      </div>

      <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200/80 flex flex-col justify-between">
        <div>
          <h3 class="text-base font-semibold text-slate-900">Status da carteira</h3>
          <p class="text-sm text-slate-500">Distribuição dos títulos por situação</p>
        </div>

        <div class="flex-1 flex items-center justify-center relative h-[210px] max-h-[210px] my-5">
          <Doughnut v-if="totalCarteira > 0" :data="chartDataDoughnut" :options="chartOptionsDoughnut" />
          <div v-if="totalCarteira > 0" class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span class="text-xs font-medium text-slate-500">Total</span>
            <span class="text-lg font-semibold text-slate-900 tracking-tight">{{ formatMoney(totalCarteira) }}</span>
          </div>
          <div v-else class="text-slate-400 text-sm">Nenhum título na carteira.</div>
        </div>

        <div v-if="totalCarteira > 0" class="space-y-2 pt-4 border-t border-slate-100">
          <div v-for="s in fatiasCarteira" :key="s.nome" class="flex items-center justify-between text-[13px]">
            <span class="flex items-center gap-2 text-slate-600">
              <span class="w-2 h-2 rounded-full shrink-0" :style="{ backgroundColor: s.cor }"></span>
              {{ s.nome }}
            </span>
            <span class="font-semibold text-slate-900 tabular-nums">{{ formatMoney(s.valor) }} <span class="text-slate-400 font-normal">· {{ pct(s.valor) }}%</span></span>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h3 class="text-base font-semibold text-slate-900">Próximos vencimentos</h3>
            <p class="text-sm text-slate-500">Títulos que vencem nos próximos dias</p>
          </div>
          <router-link to="/cheques" class="text-sm font-semibold text-indigo-600 hover:text-indigo-800">Ver todos</router-link>
        </div>
        <div class="divide-y divide-slate-100">
          <div v-if="proximosVencimentos.length === 0" class="p-8 text-center text-slate-400 text-sm">Nenhum vencimento próximo.</div>
          <div v-for="item in proximosVencimentos" :key="item.id" class="px-5 py-3 flex items-center justify-between hover:bg-slate-50/70 transition-colors">
            <div class="flex items-center gap-3">
              <div class="bg-slate-50 ring-1 ring-inset ring-slate-200 text-slate-700 font-semibold text-xs py-2 rounded-lg text-center w-14 tabular-nums">{{ formatDate(item.data) }}</div>
              <div>
                <div class="font-semibold text-slate-800 text-sm">{{ item.cliente }}</div>
                <div class="text-xs text-slate-500">{{ item.banco || 'Banco N/A' }}</div>
              </div>
            </div>
            <div class="font-semibold text-slate-900 text-sm tabular-nums">{{ formatMoney(item.valor) }}</div>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-100">
          <h3 class="text-base font-semibold text-slate-900">Atalhos</h3>
          <p class="text-sm text-slate-500">Ações mais usadas no dia a dia</p>
        </div>
        <div class="grid grid-cols-2 gap-3 p-4">
          <router-link to="/bordero" class="group p-4 rounded-xl border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/40 hover:shadow-sm flex items-center gap-3 transition-all">
            <div class="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100 flex items-center justify-center shrink-0"><FileText class="w-5 h-5" /></div>
            <div><div class="text-sm font-semibold text-slate-800">Novo borderô</div><div class="text-xs text-slate-500">calcular e efetivar</div></div>
          </router-link>
          <router-link to="/clientes" class="group p-4 rounded-xl border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/40 hover:shadow-sm flex items-center gap-3 transition-all">
            <div class="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100 flex items-center justify-center shrink-0"><Users class="w-5 h-5" /></div>
            <div><div class="text-sm font-semibold text-slate-800">Clientes</div><div class="text-xs text-slate-500">cadastro e carteira</div></div>
          </router-link>
          <router-link to="/fluxo-caixa" class="group p-4 rounded-xl border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/40 hover:shadow-sm flex items-center gap-3 transition-all">
            <div class="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100 flex items-center justify-center shrink-0"><DollarSign class="w-5 h-5" /></div>
            <div><div class="text-sm font-semibold text-slate-800">Lançar no caixa</div><div class="text-xs text-slate-500">despesa ou entrada</div></div>
          </router-link>
          <button type="button" @click="showReportModal = true" class="group p-4 rounded-xl border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/40 hover:shadow-sm flex items-center gap-3 transition-all text-left">
            <div class="w-10 h-10 rounded-lg bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200 flex items-center justify-center shrink-0"><TrendingUp class="w-5 h-5" /></div>
            <div><div class="text-sm font-semibold text-slate-800">Relatórios</div><div class="text-xs text-slate-500">gerencial e PDF</div></div>
          </button>
        </div>
      </div>
    </div>
  </DashboardLayout>
</template>
