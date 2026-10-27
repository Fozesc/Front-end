<script setup>
import { onMounted, onBeforeUnmount } from 'vue';
import { X, CircleAlert, CircleCheck, Info } from 'lucide-vue-next';
import { avisos, fecharAviso } from '../../utils/avisos';

const ESTILO = {
  erro: { icone: CircleAlert, cor: 'text-red-600', borda: 'border-red-200' },
  ok: { icone: CircleCheck, cor: 'text-emerald-600', borda: 'border-emerald-200' },
  info: { icone: Info, cor: 'text-indigo-600', borda: 'border-slate-200' },
};

const tecla = (e) => {
  if (!avisos.pergunta) return;
  if (e.key === 'Escape') avisos.pergunta.responder(false);
};
onMounted(() => window.addEventListener('keydown', tecla));
onBeforeUnmount(() => window.removeEventListener('keydown', tecla));
</script>

<template>
  <div class="fixed bottom-4 right-4 z-[200] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 print:hidden" aria-live="polite">
    <div v-for="a in avisos.lista" :key="a.id" role="status"
         class="flex items-start gap-2.5 rounded-xl border bg-white px-4 py-3 text-sm text-slate-700 shadow-lg"
         :class="ESTILO[a.tipo].borda">
      <component :is="ESTILO[a.tipo].icone" class="mt-0.5 h-4 w-4 shrink-0" :class="ESTILO[a.tipo].cor" />
      <span class="flex-1">{{ a.texto }}</span>
      <button @click="fecharAviso(a.id)" aria-label="Fechar aviso" class="-mr-1 rounded p-0.5 text-slate-400 hover:text-slate-600">
        <X class="h-4 w-4" />
      </button>
    </div>
  </div>

  <div v-if="avisos.pergunta" class="fixed inset-0 z-[210] flex items-center justify-center p-4 print:hidden" role="alertdialog" aria-modal="true">
    <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" @click="avisos.pergunta.responder(false)"></div>
    <div class="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
      <h2 class="text-base font-semibold text-slate-900">{{ avisos.pergunta.titulo }}</h2>
      <p v-if="avisos.pergunta.mensagem" class="mt-1.5 text-sm text-slate-600">{{ avisos.pergunta.mensagem }}</p>
      <ul v-if="avisos.pergunta.consequencias.length" class="mt-3 list-disc space-y-1 pl-5 text-[13px] text-slate-500">
        <li v-for="c in avisos.pergunta.consequencias" :key="c">{{ c }}</li>
      </ul>
      <div class="mt-5 flex justify-end gap-2">
        <button @click="avisos.pergunta.responder(false)"
                class="h-9 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50">
          Cancelar
        </button>
        <button @click="avisos.pergunta.responder(true)" data-campo="confirmar"
                class="h-9 rounded-lg px-4 text-sm font-semibold text-white shadow-xs"
                :class="avisos.pergunta.perigo ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'">
          {{ avisos.pergunta.botao }}
        </button>
      </div>
    </div>
  </div>
</template>
