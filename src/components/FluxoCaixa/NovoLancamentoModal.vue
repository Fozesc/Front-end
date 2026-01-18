<script setup>
import { ref } from 'vue';
import { 
  X, Save, DollarSign, Calendar, FileText, 
  ArrowUpCircle, ArrowDownCircle 
} from 'lucide-vue-next';

const emit = defineEmits(['close', 'save']);

const form = ref({
  data: new Date().toISOString().split('T')[0],
  descricao: '',
  tipo: 'saida', // entrada ou saida
  valor: '',
  categoria: 'Despesas Gerais'
});

const salvar = () => {
  if (!form.value.descricao || !form.value.valor) return alert('Preencha os dados obrigatórios.');
  
  emit('save', {
    ...form.value,
    id: Date.now(),
    valor: parseFloat(form.value.valor),
    origem: 'Manual'
  });
  emit('close');
};
</script>

<template>
  <div class="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 transition-all">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden transform transition-all scale-100">
      
      <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
        <div>
          <h3 class="font-bold text-lg text-slate-800">Novo Lançamento</h3>
          <p class="text-xs text-slate-500">Adicione uma entrada ou despesa manual</p>
        </div>
        <button @click="$emit('close')" class="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors">
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="p-6 space-y-5">
        
        <div>
          <label class="block text-xs font-bold text-slate-400 uppercase mb-2 tracking-wider">Tipo de Movimento</label>
          <div class="grid grid-cols-2 gap-3">
            <button 
              @click="form.tipo = 'entrada'" 
              class="flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all duration-200"
              :class="form.tipo === 'entrada' 
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-bold' 
                : 'border-slate-100 bg-white text-slate-500 hover:border-emerald-200 hover:bg-slate-50'"
            >
              <ArrowUpCircle class="w-5 h-5" :class="form.tipo === 'entrada' ? 'text-emerald-600' : 'text-slate-300'" />
              Entrada
            </button>

            <button 
              @click="form.tipo = 'saida'" 
              class="flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all duration-200"
              :class="form.tipo === 'saida' 
                ? 'border-red-500 bg-red-50 text-red-700 font-bold' 
                : 'border-slate-100 bg-white text-slate-500 hover:border-red-200 hover:bg-slate-50'"
            >
              <ArrowDownCircle class="w-5 h-5" :class="form.tipo === 'saida' ? 'text-red-600' : 'text-slate-300'" />
              Saída
            </button>
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição</label>
          <div class="relative group">
            <div class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
              <FileText class="w-5 h-5" />
            </div>
            <input 
              v-model="form.descricao" 
              type="text" 
              placeholder="Ex: Compra de Material, Café..." 
              class="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium text-slate-700" 
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Data</label>
            <div class="relative group">
              <div class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none">
                <Calendar class="w-5 h-5" />
              </div>
              <input 
                v-model="form.data" 
                type="date" 
                class="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium text-slate-700" 
              />
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Valor (R$)</label>
            <div class="relative group">
              <div class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none">
                <DollarSign class="w-5 h-5" />
              </div>
              <input 
                v-model="form.valor" 
                type="number" 
                step="0.01" 
                placeholder="0,00"
                class="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-bold text-slate-800 text-right" 
              />
            </div>
          </div>
        </div>
      </div>

      <div class="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
        <button 
          @click="$emit('close')" 
          class="px-5 py-2.5 text-slate-500 font-bold hover:text-slate-700 hover:bg-white border border-transparent hover:border-slate-200 rounded-xl transition-all"
        >
          Cancelar
        </button>
        <button 
          @click="salvar" 
          class="px-8 py-2.5 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 flex items-center transition-all hover:-translate-y-0.5"
          :class="form.tipo === 'entrada' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'"
        >
          <Save class="w-5 h-5 mr-2" />
          Confirmar
        </button>
      </div>

    </div>
  </div>
</template>