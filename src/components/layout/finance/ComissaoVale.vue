<script setup>
import { ref, computed, watch } from 'vue';
import { Loader2, HandCoins } from 'lucide-vue-next';
import valeService from '../../../services/valeService';
import { arred } from '../../../utils/contasCaixa';

// Comissao descontada de um vale (borderô e prorrogacao): abate ate o que falta no vale e so o
// que passar sai do caixa. A lista de vales so carrega quando ele marca a opcao.
const props = defineProps({
  comissao: { type: Number, default: 0 },
  conta: { type: String, default: '' }
});
const ativo = defineModel('ativo', { type: Boolean, default: false });
const valeId = defineModel({ default: null });

const vales = ref(null);
const erro = ref('');
// recarrega a cada vez que marca: o saldo do vale pode ter mudado (outro borderô abateu)
watch(ativo, async (ligado) => {
  if (!ligado) return;
  vales.value = null;
  try {
    vales.value = (await valeService.getAll({ status: 'Aberto', per_page: 100 })).items.filter(v => v.saldo > 0);
  } catch (e) {
    erro.value = 'Não foi possível carregar os vales.';
    vales.value = [];
  }
});

const vale = computed(() => (ativo.value && vales.value?.find(v => v.id === valeId.value)) || null);
const noVale = computed(() => (vale.value ? Math.min(props.comissao, vale.value.saldo) : 0));
const noCaixa = computed(() => arred(props.comissao - noVale.value));
const quita = computed(() => vale.value && noVale.value >= vale.value.saldo - 0.005);
defineExpose({ noVale });
const moeda = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
</script>

<template>
  <div class="text-xs space-y-1.5" data-campo="comissao-vale">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <label class="flex items-center gap-2 text-sm font-semibold text-violet-800 cursor-pointer">
        <input type="checkbox" v-model="ativo" class="w-4 h-4 accent-violet-600" data-campo="abater-vale">
        <HandCoins class="w-4 h-4" /> Descontar a comissão de um vale
      </label>
      <template v-if="ativo">
        <span v-if="vales === null" class="text-slate-400 flex items-center gap-1"><Loader2 class="w-3.5 h-3.5 animate-spin" /> carregando os vales...</span>
        <span v-else-if="!vales.length" class="text-slate-500">{{ erro || 'Nenhum vale em aberto.' }}</span>
        <select v-else v-model="valeId" aria-label="Vale que recebe a comissão" data-campo="vale-abater"
                class="min-w-0 max-w-full h-8 bg-white border border-slate-300 rounded-md px-2 text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 outline-none shadow-xs">
          <option :value="null" disabled>Escolha o vale...</option>
          <option v-for="v in vales" :key="v.id" :value="v.id">Vale #{{ v.id }} · {{ v.descricao }} · falta {{ moeda(v.saldo) }}</option>
        </select>
      </template>
    </div>
    <p v-if="ativo && !(comissao > 0)" class="text-amber-700 font-medium">Preencha a comissão para descontar do vale.</p>
    <p v-else-if="vale" class="text-slate-700" data-campo="abatimento-resumo">
      <strong class="tabular-nums">{{ moeda(noVale) }}</strong> {{ quita ? 'quitam' : 'abatem' }} o vale #{{ vale.id }}<template v-if="!quita"> (fica faltando <strong class="tabular-nums">{{ moeda(vale.saldo - noVale) }}</strong>)</template><template v-if="noCaixa > 0"> e <strong class="tabular-nums">{{ moeda(noCaixa) }}</strong> saem do {{ conta }}.</template><template v-else> — nada da comissão sai do caixa.</template>
      <span class="block text-slate-500">No caixa: a comissão sai inteira e o desconto entra como pagamento do vale.</span>
    </p>
  </div>
</template>
