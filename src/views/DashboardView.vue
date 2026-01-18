<script setup>
import { ref, onMounted } from 'vue';
import DashboardLayout from '../layouts/DashboardLayout.vue';
import { 
  Wallet, TrendingUp, AlertTriangle, ArrowUpRight, 
  Calendar, FileText, Users, DollarSign, Activity 
} from 'lucide-vue-next';

// --- CHART.JS SETUP ---
import {
  Chart as ChartJS,
  Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, ArcElement
} from 'chart.js';
import { Bar, Doughnut } from 'vue-chartjs';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

// --- DADOS MOCKADOS (Resumo Geral) ---
const kpis = ref({
  capitalInvestido: 1135000.00,
  lucroMensal: 28450.00,
  inadimplencia: 12500.00,
  chequesCarteira: 89600.00
});

const proximosVencimentos = ref([
  { id: 1, cliente: 'Mercado Silva', valor: 1500.00, data: '2026-01-18', banco: 'Itau' },
  { id: 2, cliente: 'João Construções', valor: 2350.00, data: '2026-01-19', banco: 'Bradesco' },
  { id: 3, cliente: 'Auto Peças Foz', valor: 5000.00, data: '2026-01-20', banco: 'BB' },
  { id: 4, cliente: 'Clinica Médica', valor: 900.00, data: '2026-01-21', banco: 'Santander' },
]);

// --- CONFIGURAÇÃO DOS GRÁFICOS ---

// 1. Gráfico de Evolução Financeira (Barras)
const chartDataBar = {
  labels: ['Ago', 'Set', 'Out', 'Nov', 'Dez', 'Jan'],
  datasets: [
    {
      label: 'Lucro (Juros)',
      backgroundColor: '#059669', // Emerald 600
      data: [15000, 18200, 22000, 19500, 31000, 28450],
      borderRadius: 6
    },
    {
      label: 'Inadimplência',
      backgroundColor: '#ef4444', // Red 500
      data: [2000, 1500, 3000, 1000, 5000, 1200]
    }
  ]
};

const chartOptionsBar = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' }
  },
  scales: {
    y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
    x: { grid: { display: false } }
  }
};

// 2. Gráfico de Carteira (Rosca)
const chartDataDoughnut = {
  labels: ['Em Dia', 'Atrasados', 'Devolvidos'],
  datasets: [
    {
      backgroundColor: ['#4f46e5', '#f59e0b', '#ef4444'],
      data: [85, 10, 5],
      hoverOffset: 4
    }
  ]
};

const chartOptionsDoughnut = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'right' }
  }
};

// Utils
const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
const formatDate = (iso) => iso.split('-').reverse().join('/').slice(0, 5); // dd/mm
</script>

