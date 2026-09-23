<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { X, CalendarClock, Save, AlertTriangle, Wallet, Loader2 } from 'lucide-vue-next';
import checkService from '../../../services/checkService'; 
import settingsService from '../../../services/settingsService';
import { motivoNaoUtil, proximoDiaUtil } from '../../../utils/diasUteis';

const props = defineProps({
  cheque: Object,
  isOpen: Boolean
});

const emit = defineEmits(['close', 'save']);

const loading = ref(false);
const errorMessage = ref('');
const taxaProrrogacaoBase = ref(0);

const form = ref({
  new_date: '',
  fee_amount: 0,
  notes: '',
  method: 'Dinheiro'
});

onMounted(async () => {
  try {
    const settings = await settingsService.get();
    taxaProrrogacaoBase.value = settings.extension_rate || 0;
  } catch (e) {
    console.error("Erro ao carregar taxa de prorrogação:", e);
  }
});

// Cheque nao compensa em fim de semana nem feriado: a data escolhida e' adiada para
// o proximo dia util, e ele pode recusar. O juros da prorrogacao recalcula sozinho
// pelo watch de diasExtras - a formula nao foi tocada.
const ajusteData = ref(null);
let ignorarProximo = false;

watch(() => form.value.new_date, (nova) => {
  if (ignorarProximo) { ignorarProximo = false; return; }
  if (!nova) { ajusteData.value = null; return; }
  const motivo = motivoNaoUtil(nova);
  if (!motivo) { ajusteData.value = null; return; }
  const util = proximoDiaUtil(nova);
  ajusteData.value = { de: nova, para: util, motivo, mantida: false };
  ignorarProximo = true;
  form.value.new_date = util;
});

const manterDataOriginal = () => {
  ignorarProximo = true;
  form.value.new_date = ajusteData.value.de;
  ajusteData.value = { ...ajusteData.value, mantida: true };
};

const adiarNovamente = () => {
  ignorarProximo = true;
  form.value.new_date = ajusteData.value.para;
  ajusteData.value = { ...ajusteData.value, mantida: false };
};

const dataBR = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

const diasExtras = computed(() => {
  if (!form.value.new_date || !props.cheque) return 0;
  const atual = new Date(props.cheque.vencimento); 
  const nova = new Date(form.value.new_date);
  const diff = nova - atual;
  const dias = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return dias > 0 ? dias : 0;
});

watch(diasExtras, (novosDias) => {
  if (novosDias > 0 && taxaProrrogacaoBase.value > 0) {
    const valorCheque = props.cheque.valor_bruto || 0;
    const taxaMensal = taxaProrrogacaoBase.value / 100;
    const calculo = (valorCheque * taxaMensal / 30) * novosDias;
    form.value.fee_amount = parseFloat(calculo.toFixed(2));
  } else {
    form.value.fee_amount = 0;
  }
});

