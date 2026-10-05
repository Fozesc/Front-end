<script setup>
import { ref, computed, onMounted } from 'vue';
import DashboardLayout from '../layouts/DashboardLayout.vue';
import {
  Landmark, Wallet, ArrowUpCircle, ArrowDownCircle,
  TrendingUp, TrendingDown, Loader2, ChevronLeft, ChevronRight,
  Layers, Coins, ChevronDown
} from 'lucide-vue-next';
import historyService from '../services/historyService';

const meses = ref([]);
const selectedIndex = ref(0);
const detalhe = ref(null);
const loadingMeses = ref(true);
const loadingDetalhe = ref(false);

const formatMoney = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const formatDate = (d) => d ? d.split('-').reverse().join('/') : '-';

const mesAtual = computed(() => meses.value[selectedIndex.value] || null);
const resumo = computed(() => detalhe.value?.resumo || {});
const totalCaixa = computed(() => detalhe.value ? detalhe.value.bancos.reduce((s, b) => s + b.saldo, 0) : 0);

const bankStyle = (key) => ({
  BRASIL:   { icon: Landmark, color: 'text-blue-600',    bg: 'bg-blue-50',    ring: 'border-blue-100' },
  CAIXA:    { icon: Landmark, color: 'text-sky-600',     bg: 'bg-sky-50',     ring: 'border-sky-100' },
  DINHEIRO: { icon: Wallet,   color: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'border-emerald-100' },
}[key] || { icon: Wallet, color: 'text-slate-600', bg: 'bg-slate-50', ring: 'border-slate-100' });

const carregarDetalhe = async () => {
  const mes = mesAtual.value;
  if (!mes) return;
  loadingDetalhe.value = true;
  try {
    detalhe.value = await historyService.getMonthDetail(mes.year, mes.month);
  } catch (e) {
    console.error('Erro ao carregar mês:', e);
  } finally {
    loadingDetalhe.value = false;
  }
};

const carregarMeses = async () => {
  loadingMeses.value = true;
  try {
    meses.value = await historyService.getMonths();
    selectedIndex.value = 0;
    if (meses.value.length) await carregarDetalhe();
  } catch (e) {
    console.error('Erro ao carregar meses:', e);
  } finally {
    loadingMeses.value = false;
  }
};

onMounted(carregarMeses);

const irPara = (i) => {
  if (i >= 0 && i < meses.value.length) {
    selectedIndex.value = i;
    carregarDetalhe();
  }
};
</script>

