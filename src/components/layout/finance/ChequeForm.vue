<script setup>
import { reactive, ref, computed } from 'vue';
import { User, Calendar, DollarSign, Save, X, Banknote, Building } from 'lucide-vue-next';

const emit = defineEmits(['close', 'save']);

const dbSugestoes = {
  clientes: [
    { nome: 'Mari de Quadros', limite: 50000, taxa: 5.5 },
    { nome: 'João Silva Construções', limite: 100000, taxa: 4.0 },
  ],
  bancos: ['Banco do Brasil', 'Bradesco', 'Santander', 'Itaú', 'Nubank'],
  emitentes: ['Rodrigo Ivan Vicari', 'Construtora Alfa']
};

const form = reactive({
  cliente: '', emitente: '', banco: '', num_doc: '', vencimento: '', valor_liquido: '', juros: '', dt_operacao: new Date().toISOString().split('T')[0], status: 'Em Carteira', destino: '', observacao: ''
});

const activeField = ref(null);

const suggestions = computed(() => {
  if (!activeField.value) return [];
  const termo = form[activeField.value]?.toLowerCase() || '';
  if (termo.length === 0) return [];
  if (activeField.value === 'cliente') return dbSugestoes.clientes.filter(c => c.nome.toLowerCase().includes(termo));
  if (activeField.value === 'banco') return dbSugestoes.bancos.filter(b => b.toLowerCase().includes(termo));
  if (activeField.value === 'emitente') return dbSugestoes.emitentes.filter(e => e.toLowerCase().includes(termo));
  return [];
});

const selectItem = (field, item) => {
  if (field === 'cliente') {
    form.cliente = item.nome;
    form.observacao = `Limite: R$ ${item.limite} | Taxa: ${item.taxa}%`;
  } else {
    form[field] = item;
  }
  activeField.value = null;
};

const handleSave = () => {
  if (!form.cliente || !form.valor_liquido) { alert('Preencha Cliente e Valor.'); return; }
  emit('save', { ...form, id: Date.now() });
};
</script>

<template>
  <div class="fixed inset-0 z-[60] flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" @click="$emit('close')"></div>
    
    <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-in">
      
      <div class="bg-slate-900 px-6 py-4 flex justify-between items-center shrink-0">
        <div><h2 class="text-xl font-bold text-white flex items-center"><DollarSign class="w-6 h-6 mr-2 text-emerald-400" /> Novo Borderô</h2><p class="text-slate-400 text-sm">Cadastro de título.</p></div>
        <button @click="$emit('close')" class="text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all"><X class="w-5 h-5" /></button>
      </div>

      <div class="p-6 overflow-y-auto custom-scrollbar">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-6">

          <div class="md:col-span-7 space-y-5">
            <h3 class="text-sm font-bold text-emerald-700 uppercase tracking-widest border-b border-emerald-100 pb-2 mb-4">Dados do Cliente</h3>

            <div class="relative">
              <label class="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
              <div class="relative"><User class="w-4 h-4 absolute left-3 top-3 text-slate-400" /><input type="text" v-model="form.cliente" @input="activeField = 'cliente'" placeholder="Buscar..." class="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-all" autocomplete="off"/></div>
              <ul v-if="activeField === 'cliente' && suggestions.length > 0" class="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-40 overflow-y-auto"><li v-for="c in suggestions" :key="c.nome" @click="selectItem('cliente', c)" class="px-4 py-3 hover:bg-emerald-50 cursor-pointer border-b border-slate-50 last:border-0"><div class="font-bold text-slate-800 text-sm">{{ c.nome }}</div></li></ul>
            </div>

            <div class="relative">
              <label class="block text-sm font-medium text-slate-700 mb-1">Emitente</label>
              <div class="relative"><Building class="w-4 h-4 absolute left-3 top-3 text-slate-400" /><input type="text" v-model="form.emitente" @input="activeField = 'emitente'" placeholder="Quem assinou?" class="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none" autocomplete="off"/></div>
               <ul v-if="activeField === 'emitente' && suggestions.length > 0" class="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-40 overflow-y-auto"><li v-for="c in suggestions" :key="c" @click="selectItem('emitente', c)" class="px-4 py-3 hover:bg-emerald-50 cursor-pointer border-b border-slate-50 last:border-0"><div class="font-bold text-slate-800 text-sm">{{ c }}</div></li></ul>
            </div>

            <div class="grid grid-cols-2 gap-4">
               <div class="relative">
                <label class="block text-sm font-medium text-slate-700 mb-1">Banco</label>
                <div class="relative"><Banknote class="w-4 h-4 absolute left-3 top-3 text-slate-400" /><input type="text" v-model="form.banco" @input="activeField = 'banco'" placeholder="Ex: Itaú" class="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none" autocomplete="off"/></div>
                 <ul v-if="activeField === 'banco' && suggestions.length > 0" class="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-40 overflow-y-auto"><li v-for="c in suggestions" :key="c" @click="selectItem('banco', c)" class="px-4 py-3 hover:bg-emerald-50 cursor-pointer border-b border-slate-50 last:border-0"><div class="font-bold text-slate-800 text-sm">{{ c }}</div></li></ul>
              </div>
              <div><label class="block text-sm font-medium text-slate-700 mb-1">Nº Doc</label><input v-model="form.num_doc" type="text" class="w-full px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="000123" /></div>
            </div>
          </div>

          <div class="md:col-span-5 bg-slate-50 p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
            <div>
              <h3 class="text-sm font-bold text-emerald-700 uppercase tracking-widest border-b border-emerald-100 pb-2 mb-4">Valores</h3>
              <div class="space-y-4">
                <div class="grid grid-cols-2 gap-3">
                   <div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Operação</label><input v-model="form.dt_operacao" type="date" class="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 outline-none" /></div>
                   <div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Vencimento</label><input v-model="form.vencimento" type="date" class="w-full px-3 py-2 bg-white border border-emerald-400 rounded-lg text-sm text-emerald-900 font-bold outline-none" /></div>
                </div>
                <div><label class="block text-sm font-medium text-slate-700">Valor (R$)</label><input v-model="form.valor_liquido" type="number" step="0.01" class="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500" placeholder="0,00" /></div>
                <div><label class="block text-sm font-medium text-slate-700">Juros (R$)</label><input v-model="form.juros" type="number" step="0.01" class="w-full px-4 py-2 rounded-lg border border-slate-300 bg-white text-purple-700 font-medium outline-none" placeholder="0,00" /></div>
                 <div><label class="block text-sm font-medium text-slate-700">Destino</label><select v-model="form.destino" class="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 outline-none"><option value="">Selecione...</option><option value="Sicoob">Sicoob</option><option value="Inter">Inter</option></select></div>
              </div>
            </div>
            <div class="mt-6"><label class="block text-sm font-medium text-slate-700 mb-1">Observações</label><textarea v-model="form.observacao" rows="3" class="w-full p-3 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm outline-none resize-none"></textarea></div>
          </div>
        </div>
      </div>

      <div class="bg-slate-100 px-6 py-4 flex justify-end gap-3 border-t border-slate-200">
        <button @click="$emit('close')" class="px-6 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg transition-colors">Cancelar</button>
        <button @click="handleSave" class="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2 rounded-lg font-bold shadow-lg flex items-center transition-transform active:scale-95"><Save class="w-4 h-4 mr-2" /> Salvar</button>
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