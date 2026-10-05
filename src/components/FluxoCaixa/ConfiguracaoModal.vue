<script setup>
import { reactive, onMounted } from 'vue';
import { X, Save } from 'lucide-vue-next';
import transactionService from '../../services/transactionService'; 

const emit = defineEmits(['close', 'save']);

const form = reactive({
  capital_social: 0
});

onMounted(async () => {
  try {
    const dados = await transactionService.getBalances();
    if (dados) {
      // Carrega apenas o capital total do investimento
      form.capital_social = Number(dados.capital_total || 0).toFixed(2);
    }
  } catch (error) {
    console.error("Erro ao carregar capital social:", error);
  }
});

const salvar = async () => {
  try {
    const payload = {
      capital_social: Number(form.capital_social)
    };

    await transactionService.saveInitialBalances(payload);
    
    emit('save'); 
    emit('close');
  } catch (error) {
    console.error(error);
    alert("Erro ao salvar capital social.");
  }
};
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="$emit('close')"></div>
    
    <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in">
      <div class="bg-white px-6 py-4 border-b border-slate-200 flex justify-between items-center">
        <h2 class="text-base font-semibold text-slate-900">Configurações</h2>
        <button @click="$emit('close')" class="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-lg transition-colors">
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="p-6 space-y-4">
        <div>
          <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Capital Social (Investimento Inicial)</label>
          <input 
            v-model="form.capital_social" 
            type="number" 
            step="0.01" 
            class="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none font-bold text-slate-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" 
            placeholder="0.00"
          />
          <p class="text-[10px] text-slate-400 mt-2">Este valor é usado como base para calcular o crescimento do seu patrimônio.</p>
        </div>
      </div>

      <div class="bg-slate-50/70 px-6 py-4 flex justify-end gap-3 border-t border-slate-200">
        <button @click="$emit('close')" class="px-4 py-2 rounded-lg text-sm bg-white border border-slate-300 text-slate-700 font-semibold shadow-xs hover:bg-slate-50">Cancelar</button>
        <button @click="salvar" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold shadow-xs flex items-center text-sm">
          <Save class="w-4 h-4 mr-2" /> Salvar Alteração
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-scale-in { animation: scaleIn 0.2s ease-out; }
@keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
</style>