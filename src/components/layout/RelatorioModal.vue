<script setup>
import { ref, nextTick } from 'vue';
import { X, FileText, Printer, Loader2, AlertCircle, ArrowLeft } from 'lucide-vue-next';
import api from '../../services/api';
import {
  Chart as ChartJS, Title, Tooltip, Legend, BarElement, ArcElement,
  PointElement, LineElement, CategoryScale, LinearScale, Filler
} from 'chart.js';
import { Bar, Line, Pie } from 'vue-chartjs';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement,
                 PointElement, LineElement, Title, Tooltip, Legend, Filler);

const emit = defineEmits(['close']);
const carregando = ref(false);
const erro = ref('');
const relatorio = ref(null);

const filtro = ref({
  tipo: 'geral',
  inicio: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
  fim: new Date().toISOString().split('T')[0]
});

const moeda = (v) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const moedaCurta = (v) => (v ?? 0).toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const brData = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

const celula = (valor, tipo) => {
  if (tipo === 'moeda') return moeda(valor);
  if (tipo === 'data') return brData(valor);
  if (tipo === 'numero') return valor;
  return valor;
};
const valorDe = (linha) => (linha.formato === 'numero' ? linha.valor : moeda(linha.valor));

const gerar = async () => {
  carregando.value = true;
  erro.value = '';
  try {
    const { data } = await api.get('/reports/resumo', { params: { ...filtro.value } });
    relatorio.value = data;
    await nextTick();
  } catch (e) {
    erro.value = e.response?.data?.error || 'Não foi possível gerar o relatório.';
  } finally {
    carregando.value = false;
  }
};

const imprimir = async () => {
  await nextTick();
  window.print();
};

// Gráficos: sem animação porque o canvas precisa estar pronto na hora de imprimir,
// e em dobro de resolução para a barra não sair serrilhada no papel.
const base = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  devicePixelRatio: 2,
};

const eixoDinheiro = {
  y: {
    beginAtZero: true,
    grid: { color: '#e5e7eb' },
    ticks: { font: { size: 10 }, color: '#6b7280', callback: (v) => moedaCurta(v) }
  },
  x: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#6b7280' } }
};

const dica = (ctx) => `${ctx.dataset.label ? ctx.dataset.label + ': ' : ''}${moeda(ctx.raw)}`;

const opcoes = (g) => {
  const varias = g.series.length > 1;
  if (g.tipo === 'pizza') {
    return {
      ...base,
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, font: { size: 11 }, boxWidth: 8 } },
        tooltip: { callbacks: { label: (c) => `${c.label}: ${moeda(c.raw)}` } }
      }
    };
  }
  return {
    ...base,
    plugins: {
      legend: { display: varias, position: 'bottom', labels: { usePointStyle: true, font: { size: 11 }, boxWidth: 8 } },
      tooltip: { callbacks: { label: dica } }
    },
    scales: eixoDinheiro
  };
};

const dados = (g) => ({
  labels: g.labels,
  datasets: g.series.map((s) => ({
    label: s.nome,
    data: s.dados,
    backgroundColor: s.cor,
    borderColor: Array.isArray(s.cor) ? '#fff' : s.cor,
    borderWidth: g.tipo === 'linha' ? 2 : (g.tipo === 'pizza' ? 2 : 0),
    borderRadius: g.tipo === 'barras' ? 4 : 0,
    fill: false,
    tension: 0.3,
    pointRadius: 2,
  }))
});

const componente = (tipo) => (tipo === 'pizza' ? Pie : tipo === 'linha' ? Line : Bar);

// O primeiro gráfico ocupa a linha inteira; o último também, quando sobraria
// sozinho na coluna da esquerda com um buraco branco do lado.
const larguraCheia = (i) => {
  const n = relatorio.value?.graficos?.length || 0;
  return i === 0 || (i === n - 1 && (n - 1) % 2 === 1);
};
</script>

