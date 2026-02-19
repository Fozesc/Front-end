<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import DashboardLayout from '../layouts/DashboardLayout.vue';
import RelatorioModal from '../components/layout/RelatorioModal.vue';
import { 
  Wallet, TrendingUp, AlertTriangle, Calendar, FileText, Users, DollarSign, Activity, Download
} from 'lucide-vue-next';

import {
  Chart as ChartJS,
  Title, Tooltip, Legend, 
  PointElement, LineElement, CategoryScale, LinearScale, ArcElement, Filler
} from 'chart.js';
import { Line, Doughnut } from 'vue-chartjs';
import api from '../services/api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, Filler);


const loading = ref(true);
const showReportModal = ref(false);
const chartPeriod = ref('meses');
const chartType = ref('lucro');

const kpis = ref({ capital: 0, lucro: 0, inadimplencia: 0, carteira: 0 });
const proximosVencimentos = ref([]);
const chartDataPie = ref([0, 0, 0, 0, 0]); 
const chartEvolution = ref({ labels: [], profit_data: [], cash_data: [] }); 


const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
const formatDate = (iso) => iso ? iso.split('-').reverse().join('/').slice(0, 5) : '-';


const fetchDashboard = async () => {
  loading.value = true;
  try {
    const { data } = await api.get(`/dashboard?period=${chartPeriod.value}`);
    kpis.value = data.kpis;
    proximosVencimentos.value = data.upcoming;
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


const chartDataDoughnut = computed(() => ({
  labels: ['A Receber', 'Recebido', 'Atrasado', 'Devolvido', 'Jurídico'],
  datasets: [{
    backgroundColor: ['#6366f1', '#10b981', '#ef4444', '#f97316', '#a855f7'], 
    data: chartDataPie.value,
    borderWidth: 0,
    hoverOffset: 15
  }]
}));

const chartOptionsDoughnut = {
  responsive: true, 
  maintainAspectRatio: false,
  plugins: { 
    legend: { 
        display: true,
        position: 'bottom',
        labels: { usePointStyle: true, font: { size: 10 } }
    },
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


const chartDataLine = computed(() => {
  const isLucro = chartType.value === 'lucro';
  const dataValues = isLucro ? chartEvolution.value.profit_data : chartEvolution.value.cash_data;
  const labels = chartEvolution.value.labels;
  const color = isLucro ? '#10b981' : '#3b82f6';
  const labelText = isLucro ? 'Lucro (Juros)' : 'Saldo Líquido';

  return {
    labels: labels,
    datasets: [
      {
        label: labelText,
        backgroundColor: (context) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 300);
          gradient.addColorStop(0, isLucro ? 'rgba(16, 185, 129, 0.4)' : 'rgba(59, 130, 246, 0.4)');
          gradient.addColorStop(1, isLucro ? 'rgba(16, 185, 129, 0.0)' : 'rgba(59, 130, 246, 0.0)');
          return gradient;
        },
        borderColor: color,
        borderWidth: 3,
        pointBackgroundColor: '#fff',
        pointBorderColor: color,
        pointRadius: 4,
        fill: true,
        tension: 0.4,
        data: dataValues
      }
    ]
  };
});

const chartOptionsLine = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { 
      legend: { display: false },
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
      beginAtZero: true, 
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
        <div class="text-xs text-emerald-600 font-medium flex items-center mt-1">Total de Juros</div>
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
          <div class="flex bg-slate-100 p-1 rounded-xl">
            <button @click="chartType = 'lucro'" class="px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2" :class="chartType === 'lucro' ? 'bg-white shadow text-emerald-600' : 'text-slate-500 hover:text-slate-700'">
              <TrendingUp class="w-3 h-3" /> Lucro (Juros)
            </button>
            <button @click="chartType = 'caixa'" class="px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2" :class="chartType === 'caixa' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'">
              <Activity class="w-3 h-3" /> Saldo Caixa
            </button>
          </div>
          <div class="flex bg-slate-100 p-1 rounded-lg">
            <button @click="chartPeriod = 'dias'" class="px-3 py-1 text-xs font-bold rounded-md transition-all" :class="chartPeriod === 'dias' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'">Dias</button>
            <button @click="chartPeriod = 'semanas'" class="px-3 py-1 text-xs font-bold rounded-md transition-all" :class="chartPeriod === 'semanas' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'">Semanas</button>
            <button @click="chartPeriod = 'meses'" class="px-3 py-1 text-xs font-bold rounded-md transition-all" :class="chartPeriod === 'meses' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'">12 Meses</button>
          </div>
        </div>
        <div class="flex-1 min-h-[250px]">
          <Line :data="chartDataLine" :options="chartOptionsLine" />
        </div>
      </div>

      <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
        <h3 class="font-bold text-slate-800 mb-4 flex items-center gap-2"><Users class="w-5 h-5 text-indigo-500" /> Status da Carteira</h3>
        
        <div class="flex-1 flex items-center justify-center relative min-h-[180px]">
           <Doughnut :data="chartDataDoughnut" :options="chartOptionsDoughnut" />
        </div>

        <div class="mt-4 text-center text-xs text-slate-400">
            * Passe o mouse para ver porcentagem e valores
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