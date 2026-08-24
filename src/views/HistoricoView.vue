<script setup>
import { ref, computed, onMounted } from 'vue';
import DashboardLayout from '../layouts/DashboardLayout.vue';
import {
  CalendarClock, Landmark, Wallet, ArrowUpCircle, ArrowDownCircle,
  TrendingUp, TrendingDown, Loader2, ChevronLeft, ChevronRight,
  FileText, Layers, Coins, ChevronDown
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
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
      <div class="flex items-center gap-3">
        <div class="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-200">
          <CalendarClock class="w-6 h-6" />
        </div>
        <div>
          <h1 class="text-3xl font-bold text-slate-900 tracking-tight">Histórico Mensal</h1>
          <p class="text-slate-500 text-sm">Consulte o caixa de cada mês: saldos, crescimento e lançamentos.</p>
        </div>
      </div>

      <!-- navegação de mês -->
      <div v-if="meses.length" class="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1.5 shadow-sm">
        <button @click="irPara(selectedIndex + 1)" :disabled="selectedIndex >= meses.length - 1"
                title="Mês anterior"
                class="p-2 rounded-lg hover:bg-slate-100 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed">
          <ChevronLeft class="w-5 h-5" />
        </button>

        <div class="relative">
          <select :value="selectedIndex" @change="irPara(Number($event.target.value))"
                  class="appearance-none bg-slate-50 border border-slate-200 text-slate-800 font-bold py-2 pl-4 pr-9 rounded-lg cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500 text-sm capitalize min-w-[160px] text-center">
            <option v-for="(m, i) in meses" :key="`${m.year}-${m.month}`" :value="i">{{ m.label }}</option>
          </select>
          <ChevronDown class="w-4 h-4 absolute right-3 top-2.5 text-slate-400 pointer-events-none" />
        </div>

        <button @click="irPara(selectedIndex - 1)" :disabled="selectedIndex <= 0"
                title="Próximo mês"
                class="p-2 rounded-lg hover:bg-slate-100 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed">
          <ChevronRight class="w-5 h-5" />
        </button>
      </div>
    </div>

    <!-- CARREGANDO INICIAL -->
    <div v-if="loadingMeses" class="flex items-center justify-center py-24 text-slate-400">
      <Loader2 class="w-6 h-6 animate-spin mr-2" /> Carregando histórico...
    </div>

    <!-- VAZIO -->
    <div v-else-if="meses.length === 0"
         class="bg-white rounded-2xl border border-slate-200 p-16 text-center text-slate-400">
      <Layers class="w-12 h-12 mx-auto mb-3 opacity-40" />
      <p class="font-medium">Nenhum mês com movimentação ainda.</p>
    </div>

    <div v-else class="relative">
      <!-- overlay de loading ao trocar de mês -->
      <div v-if="loadingDetalhe" class="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-start justify-center pt-20">
        <Loader2 class="w-7 h-7 animate-spin text-indigo-500" />
      </div>

      <!-- SALDO POR BANCO (quanto tinha em cada banco + crescimento/perda) -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        <div v-for="banco in detalhe?.bancos || []" :key="banco.key"
             class="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <div class="flex items-center gap-2.5 mb-3">
            <div :class="[bankStyle(banco.key).bg, bankStyle(banco.key).color]" class="p-2 rounded-lg">
              <component :is="bankStyle(banco.key).icon" class="w-5 h-5" />
            </div>
            <span class="font-bold text-slate-700">{{ banco.nome }}</span>
          </div>

          <div class="mb-3">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Saldo no fim do mês</span>
            <div class="text-2xl font-bold" :class="banco.saldo >= 0 ? 'text-slate-900' : 'text-red-600'">
              {{ formatMoney(banco.saldo) }}
            </div>
          </div>

          <div class="flex gap-2 pt-3 border-t border-slate-100">
            <div class="flex-1">
              <div class="flex items-center gap-1 text-emerald-600 text-[10px] font-bold uppercase">
                <TrendingUp class="w-3 h-3" /> Crescimento
              </div>
              <div class="text-sm font-bold text-slate-700">{{ formatMoney(banco.entradas) }}</div>
            </div>
            <div class="flex-1">
              <div class="flex items-center gap-1 text-red-500 text-[10px] font-bold uppercase">
                <TrendingDown class="w-3 h-3" /> Perda
              </div>
              <div class="text-sm font-bold text-slate-700">{{ formatMoney(banco.saidas) }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- RESUMO GERAL DO MÊS -->
      <div class="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <div class="flex items-center gap-1.5 text-emerald-600 mb-1"><ArrowUpCircle class="w-4 h-4" /><span class="text-[10px] font-bold uppercase">Crescimento</span></div>
          <div class="text-lg font-bold text-slate-900">{{ formatMoney(resumo.total_entradas) }}</div>
          <div class="text-[10px] text-slate-400 font-medium">total de entradas</div>
        </div>
        <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <div class="flex items-center gap-1.5 text-red-500 mb-1"><ArrowDownCircle class="w-4 h-4" /><span class="text-[10px] font-bold uppercase">Perda</span></div>
          <div class="text-lg font-bold text-slate-900">{{ formatMoney(resumo.total_saidas) }}</div>
          <div class="text-[10px] text-slate-400 font-medium">total de saídas</div>
        </div>
        <div class="p-4 rounded-xl border shadow-sm" :class="resumo.resultado >= 0 ? 'bg-indigo-50 border-indigo-100' : 'bg-orange-50 border-orange-100'">
          <div class="flex items-center gap-1.5 mb-1" :class="resumo.resultado >= 0 ? 'text-indigo-600' : 'text-orange-600'">
            <component :is="resumo.resultado >= 0 ? TrendingUp : TrendingDown" class="w-4 h-4" /><span class="text-[10px] font-bold uppercase">Resultado</span>
          </div>
          <div class="text-lg font-bold" :class="resumo.resultado >= 0 ? 'text-slate-900' : 'text-orange-700'">{{ formatMoney(resumo.resultado) }}</div>
          <div class="text-[10px] text-slate-400 font-medium">entradas − saídas</div>
        </div>
        <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <div class="flex items-center gap-1.5 text-emerald-600 mb-1"><TrendingUp class="w-4 h-4" /><span class="text-[10px] font-bold uppercase">Lucro</span></div>
          <div class="text-lg font-bold text-slate-900">{{ formatMoney(resumo.lucro) }}</div>
          <div class="text-[10px] text-slate-400 font-medium">juros · {{ resumo.qtd_operacoes }} op.</div>
        </div>
        <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <div class="flex items-center gap-1.5 text-slate-600 mb-1"><Wallet class="w-4 h-4" /><span class="text-[10px] font-bold uppercase">Saldo total</span></div>
          <div class="text-lg font-bold" :class="totalCaixa >= 0 ? 'text-slate-900' : 'text-red-600'">{{ formatMoney(totalCaixa) }}</div>
          <div class="text-[10px] text-slate-400 font-medium">no caixa (fim do mês)</div>
        </div>
      </div>

      <!-- EXTRATO / LANÇAMENTOS DO MÊS -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 class="font-bold text-slate-800 flex items-center gap-2">
            <FileText class="w-4 h-4 text-indigo-500" /> Lançamentos de <span class="capitalize">{{ detalhe?.label }}</span>
          </h3>
          <span class="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">
            {{ detalhe?.lancamentos?.length || 0 }} lançamentos
          </span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
              <tr>
                <th class="px-6 py-3">Data</th>
                <th class="px-6 py-3">Descrição</th>
                <th class="px-6 py-3">Conta</th>
                <th class="px-6 py-3 text-right">Entrada</th>
                <th class="px-6 py-3 text-right">Saída</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-if="!detalhe?.lancamentos?.length">
                <td colspan="5" class="px-6 py-12 text-center text-slate-400 italic">Nenhum lançamento neste mês.</td>
              </tr>
              <tr v-for="item in detalhe?.lancamentos || []" :key="item.id" class="hover:bg-slate-50 transition-colors">
                <td class="px-6 py-3.5 text-slate-500 font-mono text-xs whitespace-nowrap">{{ formatDate(item.data) }}</td>
                <td class="px-6 py-3.5 font-medium text-slate-800">{{ item.descricao }}</td>
                <td class="px-6 py-3.5">
                  <span class="px-2.5 py-1 rounded text-[10px] font-bold border uppercase tracking-tight whitespace-nowrap"
                    :class="{
                      'bg-blue-50 text-blue-700 border-blue-100': (item.origem || '').toLowerCase().includes('brasil') || (item.origem || '').toLowerCase().includes('bb'),
                      'bg-sky-50 text-sky-700 border-sky-100': (item.origem || '').toLowerCase().includes('caixa') || (item.origem || '').toLowerCase().includes('cef'),
                      'bg-emerald-50 text-emerald-700 border-emerald-100': !(item.origem || '').toLowerCase().includes('brasil') && !(item.origem || '').toLowerCase().includes('bb') && !(item.origem || '').toLowerCase().includes('caixa') && !(item.origem || '').toLowerCase().includes('cef')
                    }">
                    {{ item.origem || '—' }}
                  </span>
                </td>
                <td class="px-6 py-3.5 text-right font-bold text-emerald-600">{{ item.tipo === 'entrada' ? formatMoney(Math.abs(item.valor)) : '—' }}</td>
                <td class="px-6 py-3.5 text-right font-bold text-red-500">{{ item.tipo !== 'entrada' ? formatMoney(Math.abs(item.valor)) : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

  </DashboardLayout>
</template>
