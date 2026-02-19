<script setup>
import { ref, computed } from 'vue';
import { X, CalendarClock, Save, AlertTriangle } from 'lucide-vue-next';
import checkService from '../../../services/checkService'; 

const props = defineProps({
  cheque: Object,
  isOpen: Boolean
});

const emit = defineEmits(['close', 'save']);

const loading = ref(false);
const form = ref({
  new_date: '',
  fee_amount: 0,
  notes: ''
});


const diasExtras = computed(() => {
  if (!form.value.new_date || !props.cheque) return 0;
  const atual = new Date(props.cheque.vencimento); 
  const nova = new Date(form.value.new_date);
  const diff = nova - atual;
  const dias = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return dias > 0 ? dias : 0;
});

const salvar = async () => {
  if (!form.value.new_date) return alert('Selecione a nova data.');
  
  loading.value = true;
  try {
    await checkService.prorrogate(props.cheque.id, {
      new_date: form.value.new_date,
      fee_amount: form.value.fee_amount,
      notes: form.value.notes
    });
    emit('save'); // Avisa o pai para recarregar a lista
  } catch (error) {
    alert(error.response?.data?.error || "Erro ao prorrogar.");
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
        <button @click="$emit('close')"><X class="w-5 h-5"/></button>
      </div>

      <div class="p-6 space-y-4">
        <div class="bg-indigo-50 p-3 rounded-lg text-sm text-indigo-900 border border-indigo-100">
          Você está alterando o vencimento de <strong>{{ props.cheque.num_doc }}</strong>.
          <br>Atual: <strong>{{ props.cheque.vencimento.split('-').reverse().join('/') }}</strong>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Nova Data de Vencimento</label>
          <input type="date" v-model="form.new_date" class="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700">
          <div v-if="diasExtras > 0" class="text-xs text-emerald-600 font-bold mt-1">+ {{ diasExtras }} dias adicionados</div>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Taxa de Prorrogação (Juros Cobrados)</label>
          <div class="relative">
            <span class="absolute left-3 top-2 text-slate-400">R$</span>
            <input type="number" step="0.01" v-model="form.fee_amount" class="w-full border border-slate-300 rounded-lg p-2 pl-8 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700">
          </div>
          <p class="text-[10px] text-slate-400 mt-1">* Esse valor será registrado no histórico, mas não altera o valor de face do cheque.</p>
        </div>

        <div>
           <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Observação</label>
           <textarea v-model="form.notes" rows="2" class="w-full border border-slate-300 rounded-lg p-2 text-sm" placeholder="Motivo da prorrogação..."></textarea>
        </div>
      </div>

      <div class="p-4 bg-slate-50 flex justify-end gap-2 border-t border-slate-200">
        <button @click="$emit('close')" class="px-4 py-2 text-slate-600 font-bold text-sm hover:bg-slate-200 rounded-lg">Cancelar</button>
        <button @click="salvar" :disabled="loading" class="px-4 py-2 bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 rounded-lg flex items-center gap-2">
          <Save v-if="!loading" class="w-4 h-4" />
          <span v-else>Salvando...</span>
          Confirmar
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-scale-in { animation: scaleIn 0.2s ease-out; }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
</style>