<template>
  <DashboardLayout>

    <!-- CABEÇALHO + SELETOR DE MÊS -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-end mb-7 gap-4">
      <div>
        <h1 class="text-2xl font-semibold text-slate-900 tracking-tight">Histórico Mensal</h1>
        <p class="text-slate-500 text-sm mt-1">Consulte o caixa de cada mês: saldos, crescimento e lançamentos.</p>
      </div>

      <!-- navegação de mês -->
      <div v-if="meses.length" class="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-xs">
        <button @click="irPara(selectedIndex + 1)" :disabled="selectedIndex >= meses.length - 1"
                title="Mês anterior"
                class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed">
          <ChevronLeft class="w-[18px] h-[18px]" />
        </button>

        <div class="relative">
          <select :value="selectedIndex" @change="irPara(Number($event.target.value))"
                  class="appearance-none bg-transparent hover:bg-slate-50 text-slate-900 font-semibold py-1.5 pl-4 pr-9 rounded-lg cursor-pointer outline-none text-sm capitalize min-w-[160px] text-center focus:ring-4 focus:ring-indigo-500/15 transition">
            <option v-for="(m, i) in meses" :key="`${m.year}-${m.month}`" :value="i">{{ m.label }}</option>
          </select>
          <ChevronDown class="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        <button @click="irPara(selectedIndex - 1)" :disabled="selectedIndex <= 0"
                title="Próximo mês"
                class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed">
          <ChevronRight class="w-[18px] h-[18px]" />
        </button>
      </div>
    </div>

    <!-- CARREGANDO INICIAL -->
    <div v-if="loadingMeses" class="flex items-center justify-center py-24 text-slate-400">
      <Loader2 class="w-6 h-6 animate-spin mr-2" /> Carregando histórico...
    </div>

    <!-- VAZIO -->
    <div v-else-if="meses.length === 0"
         class="bg-white rounded-xl border border-slate-200/80 shadow-sm p-16 text-center text-slate-400">
      <Layers class="w-12 h-12 mx-auto mb-3 opacity-40" />
      <p class="font-medium">Nenhum mês com movimentação ainda.</p>
    </div>

    <div v-else class="relative">
      <!-- overlay de loading ao trocar de mês -->
      <div v-if="loadingDetalhe" class="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-start justify-center pt-20">
        <Loader2 class="w-7 h-7 animate-spin text-indigo-500" />
      </div>

      <!-- SALDO POR BANCO (quanto tinha em cada banco + crescimento/perda) -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div v-for="banco in detalhe?.bancos || []" :key="banco.key"
             class="bg-white p-5 rounded-xl shadow-sm border border-slate-200/80">
          <div class="flex items-center gap-3 mb-4">
            <div :class="[bankStyle(banco.key).bg, bankStyle(banco.key).color]" class="w-9 h-9 flex items-center justify-center rounded-lg ring-1 ring-inset ring-slate-900/5">
              <component :is="bankStyle(banco.key).icon" class="w-[18px] h-[18px]" />
            </div>
            <span class="text-sm font-semibold text-slate-900">{{ banco.nome }}</span>
          </div>

          <div class="mb-3">
            <span class="text-xs font-medium text-slate-500">Saldo no fim do mês</span>
            <div class="text-2xl font-semibold tracking-tight tabular-nums" :class="banco.saldo >= 0 ? 'text-slate-900' : 'text-red-600'">
              {{ formatMoney(banco.saldo) }}
            </div>
          </div>

          <div class="flex gap-2 pt-3 border-t border-slate-100">
            <div class="flex-1">
              <div class="flex items-center gap-1 text-emerald-600 text-xs font-medium">
                <TrendingUp class="w-3.5 h-3.5" /> Crescimento
              </div>
              <div class="text-sm font-semibold text-slate-800 tabular-nums mt-0.5">{{ formatMoney(banco.entradas) }}</div>
            </div>
            <div class="flex-1">
              <div class="flex items-center gap-1 text-red-500 text-xs font-medium">
                <TrendingDown class="w-3.5 h-3.5" /> Perda
              </div>
              <div class="text-sm font-semibold text-slate-800 tabular-nums mt-0.5">{{ formatMoney(banco.saidas) }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- RESUMO GERAL DO MÊS -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div class="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <div class="flex items-center gap-1.5 text-emerald-600 mb-2"><ArrowUpCircle class="w-4 h-4" /><span class="text-xs font-medium">Crescimento</span></div>
          <div class="text-lg font-semibold tracking-tight tabular-nums text-slate-900">{{ formatMoney(resumo.total_entradas) }}</div>
          <div class="text-xs text-slate-500 mt-0.5">total de entradas</div>
        </div>
        <div class="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <div class="flex items-center gap-1.5 text-red-500 mb-2"><ArrowDownCircle class="w-4 h-4" /><span class="text-xs font-medium">Perda</span></div>
          <div class="text-lg font-semibold tracking-tight tabular-nums text-slate-900">{{ formatMoney(resumo.total_saidas) }}</div>
          <div class="text-xs text-slate-500 mt-0.5">total de saídas</div>
        </div>
        <div class="p-4 rounded-xl border shadow-sm" :class="resumo.resultado >= 0 ? 'bg-indigo-50/70 border-indigo-200/70' : 'bg-orange-50 border-orange-200/70'">
          <div class="flex items-center gap-1.5 mb-2" :class="resumo.resultado >= 0 ? 'text-indigo-600' : 'text-orange-600'">
            <component :is="resumo.resultado >= 0 ? TrendingUp : TrendingDown" class="w-4 h-4" /><span class="text-xs font-medium">Resultado</span>
          </div>
          <div class="text-lg font-semibold tracking-tight tabular-nums" :class="resumo.resultado >= 0 ? 'text-slate-900' : 'text-orange-700'">{{ formatMoney(resumo.resultado) }}</div>
          <div class="text-xs text-slate-500 mt-0.5">entradas − saídas</div>
        </div>
        <div class="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <div class="flex items-center gap-1.5 text-emerald-600 mb-2"><TrendingUp class="w-4 h-4" /><span class="text-xs font-medium">Lucro</span></div>
          <div class="text-lg font-semibold tracking-tight tabular-nums text-slate-900">{{ formatMoney(resumo.lucro) }}</div>
          <div class="text-xs text-slate-500 mt-0.5">juros · {{ resumo.qtd_operacoes }} op.</div>
        </div>
        <div class="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <div class="flex items-center gap-1.5 text-slate-600 mb-2"><Wallet class="w-4 h-4" /><span class="text-xs font-medium">Saldo total</span></div>
          <div class="text-lg font-semibold tracking-tight tabular-nums" :class="totalCaixa >= 0 ? 'text-slate-900' : 'text-red-600'">{{ formatMoney(totalCaixa) }}</div>
          <div class="text-xs text-slate-500 mt-0.5">no caixa (fim do mês)</div>
        </div>
      </div>

      <!-- EXTRATO / LANÇAMENTOS DO MÊS -->
      <div class="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 class="text-base font-semibold text-slate-900 flex items-center gap-1">
            Lançamentos de <span class="capitalize">{{ detalhe?.label }}</span>
          </h3>
          <span class="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">
            {{ detalhe?.lancamentos?.length || 0 }} lançamentos
          </span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-50/80 text-slate-500 text-xs font-medium border-b border-slate-200">
              <tr>
                <th class="px-6 py-2.5">Data</th>
                <th class="px-6 py-2.5">Descrição</th>
                <th class="px-6 py-2.5">Conta</th>
                <th class="px-6 py-2.5 text-right">Entrada</th>
                <th class="px-6 py-2.5 text-right">Saída</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-if="!detalhe?.lancamentos?.length">
                <td colspan="5" class="px-6 py-12 text-center text-slate-400 italic">Nenhum lançamento neste mês.</td>
              </tr>
              <tr v-for="item in detalhe?.lancamentos || []" :key="item.id" class="hover:bg-slate-50 transition-colors">
                <td class="px-6 py-3 text-slate-500 tabular-nums text-[13px] whitespace-nowrap">{{ formatDate(item.data) }}</td>
                <td class="px-6 py-3 font-medium text-slate-800">{{ item.descricao }}</td>
                <td class="px-6 py-3">
                  <span class="px-2 py-0.5 rounded-md text-[11px] font-medium border whitespace-nowrap"
                    :class="{
                      'bg-blue-50 text-blue-700 border-blue-200': (item.origem || '').toLowerCase().includes('brasil') || (item.origem || '').toLowerCase().includes('bb'),
                      'bg-sky-50 text-sky-700 border-sky-200': (item.origem || '').toLowerCase().includes('caixa') || (item.origem || '').toLowerCase().includes('cef'),
                      'bg-emerald-50 text-emerald-700 border-emerald-200': !(item.origem || '').toLowerCase().includes('brasil') && !(item.origem || '').toLowerCase().includes('bb') && !(item.origem || '').toLowerCase().includes('caixa') && !(item.origem || '').toLowerCase().includes('cef')
                    }">
                    {{ item.origem || '—' }}
                  </span>
                </td>
                <td class="px-6 py-3 text-right font-semibold text-emerald-600 tabular-nums whitespace-nowrap">{{ item.tipo === 'entrada' ? formatMoney(Math.abs(item.valor)) : '—' }}</td>
                <td class="px-6 py-3 text-right font-semibold text-red-600 tabular-nums whitespace-nowrap">{{ item.tipo !== 'entrada' ? formatMoney(Math.abs(item.valor)) : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

  </DashboardLayout>
</template>
