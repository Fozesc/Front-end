<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { X, Trash2, Lock, AlertTriangle, Loader2 } from 'lucide-vue-next';
import checkService from '../../../services/checkService';

const props = defineProps({
  cheque: { type: Object, required: true }
});
const emit = defineEmits(['close', 'excluido']);

const previa = ref(null);
const senha = ref('');
const erro = ref('');
const apagando = ref(false);

const moeda = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const dataBR = (d) => (d ? d.split('-').reverse().join('/') : '');

const apagar = async () => {
  erro.value = '';
  if (!senha.value) { erro.value = 'Digite sua senha para confirmar.'; return; }
  apagando.value = true;
  try {
    await checkService.delete(props.cheque.id, senha.value);
    emit('excluido');
  } catch (e) {
    erro.value = e.response?.data?.error || 'Não foi possível apagar o título.';
  } finally {
    apagando.value = false;
    senha.value = '';
  }
};

const aoTeclar = (e) => { if (e.key === 'Escape') emit('close'); };
onMounted(async () => {
  window.addEventListener('keydown', aoTeclar);
  try {
    previa.value = await checkService.previaExclusao(props.cheque.id);
  } catch (e) {
    erro.value = e.response?.data?.error || 'Não foi possível conferir o que muda no caixa.';
  }
});
onUnmounted(() => window.removeEventListener('keydown', aoTeclar));
</script>

<template>
  <div class="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="emit('close')"></div>
    <div class="relative z-10 w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]" data-modal="excluir-titulo">
      <div class="border-b border-slate-200 px-6 py-4 flex justify-between items-start">
        <div class="min-w-0">
          <h2 class="text-base font-semibold text-slate-900 flex items-center gap-2"><Trash2 class="w-5 h-5 text-red-600" /> Apagar título</h2>
          <p class="text-slate-500 text-sm mt-0.5 truncate">
            Borderô #{{ cheque.operation_id }} · {{ cheque.cliente }} · Doc {{ cheque.num_doc || 'S/N' }} · {{ moeda(cheque.valor_bruto) }}
          </p>
        </div>
        <button @click="emit('close')" aria-label="Fechar" class="p-2 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"><X class="w-5 h-5" /></button>
      </div>

      <div class="p-6 space-y-4 overflow-y-auto text-sm">
        <div>
          <h3 class="text-[13px] font-medium text-slate-700 mb-1.5">O que muda no caixa</h3>
          <div v-if="!previa && !erro" class="flex items-center gap-2 text-slate-500"><Loader2 class="w-4 h-4 animate-spin" /> Conferindo...</div>
          <template v-else-if="previa">
            <p v-if="!previa.caixa.length" class="text-slate-600 bg-slate-50 border border-slate-200 rounded-md p-3">Nada: este título não tem lançamento no caixa.</p>
            <ul v-else class="divide-y divide-slate-100 border border-slate-200 rounded-md" data-campo="previa-caixa">
              <li v-for="(c, i) in previa.caixa" :key="i" class="px-3 py-2 flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="font-medium text-slate-800 truncate" :title="c.descricao">{{ c.descricao }}</div>
                  <div class="text-xs text-slate-500">{{ c.tipo === 'entrada' ? 'Entrada' : 'Saída' }} · {{ c.conta }} · {{ dataBR(c.data) }}</div>
                </div>
                <div class="text-right shrink-0 tabular-nums">
                  <div class="text-xs text-slate-400 line-through">{{ moeda(c.de) }}</div>
                  <div v-if="c.para === null" class="text-xs font-semibold text-red-600">apagado</div>
                  <div v-else class="font-semibold text-slate-900">{{ moeda(c.para) }}</div>
                </div>
              </li>
            </ul>
            <div v-if="previa.caixa.length" class="mt-2 flex justify-between items-baseline px-1">
              <span class="text-slate-600">Efeito no saldo do caixa</span>
              <b class="tabular-nums" :class="previa.efeito_saldo >= 0 ? 'text-emerald-700' : 'text-red-600'">
                {{ previa.efeito_saldo >= 0 ? '+' : '−' }} {{ moeda(Math.abs(previa.efeito_saldo)) }}
              </b>
            </div>
            <p v-for="c in previa.vales" :key="c.vale" class="mt-2 text-xs text-violet-800 bg-violet-50 border border-violet-200 rounded-md p-2.5">
              Saem {{ moeda(c.valor) }} do desconto no vale #{{ c.vale }} feito com a comissão: o vale volta a dever esse valor.
            </p>
            <p v-if="previa.bordero_apagado" class="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2.5">
              É o último título: o Borderô #{{ previa.bordero }} também é apagado.
            </p>
          </template>
        </div>

        <div class="bg-amber-50/60 border border-amber-200 rounded-lg p-4">
          <label for="excluir-senha" class="text-slate-900 text-sm font-semibold flex items-center mb-2">
            <Lock class="w-4 h-4 mr-2 text-amber-600" /> Confirme com a sua senha
          </label>
          <input id="excluir-senha" v-model="senha" type="password" autocomplete="current-password" placeholder="Senha do seu login"
                 @keyup.enter="apagar" data-campo="excluir-senha"
                 class="h-10 w-full px-3 bg-white border border-slate-300 text-slate-900 rounded-md text-sm outline-none placeholder:text-slate-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15 shadow-xs" />
          <p class="text-slate-600 text-xs mt-2">Não tem desfazer. Fica registrado na Auditoria.</p>
        </div>

        <div v-if="erro" class="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md font-medium flex items-start gap-2">
          <AlertTriangle class="w-4 h-4 mt-0.5 flex-shrink-0" /> {{ erro }}
        </div>
      </div>

      <div class="bg-slate-50/70 px-6 py-4 border-t border-slate-200 flex gap-3">
        <button @click="emit('close')" class="px-4 h-10 bg-white border border-slate-300 text-slate-700 font-semibold rounded-md shadow-xs hover:bg-slate-50 text-sm">Cancelar</button>
        <button @click="apagar" :disabled="!previa || apagando" data-campo="excluir-confirmar"
                class="flex-1 h-10 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-md shadow-xs text-sm flex items-center justify-center gap-2 disabled:opacity-60">
          <Loader2 v-if="apagando" class="w-4 h-4 animate-spin" /><Trash2 v-else class="w-4 h-4" /> Apagar título
        </button>
      </div>
    </div>
  </div>
</template>
