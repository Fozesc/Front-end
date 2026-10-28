<script setup>
import { ref, computed, onMounted } from 'vue';
import { ShieldAlert, Loader2 } from 'lucide-vue-next';
import checkService from '../../services/checkService';
import { AJUDA } from '../../utils/ajuda';

// Quem assinou os cheques que estao na rua: quem concentra mais dinheiro (se ele quebrar, quanto
// vai junto) e quem mais deu problema (devolvido, juridico, vencido sem pagar).
const aba = ref('maiores');
const dados = ref(null);
const carregando = ref(true);

onMounted(async () => {
  try {
    dados.value = await checkService.riscoEmitentes();
  } catch (e) {
    console.error('Erro ao buscar risco por emitente', e);
  } finally {
    carregando.value = false;
  }
});

const linhas = computed(() => dados.value?.[aba.value] || []);
const moeda = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const pct = (v) => (dados.value?.total_em_aberto ? (100 * v) / dados.value.total_em_aberto : 0);
</script>

<template>
  <div class="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden" data-campo="risco-emitentes">
    <div class="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h3 class="text-base font-semibold text-slate-900 cursor-help w-fit" v-dica="AJUDA.riscoEmitentes">Risco por emitente</h3>
        <p class="text-sm text-slate-500">Quem assinou os títulos em aberto: concentração e quem deu problema</p>
      </div>
      <div class="flex bg-slate-100 p-0.5 rounded-lg shrink-0">
        <button @click="aba = 'maiores'" class="px-3 py-1.5 text-xs font-medium rounded-md transition-all" :class="aba === 'maiores' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'">Maior exposição</button>
        <button @click="aba = 'problemas'" class="px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5" :class="aba === 'problemas' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'">
          <ShieldAlert class="w-3.5 h-3.5" :class="aba === 'problemas' ? 'text-red-600' : ''" /> Com problema
          <span v-if="dados?.problemas.length" class="px-1.5 rounded-full bg-red-100 text-red-700 text-[11px] font-bold tabular-nums">{{ dados.problemas.length }}</span>
        </button>
      </div>
    </div>

    <div v-if="carregando" class="p-8 flex justify-center text-slate-400"><Loader2 class="w-5 h-5 animate-spin" /></div>
    <p v-else-if="!linhas.length" class="p-8 text-center text-slate-400 text-sm">
      {{ aba === 'problemas' ? 'Nenhum emitente com devolvido, jurídico ou vencido em aberto.' : 'Nenhum título em aberto.' }}
    </p>
    <div v-else class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="bg-slate-50/80 text-slate-500 text-xs font-medium border-b border-slate-200">
          <tr>
            <th class="px-5 py-2">Emitente</th>
            <th class="px-3 py-2 text-center">Clientes</th>
            <th class="px-3 py-2 text-center">Títulos em aberto</th>
            <th class="px-3 py-2">Problemas</th>
            <th class="px-5 py-2 text-right">Em aberto</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="l in linhas" :key="l.emitente" class="hover:bg-slate-50/70">
            <td class="px-5 py-2.5 font-medium text-slate-800 max-w-[260px] truncate" :title="l.emitente">{{ l.emitente }}</td>
            <td class="px-3 py-2.5 text-center tabular-nums text-slate-600">{{ l.clientes }}</td>
            <td class="px-3 py-2.5 text-center tabular-nums text-slate-600">{{ l.titulos_abertos }}</td>
            <td class="px-3 py-2.5">
              <div class="flex flex-wrap gap-1">
                <span v-if="l.devolvidos" class="px-1.5 py-px rounded-md text-[11px] font-medium border bg-orange-50 text-orange-700 border-orange-200">{{ l.devolvidos }} devolvido(s)</span>
                <span v-if="l.juridico" class="px-1.5 py-px rounded-md text-[11px] font-medium border bg-purple-50 text-purple-700 border-purple-200">{{ l.juridico }} jurídico</span>
                <span v-if="l.vencidos" class="px-1.5 py-px rounded-md text-[11px] font-medium border bg-red-50 text-red-700 border-red-200">{{ l.vencidos }} vencido(s)</span>
                <span v-if="!l.devolvidos && !l.juridico && !l.vencidos" class="text-xs text-slate-400">—</span>
              </div>
            </td>
            <td class="px-5 py-2.5 text-right">
              <div class="font-semibold text-slate-900 tabular-nums">{{ moeda(l.em_aberto) }}</div>
              <div class="flex items-center justify-end gap-2 mt-1">
                <div class="w-20 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div class="h-1.5 rounded-full" :class="pct(l.em_aberto) >= 20 ? 'bg-red-500' : pct(l.em_aberto) >= 10 ? 'bg-amber-500' : 'bg-indigo-500'" :style="{ width: Math.min(pct(l.em_aberto), 100) + '%' }"></div>
                </div>
                <span class="text-[11px] text-slate-500 tabular-nums w-10 text-right">{{ pct(l.em_aberto).toFixed(1).replace('.', ',') }}%</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
