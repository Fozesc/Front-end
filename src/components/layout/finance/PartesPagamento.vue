<script setup>
// Editor de pagamento dividido (parte no dinheiro, parte no banco...). Usado no Receber
// e na prorrogacao: as partes somam `total`.
import { computed, onMounted } from 'vue';
import { Plus, Trash2, CheckCircle2, Divide, Link2 } from 'lucide-vue-next';
import { CONTAS, FORMAS, ESTILO, arred, somaPartes } from '../../../utils/contasCaixa';

const props = defineProps({
  modelValue: { type: Array, required: true },
  total: { type: Number, required: true },
  compacto: { type: Boolean, default: false }
});
const emit = defineEmits(['update:modelValue', 'enviar']);

const partes = computed(() => props.modelValue);
const restante = computed(() => arred(props.total - somaPartes(partes.value)));
const fecha = computed(() =>
  partes.value.length > 0 &&
  partes.value.every(p => (Number(p.valor) || 0) > 0) &&
  Math.abs(restante.value) < 0.005
);

const pct = (v) => (props.total > 0 ? ((Number(v) || 0) / props.total) * 100 : 0);
const pctTexto = (v) => {
  const p = pct(v);
  return `${p % 1 === 0 ? p.toFixed(0) : p.toFixed(1)}%`;
};
const dinheiro = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const dividirIgualmente = () => {
  const lista = partes.value.length ? partes.value.map(p => ({ ...p })) : [
    { conta: 'Dinheiro', forma: 'Dinheiro', valor: 0 },
    { conta: 'BB', forma: 'PIX', valor: 0 }
  ];
  const centavos = Math.round(props.total * 100);
  const fatia = Math.floor(centavos / lista.length);
  lista.forEach((p, i) => {
    const extra = i === lista.length - 1 ? centavos - fatia * lista.length : 0;
    p.valor = arred((fatia + extra) / 100);
  });
  emit('update:modelValue', lista);
};

onMounted(() => { if (!partes.value.length) dividirIgualmente(); });

const adicionarParte = () => {
  if (partes.value.length >= 10) return;
  const usadas = partes.value.map(p => p.conta);
  const livre = CONTAS.find(c => !usadas.includes(c.id))?.id || 'Dinheiro';
  emit('update:modelValue', [...partes.value,
    { conta: livre, forma: FORMAS[livre][0], valor: restante.value > 0 ? restante.value : 0 }]);
};

const removerParte = (i) => emit('update:modelValue', partes.value.filter((_, j) => j !== i));

const trocarConta = (parte, conta) => {
  parte.conta = conta;
  if (!FORMAS[conta].includes(parte.forma)) parte.forma = FORMAS[conta][0];
};

const usarRestante = (parte) => {
  parte.valor = arred((Number(parte.valor) || 0) + restante.value);
};
</script>

<template>
  <div class="space-y-3">
    <div :class="compacto ? '' : 'sticky -top-6 bg-white pt-6 pb-2 z-10'">
      <div class="flex h-2.5 rounded-full overflow-hidden bg-slate-200">
        <div v-for="(p, i) in partes" :key="'b' + i"
             class="transition-all duration-300"
             :class="ESTILO[p.conta].barra"
             :style="{ width: Math.min(pct(p.valor), 100) + '%' }"></div>
      </div>
      <div class="flex justify-between items-center mt-2 text-xs">
        <div class="flex flex-wrap gap-x-3 gap-y-1">
          <span v-for="(p, i) in partes" :key="'l' + i" class="flex items-center gap-1.5 text-slate-500 font-bold">
            <span class="w-2 h-2 rounded-full" :class="ESTILO[p.conta].ponto"></span>
            {{ p.conta }} {{ pctTexto(p.valor) }}
          </span>
        </div>
        <span v-if="fecha" class="flex items-center gap-1 font-semibold text-emerald-600 text-xs">
          <CheckCircle2 class="w-3.5 h-3.5" /> Fechou
        </span>
        <span v-else class="font-semibold text-xs" data-campo="partes-restante"
              :class="restante > 0 ? 'text-amber-600' : 'text-red-600'">
          {{ restante > 0 ? `Falta ${dinheiro(restante)}` : `Passou ${dinheiro(-restante)}` }}
        </span>
      </div>
    </div>

    <div :class="compacto ? 'grid grid-cols-2 gap-2' : 'space-y-2'">
      <div v-for="(p, i) in partes" :key="'p' + i"
           class="border border-slate-200 rounded-xl p-3 bg-white hover:border-slate-300 transition-colors">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-medium text-slate-500">Parte {{ i + 1 }}</span>
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded-md text-[11px] font-bold border" :class="ESTILO[p.conta].chip">
              {{ pctTexto(p.valor) }}
            </span>
            <button v-if="partes.length > 1" @click="removerParte(i)" aria-label="Remover parte"
                    class="text-slate-300 hover:text-red-600 transition-colors p-1">
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-1.5 mb-2">
          <button v-for="c in CONTAS" :key="c.id" @click="trocarConta(p, c.id)" :title="c.nome"
                  class="border-2 rounded-lg py-1.5 px-1 flex items-center justify-center gap-1.5 transition-all"
                  :class="p.conta === c.id ? ESTILO[c.id].ativo : 'border-slate-200 text-slate-400 hover:border-slate-300'">
            <component :is="c.icone" class="w-4 h-4 flex-shrink-0" />
            <span class="text-[11px] font-bold truncate">{{ c.curto }}</span>
          </button>
        </div>

        <div class="grid grid-cols-12 gap-2 items-center">
          <select v-model="p.forma" aria-label="Como recebeu"
                  class="col-span-5 bg-white border border-slate-300 rounded-lg py-2 px-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow">
            <option v-for="f in FORMAS[p.conta]" :key="f" :value="f">{{ f }}</option>
          </select>

          <div class="col-span-7 relative">
            <span class="absolute left-2.5 top-2.5 text-[11px] font-bold text-slate-400">R$</span>
            <input v-model="p.valor" type="number" step="0.01" min="0" inputmode="decimal"
                   aria-label="Valor da parte" data-campo="parte-valor"
                   @focus="$event.target.select()" @keyup.enter="emit('enviar')"
                   class="w-full border border-slate-300 rounded-lg py-2 pl-8 pr-2 text-sm font-bold text-slate-800 text-right outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" />
          </div>
        </div>

        <button v-if="!fecha && restante !== 0" @click="usarRestante(p)"
                class="mt-2 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline">
          jogar o restante aqui ({{ dinheiro(restante) }})
        </button>
      </div>
    </div>

    <div class="flex gap-2">
      <button @click="adicionarParte" :disabled="partes.length >= 10"
              class="flex-1 border-2 border-dashed border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 rounded-xl py-2 text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-40">
        <Plus class="w-4 h-4" /> Adicionar parte
      </button>
      <button @click="dividirIgualmente()"
              class="border-2 border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700 rounded-xl py-2 px-4 text-xs font-bold flex items-center justify-center gap-2 transition-colors">
        <Divide class="w-4 h-4" /> Igualmente
      </button>
    </div>

    <p v-if="!compacto" class="text-xs text-slate-500 bg-indigo-50 border border-indigo-100 rounded-lg p-3 flex items-start gap-2">
      <Link2 class="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
      <span>
        Cada parte entra no caixa <strong class="text-indigo-900">na sua conta</strong>, com o valor
        dela, tudo vinculado a este mesmo pagamento — no Fluxo de Caixa as linhas aparecem agrupadas.
      </span>
    </p>
  </div>
</template>

<style scoped>
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
input[type="number"] { -moz-appearance: textfield; }
</style>
