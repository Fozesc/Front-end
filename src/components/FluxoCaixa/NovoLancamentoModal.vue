<script setup>
import { reactive, onMounted, computed } from 'vue';
import { X, Save, ArrowUpCircle, ArrowDownCircle, Wallet, Building, Banknote } from 'lucide-vue-next';
import BaseDateInput from '../common/BaseDateInput.vue';

const props = defineProps({
  lancamento: { type: Object, default: null } 
});

const emit = defineEmits(['close', 'save']);

const form = reactive({
  tipo: 'entrada',
  descricao: '',
  valor: '',
  data: new Date().toISOString().split('T')[0],
  origem: 'Dinheiro',
  category: 'Geral'
});

const isEdicao = computed(() => !!props.lancamento);

onMounted(() => {

  if (props.lancamento) {

    form.tipo = props.lancamento.tipo;
    form.descricao = props.lancamento.descricao; 
    form.valor = props.lancamento.valor; 
    form.data = props.lancamento.data;
    form.origem = props.lancamento.origem || 'Dinheiro';
    form.category = props.lancamento.category || 'Geral';
  }
});

const salvar = () => {
  if (!form.descricao || !form.valor) return alert("Preencha descrição e valor");
  
  emit('save', {
    ...form,
    // Garante que o valor seja enviado como número
    valor: parseFloat(form.valor)
  });
};
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="$emit('close')"></div>
    
    <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">
      
      <div class="bg-slate-900 px-6 py-4 flex justify-between items-center">
        <h2 class="text-lg font-bold text-white flex items-center gap-2">
          <span v-if="isEdicao">Editar Lançamento</span>
          <span v-else>Novo Lançamento</span>
        </h2>
        <button @click="$emit('close')" class="text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"><X class="w-5 h-5" /></button>
      </div>

      <div class="p-6 space-y-5">
        
        <div class="flex bg-slate-100 p-1 rounded-lg">
          <button @click="form.tipo = 'entrada'" class="flex-1 py-2 text-sm font-bold rounded-md flex items-center justify-center gap-2 transition-all" :class="form.tipo === 'entrada' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'">
            <ArrowUpCircle class="w-4 h-4" /> Entrada
          </button>
          <button @click="form.tipo = 'saida'" class="flex-1 py-2 text-sm font-bold rounded-md flex items-center justify-center gap-2 transition-all" :class="form.tipo === 'saida' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'">
            <ArrowDownCircle class="w-4 h-4" /> Saída
          </button>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição</label>
          <input v-model="form.descricao" type="text" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: Pagamento Fornecedor" />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Valor (R$)</label>
            <input v-model="form.valor" type="number" step="0.01" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" placeholder="0,00" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Data</label>
            <BaseDateInput v-model="form.data" />
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Conta / Origem</label>
          <div class="grid grid-cols-3 gap-2">
            <button @click="form.origem = 'Dinheiro'" class="flex flex-col items-center justify-center p-3 rounded-lg border transition-all text-xs font-bold gap-1" :class="form.origem === 'Dinheiro' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500' : 'border-slate-200 hover:bg-slate-50 text-slate-500'">
              <Wallet class="w-5 h-5" /> Dinheiro
            </button>
            <button @click="form.origem = 'Banco do Brasil'" class="flex flex-col items-center justify-center p-3 rounded-lg border transition-all text-xs font-bold gap-1" :class="form.origem === 'Banco do Brasil' ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500' : 'border-slate-200 hover:bg-slate-50 text-slate-500'">
              <Building class="w-5 h-5" /> BB
            </button>
            <button @click="form.origem = 'Caixa Econômica'" class="flex flex-col items-center justify-center p-3 rounded-lg border transition-all text-xs font-bold gap-1" :class="form.origem === 'Caixa Econômica' ? 'border-sky-500 bg-sky-50 text-sky-700 ring-1 ring-sky-500' : 'border-slate-200 hover:bg-slate-50 text-slate-500'">
              <Banknote class="w-5 h-5" /> Caixa
            </button>
          </div>
        </div>
      </div>

      <div class="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-200">
        <button @click="$emit('close')" class="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg">Cancelar</button>
        <button @click="salvar" class="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg flex items-center">
          <Save class="w-4 h-4 mr-2" /> {{ isEdicao ? 'Salvar Alterações' : 'Adicionar' }}
        </button>
      </div>
    </div>
  </div>
</template>