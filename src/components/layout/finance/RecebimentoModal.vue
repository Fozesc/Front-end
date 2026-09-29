<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  X, Split, Wallet, AlertTriangle, Loader2, CheckCircle2
} from 'lucide-vue-next';
import checkService from '../../../services/checkService';
import PartesPagamento from './PartesPagamento.vue';
import { CONTAS, FORMAS, ESTILO, arred, partesFecham, partesParaEnviar } from '../../../utils/contasCaixa';

const props = defineProps({
  cheque: { type: Object, required: true }
});
const emit = defineEmits(['close', 'confirmado']);

const modo = ref('unica');            // 'unica' = como sempre foi | 'dividido'
const contaUnica = ref('Dinheiro');
const formaUnica = ref('Dinheiro');
const partes = ref([]);
const erro = ref('');
const salvando = ref(false);

const total = computed(() => arred(props.cheque?.valor_bruto));
const podeConfirmar = computed(() => modo.value === 'unica' || partesFecham(partes.value, total.value));

const dinheiro = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const dataBR = (d) => (d ? d.split('-').reverse().join('/') : '-');

const trocarContaUnica = (conta) => {
  contaUnica.value = conta;
  if (!FORMAS[conta].includes(formaUnica.value)) formaUnica.value = FORMAS[conta][0];
};

const confirmar = async () => {
  if (!podeConfirmar.value || salvando.value) return;
  erro.value = '';
  salvando.value = true;
  try {
    const payment_data = modo.value === 'dividido'
      ? { partes: partesParaEnviar(partes.value) }
      : { method: contaUnica.value, forma: formaUnica.value };

    await checkService.updateStatus(props.cheque.id, 'Pago', { payment_data });
    emit('confirmado');
    emit('close');
  } catch (e) {
    erro.value = e.response?.data?.error || 'Erro ao dar baixa no título.';
  } finally {
    salvando.value = false;
  }
};

const aoTeclar = (e) => { if (e.key === 'Escape') emit('close'); };
onMounted(() => window.addEventListener('keydown', aoTeclar));
onUnmounted(() => window.removeEventListener('keydown', aoTeclar));
</script>

<template>
  <div class="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true">
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="$emit('close')"></div>

    <div class="relative z-10 w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[92vh]">

      <div class="bg-slate-900 px-6 py-5 flex justify-between items-start flex-shrink-0">
        <div>
          <h2 class="text-white text-lg font-bold flex items-center gap-2">
            <Wallet class="w-5 h-5 text-emerald-400" /> Receber Título
          </h2>
          <p class="text-slate-400 text-xs mt-1">
            {{ cheque.emitente || cheque.cliente }} · venc. {{ dataBR(cheque.vencimento) }}
            <span v-if="cheque.num_doc"> · doc {{ cheque.num_doc }}</span>
          </p>
        </div>
        <button @click="$emit('close')" aria-label="Fechar"
                class="text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors">
          <X class="w-4 h-4" />
        </button>
      </div>

      <div class="p-6 space-y-5 overflow-y-auto">

        <div class="text-center bg-slate-50 border border-slate-200 rounded-xl py-4">
          <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor a receber</span>
          <div class="text-3xl font-black text-slate-900 mt-0.5">{{ dinheiro(total) }}</div>
        </div>

        <div class="flex bg-slate-100 p-1 rounded-xl">
          <button @click="modo = 'unica'"
                  class="flex-1 py-2.5 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all uppercase tracking-wide"
                  :class="modo === 'unica' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'">
            <Wallet class="w-4 h-4" /> Uma conta só
          </button>
          <button @click="modo = 'dividido'"
                  class="flex-1 py-2.5 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all uppercase tracking-wide"
                  :class="modo === 'dividido' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'">
            <Split class="w-4 h-4" /> Dividir em partes
          </button>
        </div>

        <div v-if="erro" class="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm font-bold flex items-start gap-2">
          <AlertTriangle class="w-4 h-4 mt-0.5 flex-shrink-0" /> {{ erro }}
        </div>

        <!-- ------------------------------------------------ recebimento normal -->
        <div v-if="modo === 'unica'" class="space-y-4">
          <div>
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Onde o dinheiro entra</label>
            <div class="grid grid-cols-3 gap-2">
              <button v-for="c in CONTAS" :key="c.id" @click="trocarContaUnica(c.id)"
                      class="border-2 rounded-xl p-3 text-left transition-all"
                      :class="contaUnica === c.id ? ESTILO[c.id].ativo : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white'">
                <component :is="c.icone" class="w-5 h-5 mb-1.5" />
                <div class="text-xs font-bold leading-tight">{{ c.nome }}</div>
                <div class="text-[10px] opacity-70">{{ c.sub }}</div>
              </button>
            </div>
          </div>

          <div>
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Como recebeu</label>
            <div class="flex flex-wrap gap-2">
              <button v-for="f in FORMAS[contaUnica]" :key="f" @click="formaUnica = f"
                      class="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
                      :class="formaUnica === f ? ESTILO[contaUnica].chip : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'">
                {{ f }}
              </button>
            </div>
          </div>

          <p class="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
            Vai lançar <strong class="text-slate-800">{{ dinheiro(total) }}</strong> de entrada em
            <strong class="text-slate-800">{{ contaUnica }}</strong> — uma linha no caixa.
          </p>
        </div>

        <!-- ---------------------------------------------- recebimento dividido -->
        <PartesPagamento v-else v-model="partes" :total="total" @enviar="confirmar" />
      </div>

      <div class="bg-slate-50 px-6 py-4 border-t border-slate-200 flex gap-3 flex-shrink-0">
        <button @click="$emit('close')"
                class="px-5 py-3 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-100 transition-colors text-sm">
          Cancelar
        </button>
        <button @click="confirmar" :disabled="!podeConfirmar || salvando"
                class="flex-1 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed">
          <Loader2 v-if="salvando" class="w-4 h-4 animate-spin" />
          <CheckCircle2 v-else class="w-4 h-4" />
          {{ salvando ? 'Lançando...' : `Confirmar recebimento de ${dinheiro(total)}` }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-scale-in { animation: scaleIn 0.2s ease-out; }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
</style>