<template>
  <!-- ETAPA 1: escolher o que gerar -->
  <div v-if="!relatorio" class="fixed inset-0 z-[70] flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="$emit('close')"></div>

    <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl relative z-10 animate-scale-in overflow-hidden">
      <div class="bg-slate-900 p-5 flex justify-between items-center">
        <h2 class="text-white text-lg font-bold flex items-center gap-2"><FileText class="w-5 h-5 text-emerald-400" /> Gerar Relatório</h2>
        <button @click="$emit('close')" class="text-slate-400 hover:text-white"><X class="w-5 h-5" /></button>
      </div>

      <div class="p-6 space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de Relatório</label>
          <select v-model="filtro.tipo" class="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="geral">Resumo Geral (Fluxo)</option>
            <option value="inadimplencia">Relatório de Inadimplência</option>
            <option value="lucro">Demonstrativo de Lucros</option>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">De</label>
            <input v-model="filtro.inicio" type="date" class="w-full p-2 border border-slate-300 rounded-lg outline-none" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Até</label>
            <input v-model="filtro.fim" type="date" class="w-full p-2 border border-slate-300 rounded-lg outline-none" />
          </div>
        </div>

        <p v-if="erro" class="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle class="w-4 h-4 mt-0.5 shrink-0" /> {{ erro }}
        </p>
      </div>

      <div class="bg-slate-50 p-4 border-t border-slate-200 flex justify-end gap-2">
        <button @click="$emit('close')" class="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg transition-colors">Cancelar</button>
        <button @click="gerar" :disabled="carregando" class="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold rounded-lg shadow-md flex items-center transition-all">
          <Loader2 v-if="carregando" class="w-4 h-4 mr-2 animate-spin" />
          <FileText v-else class="w-4 h-4 mr-2" />
          {{ carregando ? 'Buscando dados...' : 'Gerar relatório' }}
        </button>
      </div>
    </div>
  </div>

  <!-- ETAPA 2: prévia em tela cheia; é o mesmo papel que sai na impressora -->
  <Teleport to="body">
    <div v-if="relatorio" class="relatorio-tela">
      <div class="print:hidden sticky top-0 z-10 bg-slate-900 text-white px-6 py-3 flex items-center justify-between shadow-lg">
        <button @click="relatorio = null" class="flex items-center gap-2 text-sm font-bold text-slate-300 hover:text-white">
          <ArrowLeft class="w-4 h-4" /> Trocar período
        </button>
        <span class="text-sm font-bold hidden sm:block">Prévia do relatório</span>
        <div class="flex gap-2">
          <button @click="imprimir" class="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-bold text-sm flex items-center gap-2">
            <Printer class="w-4 h-4" /> Imprimir / PDF
          </button>
          <button @click="relatorio = null; $emit('close')" class="p-2 text-slate-400 hover:text-white"><X class="w-5 h-5" /></button>
        </div>
      </div>

      <div class="print-paper">
        <div class="border-b-2 border-black pb-4 mb-6 flex justify-between items-end">
          <div>
            <h1 class="text-3xl font-bold uppercase tracking-widest">{{ relatorio.empresa }}</h1>
            <p class="text-sm text-gray-500 uppercase mt-1">
              Relatório Gerencial<span v-if="relatorio.cnpj"> · CNPJ {{ relatorio.cnpj }}</span>
            </p>
          </div>
          <div class="text-right">
            <p class="text-sm font-bold">Período</p>
            <p class="text-sm">{{ brData(relatorio.inicio) }} a {{ brData(relatorio.fim) }}</p>
          </div>
        </div>

        <h2 class="text-lg font-bold uppercase border-b border-gray-300 pb-1 mb-5">{{ relatorio.titulo }}</h2>

        <!-- cartões de destaque -->
        <div v-if="relatorio.destaques?.length" class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
          <div v-for="d in relatorio.destaques" :key="d.label" class="border border-gray-300 rounded-lg p-3">
            <div class="text-[10px] font-bold uppercase tracking-wide text-gray-500">{{ d.label }}</div>
            <div class="text-lg font-bold mt-0.5"
                 :class="d.sinal === 'positivo' ? 'text-emerald-700' : d.sinal === 'negativo' ? 'text-red-700' : 'text-gray-900'">
              {{ valorDe(d) }}
            </div>
          </div>
        </div>

        <!-- gráficos -->
        <div v-if="relatorio.graficos?.length" class="grid grid-cols-2 gap-5 mb-8">
          <div v-for="(g, i) in relatorio.graficos" :key="g.titulo"
               class="border border-gray-300 rounded-lg p-3 break-inside-avoid"
               :class="larguraCheia(i) ? 'col-span-2' : ''">
            <h3 class="text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">{{ g.titulo }}</h3>
            <div :style="{ height: larguraCheia(i) ? '230px' : '200px' }">
              <component :is="componente(g.tipo)" :data="dados(g)" :options="opcoes(g)" />
            </div>
          </div>
        </div>

        <!-- quadro de valores -->
        <div class="space-y-2 text-sm mb-8 break-inside-avoid">
          <div class="flex justify-between bg-gray-100 p-2 font-bold">
            <span>Descrição</span><span>Valor</span>
          </div>
          <div v-for="linha in relatorio.linhas" :key="linha.label"
               class="flex justify-between p-2 border-b border-gray-200"
               :class="linha.destaque ? 'bg-gray-50 font-bold' : ''">
            <span>{{ linha.label }}</span>
            <span :class="linha.sinal === 'positivo' ? 'text-emerald-700 font-bold' : linha.sinal === 'negativo' ? 'text-red-700 font-bold' : ''">
              {{ valorDe(linha) }}
            </span>
          </div>
        </div>

        <!-- tabelas -->
        <div v-for="t in relatorio.tabelas" :key="t.titulo" class="mb-8">
          <h3 class="text-sm font-bold uppercase border-b border-gray-300 pb-1 mb-3">{{ t.titulo }}</h3>
          <table class="w-full text-xs border-collapse">
            <thead>
              <tr class="bg-gray-100">
                <th v-for="c in t.colunas" :key="c.nome" class="text-left p-2 border-b border-gray-300"
                    :class="c.tipo === 'moeda' || c.tipo === 'numero' ? 'text-right' : ''">{{ c.nome }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(linha, li) in t.linhas" :key="li" class="border-b border-gray-200">
                <td v-for="(valor, ci) in linha" :key="ci" class="p-2"
                    :class="t.colunas[ci].tipo === 'moeda' || t.colunas[ci].tipo === 'numero' ? 'text-right whitespace-nowrap' : ''">
                  {{ celula(valor, t.colunas[ci].tipo) }}
                </td>
              </tr>
              <tr v-if="!t.linhas.length">
                <td :colspan="t.colunas.length" class="p-3 text-center text-gray-500 italic">Nada no período.</td>
              </tr>
            </tbody>
          </table>
          <p v-if="t.truncado" class="mt-2 text-xs text-gray-600">
            Mostrando as {{ t.linhas.length }} primeiras de {{ t.total_linhas }} linhas.
            Os totais acima consideram todas.
          </p>
        </div>

        <div class="mt-8 p-4 border border-dashed border-gray-400 text-center text-xs text-gray-500">
          Relatório gerado automaticamente em {{ relatorio.gerado_em }}.<br>
          Este documento é para controle interno.
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.animate-scale-in { animation: scaleIn 0.2s ease-out; }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }

/* prévia: ocupa a tela inteira por cima do sistema */
.relatorio-tela {
  position: fixed;
  inset: 0;
  z-index: 999998;
  overflow-y: auto;
  background: #e2e8f0;
}
.print-paper {
  background: white;
  color: black;
  max-width: 210mm;
  margin: 24px auto;
  padding: 15mm;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.15);
}

@media print {
  #app { display: none !important; }
  @page { margin: 12mm; size: A4 portrait; }
  body { margin: 0 !important; padding: 0 !important; background: white !important; }
  .relatorio-tela { position: absolute; inset: auto; overflow: visible; background: white; }
  .print-paper { margin: 0; padding: 0; max-width: none; box-shadow: none; }
  /* sem isto o navegador imprime os gráficos e as tarjas sem cor */
  .relatorio-tela, .relatorio-tela * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  table { page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  thead { display: table-header-group; }
  .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
}
</style>