<template>
  <DashboardLayout>
    
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
      <div>
        <h1 class="text-3xl font-bold text-slate-900 tracking-tight">Visão Geral</h1>
        <p class="text-slate-500 text-sm">Bem-vindo de volta ao Fozesc Management.</p>
      </div>
      <div class="text-right hidden md:block">
        <div class="text-xs font-bold text-slate-400 uppercase">Data de Hoje</div>
        <div class="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Calendar class="w-4 h-4 text-indigo-500" /> {{ new Date().toLocaleDateString('pt-BR') }}
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      
      <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
        <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <Wallet class="w-16 h-16 text-slate-800" />
        </div>
        <div class="flex items-center gap-3 mb-2">
          <div class="p-2 bg-slate-100 rounded-lg text-slate-700"><Wallet class="w-5 h-5" /></div>
          <span class="text-xs font-bold text-slate-500 uppercase">Capital Investido</span>
        </div>
        <div class="text-2xl font-bold text-slate-900">{{ formatMoney(kpis.capitalInvestido) }}</div>
        <div class="text-xs text-emerald-600 font-medium flex items-center mt-1">
          <ArrowUpRight class="w-3 h-3 mr-1" /> +12% esse ano
        </div>
      </div>

      <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
        <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <TrendingUp class="w-16 h-16 text-emerald-600" />
        </div>
        <div class="flex items-center gap-3 mb-2">
          <div class="p-2 bg-emerald-50 rounded-lg text-emerald-600"><TrendingUp class="w-5 h-5" /></div>
          <span class="text-xs font-bold text-slate-500 uppercase">Lucro (Mês)</span>
        </div>
        <div class="text-2xl font-bold text-slate-900">{{ formatMoney(kpis.lucroMensal) }}</div>
        <div class="text-xs text-emerald-600 font-medium flex items-center mt-1">
          <ArrowUpRight class="w-3 h-3 mr-1" /> Meta atingida
        </div>
      </div>

      <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
        <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <DollarSign class="w-16 h-16 text-indigo-600" />
        </div>
        <div class="flex items-center gap-3 mb-2">
          <div class="p-2 bg-indigo-50 rounded-lg text-indigo-600"><DollarSign class="w-5 h-5" /></div>
          <span class="text-xs font-bold text-slate-500 uppercase">A Receber (Cheques)</span>
        </div>
        <div class="text-2xl font-bold text-slate-900">{{ formatMoney(kpis.chequesCarteira) }}</div>
        <div class="text-xs text-slate-400 font-medium mt-1">
          Em carteira ativa
        </div>
      </div>

      <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
        <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <AlertTriangle class="w-16 h-16 text-red-600" />
        </div>
        <div class="flex items-center gap-3 mb-2">
          <div class="p-2 bg-red-50 rounded-lg text-red-600"><AlertTriangle class="w-5 h-5" /></div>
          <span class="text-xs font-bold text-slate-500 uppercase">Pendências</span>
        </div>
        <div class="text-2xl font-bold text-slate-900">{{ formatMoney(kpis.inadimplencia) }}</div>
        <div class="text-xs text-red-500 font-medium mt-1">
          Ação necessária
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      
      <div class="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div class="flex justify-between items-center mb-6">
          <h3 class="font-bold text-slate-800 flex items-center gap-2">
            <Activity class="w-5 h-5 text-indigo-500" /> Performance Financeira
          </h3>
          <select class="bg-slate-50 border border-slate-200 text-xs rounded-lg px-2 py-1 outline-none text-slate-600">
            <option>Últimos 6 meses</option>
            <option>Este Ano</option>
          </select>
        </div>
        <div class="h-64">
          <Bar :data="chartDataBar" :options="chartOptionsBar" />
        </div>
      </div>

      <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 class="font-bold text-slate-800 mb-6 flex items-center gap-2">
          <Users class="w-5 h-5 text-indigo-500" /> Saúde da Carteira
        </h3>
        <div class="h-48 relative">
           <Doughnut :data="chartDataDoughnut" :options="chartOptionsDoughnut" />
        </div>
        <div class="mt-6 text-center text-xs text-slate-500">
          Baseado no volume total de cheques emitidos.
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 class="font-bold text-slate-800 flex items-center gap-2">
            <Calendar class="w-4 h-4 text-orange-500" /> Vencimentos Próximos
          </h3>
          <router-link to="/bordero" class="text-xs font-bold text-indigo-600 hover:text-indigo-800">Ver todos</router-link>
        </div>
        <div class="divide-y divide-slate-100">
          <div v-for="item in proximosVencimentos" :key="item.id" class="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
            <div class="flex items-center gap-3">
              <div class="bg-orange-100 text-orange-700 font-bold text-xs p-2 rounded-lg text-center w-12">
                {{ formatDate(item.data) }}
              </div>
              <div>
                <div class="font-bold text-slate-800 text-sm">{{ item.cliente }}</div>
                <div class="text-xs text-slate-500">{{ item.banco }}</div>
              </div>
            </div>
            <div class="font-bold text-slate-900 text-sm">{{ formatMoney(item.valor) }}</div>
          </div>
        </div>
      </div>

      <div class="bg-indigo-900 rounded-2xl shadow-lg border border-indigo-800 p-6 text-white relative overflow-hidden">
        <div class="absolute -right-10 -bottom-10 opacity-10">
          <FileText class="w-48 h-48" />
        </div>
        <h3 class="font-bold text-lg mb-1 relative z-10">Ações Rápidas</h3>
        <p class="text-indigo-200 text-sm mb-6 relative z-10">O que você deseja fazer agora?</p>
        
        <div class="grid grid-cols-2 gap-4 relative z-10">
          <router-link to="/bordero" class="bg-white/10 hover:bg-white/20 border border-white/10 p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all cursor-pointer">
            <FileText class="w-6 h-6 text-emerald-400" />
            <span class="font-bold text-sm">Novo Borderô</span>
          </router-link>
          
          <router-link to="/clientes" class="bg-white/10 hover:bg-white/20 border border-white/10 p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all cursor-pointer">
            <Users class="w-6 h-6 text-blue-400" />
            <span class="font-bold text-sm">Novo Cliente</span>
          </router-link>

          <router-link to="/fluxo-caixa" class="bg-white/10 hover:bg-white/20 border border-white/10 p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all cursor-pointer">
            <DollarSign class="w-6 h-6 text-amber-400" />
            <span class="font-bold text-sm">Lançar Despesa</span>
          </router-link>
          
           <div class="bg-white/5 border border-white/5 p-4 rounded-xl flex flex-col items-center justify-center gap-2 opacity-50 cursor-not-allowed">
            <TrendingUp class="w-6 h-6 text-slate-400" />
            <span class="font-bold text-sm">Relatórios</span>
          </div>
        </div>
      </div>

    </div>
  </DashboardLayout>
</template>