<script setup>
import { reactive } from 'vue';
import { DollarSign, Save, X, Banknote, Building, Wallet, AlertTriangle, FileText } from 'lucide-vue-next';
import BaseDateInput from '../../common/BaseDateInput.vue'; 

import ClientSelect from '../../inputs/ClientSelect.vue'; 

const emit = defineEmits(['close', 'save']);

const form = reactive({
  client_id: null,
  cliente_nome: '',
  emitente: '', 
  banco: '', 
  num_doc: '', 
  vencimento: '', 
  valor_liquido: '', 
  contaSaida: 'Dinheiro',
  observacao: ''
});


const onClienteSelecionado = (cliente) => {
  if (cliente) {
    form.client_id = cliente.id;
    form.cliente_nome = cliente.name;
    
    form.emitente = cliente.name;
  } else {
 
    form.client_id = null;
    form.cliente_nome = '';
    form.emitente = '';
  }
};

const handleSave = () => {
  if (!form.client_id) { 
    alert('Por favor, selecione um cliente.'); 
    return; 
  }
  if (!form.valor_liquido || !form.vencimento) { 
    alert('Valor e Vencimento são obrigatórios.'); 
    return; 
  }
  
  emit('save', {
    client_id: form.client_id,
    valor: form.valor_liquido,
    vencimento: form.vencimento,
    banco: form.banco,
    num_doc: form.num_doc,
    emitente: form.emitente,
    contaSaida: form.contaSaida,
    observacao: form.observacao
  });
};
</script>

<template>
  <div class="fixed inset-0 z-[60] flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" @click="$emit('close')"></div>
    
    <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-in">
      
      <div class="bg-slate-900 px-6 py-4 flex justify-between items-center shrink-0">
        <div>
          <h2 class="text-xl font-bold text-white flex items-center">
            <DollarSign class="w-6 h-6 mr-2 text-emerald-400" /> Cheque Manual
          </h2>
          <p class="text-slate-400 text-sm">Inserção direta sem cálculo de borderô.</p>
        </div>
        <button @click="$emit('close')" class="text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all">
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="bg-amber-50 border-b border-amber-100 px-6 py-2 flex items-center gap-2 text-amber-700 text-xs font-bold">
        <AlertTriangle class="w-4 h-4" />
        <span>Atenção: Este lançamento gera uma operação manual e impacta o Fluxo de Caixa.</span>
      </div>

      <div class="p-6 overflow-y-auto custom-scrollbar">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-6">

          <div class="md:col-span-7 space-y-5">
            <h3 class="text-sm font-bold text-emerald-700 uppercase tracking-widest border-b border-emerald-100 pb-2 mb-4">Dados do Título</h3>

            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Cliente (Dono)</label>
              <ClientSelect 
                v-model="form.client_id" 
                @select="onClienteSelecionado"
              />
            </div>

            <div class="relative">
              <label class="block text-sm font-medium text-slate-700 mb-1">Emitente (Quem assinou)</label>
              <div class="relative">
                <FileText class="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input type="text" v-model="form.emitente" placeholder="Nome no cheque..." class="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
               <div class="relative">
                <label class="block text-sm font-medium text-slate-700 mb-1">Banco</label>
                <div class="relative">
                  <Banknote class="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input type="text" v-model="form.banco" placeholder="Ex: Itaú" class="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Nº Doc</label>
                <input v-model="form.num_doc" type="text" class="w-full px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="000123" />
              </div>
            </div>
          </div>

          <div class="md:col-span-5 bg-slate-50 p-5 rounded-xl border border-slate-200 flex flex-col">
            <div>
              <h3 class="text-sm font-bold text-emerald-700 uppercase tracking-widest border-b border-emerald-100 pb-2 mb-4">Financeiro</h3>
              <div class="space-y-4">
                
                <div>
                  <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Vencimento</label>
                  <BaseDateInput v-model="form.vencimento" />
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-slate-700">Valor do Cheque (R$)</label>
                  <input v-model="form.valor_liquido" type="number" step="0.01" class="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm" placeholder="0,00" />
                </div>

                <div>
                  <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Saiu de onde?</label>
                  <div class="grid grid-cols-3 gap-2">
                    <button @click="form.contaSaida = 'Dinheiro'" 
                      class="flex flex-col items-center justify-center p-2 rounded-lg border transition-all text-xs font-bold"
                      :class="form.contaSaida === 'Dinheiro' ? 'border-emerald-500 bg-emerald-100 text-emerald-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'">
                      <Wallet class="w-4 h-4 mb-1" /> Dinheiro
                    </button>
                    <button @click="form.contaSaida = 'Banco do Brasil'" 
                      class="flex flex-col items-center justify-center p-2 rounded-lg border transition-all text-xs font-bold"
                      :class="form.contaSaida === 'Banco do Brasil' ? 'border-blue-500 bg-blue-100 text-blue-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'">
                      <Building class="w-4 h-4 mb-1" /> BB
                    </button>
                    <button @click="form.contaSaida = 'Caixa Econômica'" 
                      class="flex flex-col items-center justify-center p-2 rounded-lg border transition-all text-xs font-bold"
                      :class="form.contaSaida === 'Caixa Econômica' ? 'border-blue-500 bg-blue-100 text-blue-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'">
                      <Banknote class="w-4 h-4 mb-1" /> Caixa
                    </button>
                  </div>
                </div>

              </div>
            </div>
            
            <div class="mt-4">
              <label class="block text-sm font-medium text-slate-700 mb-1">Obs</label>
              <textarea v-model="form.observacao" rows="2" class="w-full p-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm outline-none resize-none placeholder-slate-400" placeholder="Anotações opcionais..."></textarea>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-slate-100 px-6 py-4 flex justify-end gap-3 border-t border-slate-200">
        <button @click="$emit('close')" class="px-6 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg transition-colors">Cancelar</button>
        <button @click="handleSave" class="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2 rounded-lg font-bold shadow-lg flex items-center transition-transform active:scale-95">
          <Save class="w-4 h-4 mr-2" /> Salvar Cheque
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes scale-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
.animate-scale-in { animation: scale-in 0.2s ease-out forwards; }
.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
</style>