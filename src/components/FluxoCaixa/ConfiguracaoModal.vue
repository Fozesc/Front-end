<script setup>
import { reactive, onMounted } from 'vue';
import { X, Save } from 'lucide-vue-next';
import transactionService from '../../services/transactionService'; 

const emit = defineEmits(['close', 'save']);

const form = reactive({
  capital_social: 0,
  saldo_inicial_bb: 0,
  saldo_inicial_ce: 0,
  saldo_inicial_caixa: 0
});

onMounted(async () => {
  try {
    // Buscamos os saldos atuais através do service de transação
    const dados = await transactionService.getBalances();
    if (dados) {
      // Mapeia o que vem do banco para o formulário
      // 'capital_investido' é como o seu backend retorna no get_balances
      form.capital_social = dados.capital_investido || 0;
      form.saldo_inicial_bb = dados.bb || 0;
      form.saldo_inicial_ce = dados.caixa || 0;
      form.saldo_inicial_caixa = dados.dinheiro || 0;
    }
  } catch (error) {
    console.error("Erro ao carregar saldos iniciais", error);
  }
});

const salvar = async () => {
  try {
    // Garantimos que os valores sejam números antes de enviar
    const payload = {
      capital_social: Number(form.capital_social),
      saldo_inicial_bb: Number(form.saldo_inicial_bb),
      saldo_inicial_ce: Number(form.saldo_inicial_ce),
      saldo_inicial_caixa: Number(form.saldo_inicial_caixa)
    };

    // Chamamos a rota de update de saldos iniciais no transactionService
    await transactionService.saveInitialBalances(payload);
    
    emit('save'); // Faz o Dashboard recarregar os cards
    emit('close');
  } catch (error) {
    console.error(error);
    alert("Erro ao salvar saldos iniciais.");
  }
};
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="$emit('close')"></div>
    
    <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
      <div class="bg-slate-900 px-6 py-4 flex justify-between items-center">
        <h2 class="text-lg font-bold text-white">Saldos Iniciais</h2>
        <button @click="$emit('close')" class="text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors">
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="p-6 space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Capital Social (Investimento)</label>
          <input v-model="form.capital_social" type="number" step="0.01" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" />
        </div>
        
        <div class="pt-4 border-t border-slate-100">
          <label class="block text-xs font-bold text-slate-500 uppercase mb-3">Saldos Iniciais das Contas</label>
          
          <div class="space-y-3">
            <div>
              <label class="text-sm text-slate-600 mb-1 block">Dinheiro (Cofre)</label>
              <input v-model="form.saldo_inicial_caixa" type="number" step="0.01" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
            <div>
              <label class="text-sm text-slate-600 mb-1 block">Banco do Brasil</label>
              <input v-model="form.saldo_inicial_bb" type="number" step="0.01" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label class="text-sm text-slate-600 mb-1 block">Caixa Econômica</label>
              <input v-model="form.saldo_inicial_ce" type="number" step="0.01" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none" />
            </div>
          </div>
        </div>
      </div>

      <div class="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-200">
        <button @click="$emit('close')" class="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg">Cancelar</button>
        <button @click="salvar" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg flex items-center">
          <Save class="w-4 h-4 mr-2" /> Salvar Saldos
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-scale-in { animation: scaleIn 0.2s ease-out; }
@keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
</style>