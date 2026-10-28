<script setup>
import { computed } from 'vue';
import { FAIXAS_REPUTACAO, COR_REPUTACAO, TEXTO_REPUTACAO } from '../../utils/reputacao';

// Reputacao num medidor de cores de 0 a 100: "grande" (meio circulo, ficha do cliente) ou "mini"
// (barrinha, lista e borderô). A cor nunca fica sozinha: o nivel e a nota vao escritos ao lado.
const props = defineProps({
  reputacao: { type: Object, required: true },
  tamanho: { type: String, default: 'grande' },
});

const nota = computed(() => props.reputacao.nota);
const temNota = computed(() => nota.value !== null && nota.value !== undefined);
const descricao = computed(() => temNota.value
  ? `Reputação ${props.reputacao.nivel}, nota ${nota.value} de 100`
  : 'Reputação sem histórico suficiente');

// meio circulo: 0 na esquerda, 100 na direita
const CX = 100, CY = 96, R = 78;
const ponto = (v, r = R) => {
  const a = Math.PI * (1 - v / 100);
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)];
};
const arco = (de, ate) => {
  const [x1, y1] = ponto(de);
  const [x2, y2] = ponto(ate);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
};
const faixas = computed(() => FAIXAS_REPUTACAO.map((f, i) => ({
  ...f, caminho: arco(f.de + (i ? 0.8 : 0), f.ate - (i < FAIXAS_REPUTACAO.length - 1 ? 0.8 : 0)),
})));
const ponteiro = computed(() => ponto(Math.min(Math.max(nota.value, 0), 100), R - 22));
const marcas = [0, 50, 75, 90, 100].map(v => ({ v, xy: ponto(v, R + 15) }));
</script>

<template>
  <div v-if="tamanho === 'mini'" class="flex items-center gap-2" role="img" :aria-label="descricao">
    <div class="relative w-20 h-1.5 rounded-full flex gap-px overflow-visible shrink-0">
      <div v-for="f in FAIXAS_REPUTACAO" :key="f.nivel" class="h-full first:rounded-l-full last:rounded-r-full"
           :style="{ width: (f.ate - f.de) + '%', backgroundColor: temNota ? f.cor : '#e2e8f0' }"></div>
      <span v-if="temNota" class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white ring-2 ring-slate-800 shadow-xs"
            :style="{ left: Math.min(Math.max(nota, 0), 100) + '%' }"></span>
    </div>
    <span class="text-xs font-medium tabular-nums whitespace-nowrap" :class="TEXTO_REPUTACAO[reputacao.nivel]">
      {{ reputacao.nivel }}<template v-if="temNota"> · {{ nota }}</template>
    </span>
  </div>

  <div v-else class="flex flex-col items-center" role="img" :aria-label="descricao" data-campo="medidor-reputacao">
    <svg viewBox="-14 0 228 112" class="w-full max-w-[230px]">
      <path v-for="f in faixas" :key="f.nivel" :d="f.caminho" fill="none" :stroke="temNota ? f.cor : '#e2e8f0'"
            stroke-width="14" stroke-linecap="butt" />
      <text v-for="m in marcas" :key="m.v" :x="m.xy[0]" :y="m.xy[1] + 3" text-anchor="middle"
            class="fill-slate-400" style="font-size: 9px">{{ m.v }}</text>
      <template v-if="temNota">
        <line :x1="CX" :y1="CY" :x2="ponteiro[0]" :y2="ponteiro[1]" stroke="#1e293b" stroke-width="3" stroke-linecap="round" />
        <circle :cx="CX" :cy="CY" r="6" fill="#1e293b" stroke="#ffffff" stroke-width="2" />
      </template>
    </svg>
    <div class="-mt-1 text-center">
      <div v-if="temNota" class="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{{ nota }}<span class="text-xs text-slate-400 font-normal ml-0.5">/ 100</span></div>
      <span class="inline-block mt-0.5 px-2 py-0.5 rounded-md text-xs font-medium border" :class="COR_REPUTACAO[reputacao.nivel]">{{ reputacao.nivel }}</span>
    </div>
  </div>
</template>