const salvar = async () => {
  errorMessage.value = '';
  if (!form.value.new_date) {
      errorMessage.value = 'Selecione a nova data de vencimento.';
      return;
  }
  
  loading.value = true;
  try {
    await checkService.prorrogate(props.cheque.id, {
      new_date: form.value.new_date,
      fee_amount: form.value.fee_amount,
      notes: form.value.notes,
      method: form.value.method
    });
    emit('save');
    emit('close');
  } catch (error) {
    errorMessage.value = error.response?.data?.error || "Erro ao prorrogar o título.";
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[80] flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="$emit('close')"></div>
    
    <div class="bg-white w-full max-w-md rounded-xl shadow-2xl relative z-10 overflow-hidden animate-scale-in">
      <div class="bg-indigo-900 p-4 flex justify-between items-center text-white">
        <h3 class="font-bold flex items-center gap-2"><CalendarClock class="w-5 h-5"/> Prorrogar Título</h3>
        <button @click="$emit('close')" class="hover:text-indigo-200 transition-colors"><X class="w-5 h-5"/></button>
      </div>

      <div class="p-6 space-y-4">
        
        <div v-if="errorMessage" class="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg text-sm font-bold flex items-center gap-2">
          <AlertTriangle class="w-4 h-4" /> {{ errorMessage }}
        </div>

        <div class="bg-indigo-50 p-3 rounded-lg text-sm text-indigo-900 border border-indigo-100">
          Vencimento atual: <strong>{{ props.cheque.vencimento.split('-').reverse().join('/') }}</strong>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Nova Data de Vencimento</label>
          <input type="date" v-model="form.new_date" class="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700">
          <div v-if="diasExtras > 0" class="text-xs text-emerald-600 font-bold mt-1">
            + {{ diasExtras }} dias (Taxa: {{ taxaProrrogacaoBase }}% a.m.)
          </div>

          <div v-if="ajusteData" class="mt-2 rounded-lg border p-2.5 text-xs"
               :class="ajusteData.mantida ? 'bg-slate-100 border-slate-300' : 'bg-amber-50 border-amber-200'">
            <div class="flex items-start gap-2">
              <CalendarClock class="w-3.5 h-3.5 mt-0.5 shrink-0"
                             :class="ajusteData.mantida ? 'text-slate-500' : 'text-amber-600'" />
              <div class="flex-1">
                <p :class="ajusteData.mantida ? 'text-slate-700' : 'text-amber-900'">
                  <strong>{{ dataBR(ajusteData.de) }}</strong> cai em {{ ajusteData.motivo }}.
                  <span v-if="!ajusteData.mantida">Adiei para <strong>{{ dataBR(ajusteData.para) }}</strong>.</span>
                  <span v-else>Mantida como você escolheu.</span>
                </p>
                <button v-if="!ajusteData.mantida" @click="manterDataOriginal"
                        class="mt-1 font-bold text-amber-800 underline hover:text-amber-900">
                  Não adiar, manter {{ dataBR(ajusteData.de) }}
                </button>
                <button v-else @click="adiarNovamente"
                        class="mt-1 font-bold text-slate-700 underline hover:text-slate-900">
                  Adiar para {{ dataBR(ajusteData.para) }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
            <div :class="form.fee_amount > 0 ? 'col-span-1' : 'col-span-2'">
              <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Valor dos Juros</label>
              <div class="relative">
                  <span class="absolute left-3 top-2 text-slate-400 font-bold">R$</span>
                  <input type="number" step="0.01" v-model="form.fee_amount" class="w-full border border-slate-300 rounded-lg p-2 pl-8 focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-700 text-lg">
              </div>
            </div>

            <div v-if="form.fee_amount > 0" class="col-span-1 animate-scale-in">
                <label class="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><Wallet class="w-3 h-3"/> Conta Destino</label>
                <select v-model="form.method" class="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 text-sm h-[42px]">
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="BB">Banco do Brasil</option>
                    <option value="Caixa">Caixa Econômica</option>
                </select>
            </div>
        </div>

        <div>
           <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Observação</label>
           <textarea v-model="form.notes" rows="2" class="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Motivo..."></textarea>
        </div>
      </div>

      <div class="p-4 bg-slate-50 flex justify-end gap-2 border-t border-slate-200">
        <button @click="$emit('close')" class="px-4 py-2 text-slate-600 font-bold text-sm hover:bg-slate-200 rounded-lg">Cancelar</button>
        <button @click="salvar" :disabled="loading" class="px-5 py-2 bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 rounded-lg flex items-center gap-2 transition-colors shadow-md disabled:opacity-50">
          <Save v-if="!loading" class="w-4 h-4" />
          <Loader2 v-else class="w-4 h-4 animate-spin" />
          {{ loading ? 'Salvando...' : 'Confirmar' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-scale-in { animation: scaleIn 0.2s ease-out; }
@keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
</style>