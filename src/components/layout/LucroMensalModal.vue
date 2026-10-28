<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { X, Loader2, BarChart3, Table2 } from 'lucide-vue-next';
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js';
import { Bar } from 'vue-chartjs';
import historyService from '../../services/historyService';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

// Lucro bruto de cada mes, do primeiro ao ultimo (mes sem nada aparece com zero). A conta e' a
// mesma do cartao do Historico Mensal (history_service.lucro_por_mes).
const emit = defineEmits(['close']);
const meses = ref([]);
const carregando = ref(true);
const erro = ref('');
const periodo = ref(0);
const verTabela = ref(false);
const PERIODOS = [{ n: 12, nome: '12 meses' }, { n: 24, nome: '24 meses' }, { n: 0, nome: 'Todos' }];

onMounted(async () => {
  window.addEventListener('keydown', aoTeclar);
  try {
    meses.value = await historyService.getLucro();
  } catch (e) {
    erro.value = e.response?.data?.error || 'Não foi possível carregar o lucro dos meses.';
  } finally {
    carregando.value = false;
  }
});
onUnmounted(() => window.removeEventListener('keydown', aoTeclar));
const aoTeclar = (ev) => { if (ev.key === 'Escape') emit('close'); };

const visiveis = computed(() => (periodo.value ? meses.value.slice(-periodo.value) : meses.value));
const total = computed(() => visiveis.value.reduce((t, m) => t + m.lucro_bruto, 0));
const media = computed(() => (visiveis.value.length ? total.value / visiveis.value.length : 0));
const melhor = computed(() => visiveis.value.reduce((a, m) => (!a || m.lucro_bruto > a.lucro_bruto ? m : a), null));

const moeda = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const curto = (label) => { const [nome, ano] = label.split('/'); return `${nome.slice(0, 3)}/${ano.slice(2)}`; };
const extras = (m) => m.prorrogacao + m.imposto + m.multa + m.outros;

const dados = computed(() => ({
  labels: visiveis.value.map(m => curto(m.label)),
  datasets: [{
    label: 'Lucro bruto',
    data: visiveis.value.map(m => m.lucro_bruto),
    backgroundColor: visiveis.value.map(m => (m.lucro_bruto < 0 ? '#ef4444' : '#10b981')),
    hoverBackgroundColor: visiveis.value.map(m => (m.lucro_bruto < 0 ? '#dc2626' : '#059669')),
    borderRadius: 4,
    borderSkipped: false,
    maxBarThickness: 28,
    categoryPercentage: 0.8,
  }],
}));

const opcoes = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 250 },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        title: (itens) => visiveis.value[itens[0].dataIndex].label,
        label: (ctx) => `Lucro bruto: ${moeda(ctx.raw)}`,
        afterLabel: (ctx) => {
          const m = visiveis.value[ctx.dataIndex];
          return [`Juros dos borderôs: ${moeda(m.juros_borderos)} (${m.qtd_borderos} borderô(s))`,
            `+ Prorrogação, imposto e multa: ${moeda(extras(m))}`, `− Comissões: ${moeda(m.comissoes)}`];
        },
      },
    },
  },
  scales: {
    y: {
      grid: { color: '#f1f5f9' }, border: { display: false },
      ticks: { font: { size: 11 }, color: '#94a3b8', padding: 8,
               callback: (v) => new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(v) },
    },
    x: { grid: { display: false }, border: { color: '#cbd5e1' }, ticks: { font: { size: 11 }, color: '#94a3b8', maxRotation: 0, autoSkip: true } },
  },
}));
</script>

<template>
  <div class="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" data-modal="lucro-mensal">
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="emit('close')"></div>
    <div class="relative z-10 w-full max-w-5xl bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
      <header class="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
        <div>
          <h2 class="text-base font-semibold text-slate-900 flex items-center gap-2"><BarChart3 class="w-5 h-5 text-emerald-600" /> Lucro bruto de cada mês</h2>
          <p class="text-sm text-slate-500 mt-0.5">Juros dos borderôs + prorrogação, imposto e multa − comissões. Passe o mouse numa barra para ver a conta.</p>
        </div>
        <button @click="emit('close')" aria-label="Fechar" class="p-2 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"><X class="w-5 h-5" /></button>
      </header>

      <div class="p-6 overflow-y-auto space-y-5">
        <div v-if="carregando" class="py-20 flex justify-center text-slate-400"><Loader2 class="w-6 h-6 animate-spin" /></div>
        <p v-else-if="erro" class="text-sm text-red-600">{{ erro }}</p>
        <p v-else-if="!meses.length" class="py-16 text-center text-slate-400 text-sm">Ainda não há meses com lucro.</p>
        <template v-else>
          <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div class="grid grid-cols-3 gap-6">
              <div>
                <div class="text-xs font-medium text-slate-500">Total no período</div>
                <div class="text-xl font-semibold tracking-tight tabular-nums text-slate-900" data-campo="lucro-total">{{ moeda(total) }}</div>
              </div>
              <div>
                <div class="text-xs font-medium text-slate-500">Média por mês</div>
                <div class="text-xl font-semibold tracking-tight tabular-nums text-slate-900">{{ moeda(media) }}</div>
              </div>
              <div v-if="melhor">
                <div class="text-xs font-medium text-slate-500">Melhor mês</div>
                <div class="text-xl font-semibold tracking-tight tabular-nums text-slate-900">{{ moeda(melhor.lucro_bruto) }}</div>
                <div class="text-xs text-slate-500">{{ melhor.label }}</div>
              </div>
            </div>
            <div class="flex bg-slate-100 p-0.5 rounded-lg w-fit">
              <button v-for="p in PERIODOS" :key="p.n" @click="periodo = p.n"
                      class="px-3 py-1.5 text-xs font-medium rounded-md transition-all"
                      :class="periodo === p.n ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'">{{ p.nome }}</button>
            </div>
          </div>

          <div class="h-[340px] relative" data-campo="grafico-lucro">
            <Bar :data="dados" :options="opcoes" />
          </div>

          <button @click="verTabela = !verTabela" class="text-sm font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5">
            <Table2 class="w-4 h-4" /> {{ verTabela ? 'Esconder a tabela' : 'Ver em tabela' }}
          </button>
          <div v-if="verTabela" class="border border-slate-200 rounded-lg overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-slate-50/80 text-slate-500 text-xs font-medium border-b border-slate-200">
                <tr>
                  <th class="px-4 py-2 text-left">Mês</th>
                  <th class="px-4 py-2 text-right">Juros dos borderôs</th>
                  <th class="px-4 py-2 text-right">Prorrogação, imposto e multa</th>
                  <th class="px-4 py-2 text-right">Comissões</th>
                  <th class="px-4 py-2 text-right">Lucro bruto</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 tabular-nums">
                <tr v-for="m in [...visiveis].reverse()" :key="m.label">
                  <td class="px-4 py-2 text-slate-700">{{ m.label }}</td>
                  <td class="px-4 py-2 text-right text-slate-700">{{ moeda(m.juros_borderos) }}</td>
                  <td class="px-4 py-2 text-right text-slate-700">{{ moeda(extras(m)) }}</td>
                  <td class="px-4 py-2 text-right text-slate-700">{{ m.comissoes ? '− ' + moeda(m.comissoes) : moeda(0) }}</td>
                  <td class="px-4 py-2 text-right font-semibold" :class="m.lucro_bruto < 0 ? 'text-red-600' : 'text-slate-900'">{{ moeda(m.lucro_bruto) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
