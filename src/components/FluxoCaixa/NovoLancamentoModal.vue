<script setup>
import { reactive, onMounted, computed } from 'vue';
import { X, Save, ArrowUpCircle, ArrowDownCircle, ArrowLeftRight, Wallet, Building, Banknote } from 'lucide-vue-next';
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
  category: 'Geral',
  conta_entrada: 'Dinheiro',
  conta_saida: 'BB'
});

const CONTAS = [
  { id: 'Dinheiro', nome: 'Dinheiro', icone: Wallet, ativo: 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500' },
  { id: 'BB', nome: 'BB', icone: Building, ativo: 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500' },
  { id: 'Caixa', nome: 'Caixa', icone: Banknote, ativo: 'border-sky-500 bg-sky-50 text-sky-700 ring-1 ring-sky-500' }
];

const isEdicao = computed(() => !!props.lancamento);
const isTrocaExistente = computed(() => !!props.lancamento?.troca_id);

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
  if (form.tipo === 'troca') {
    if (!form.valor || parseFloat(form.valor) <= 0) return alert("Preencha o valor");
    if (form.conta_entrada === form.conta_saida) return alert("Escolha contas diferentes para a troca");
    return emit('save', {
      troca: true,
      descricao: form.descricao,
      valor: Math.abs(parseFloat(form.valor)),
      data: form.data,
      conta_entrada: form.conta_entrada,
      conta_saida: form.conta_saida
    });
  }
  if (!form.descricao || !form.valor) return alert("Preencha descrição e valor");
  

  let valorFinal = Math.abs(parseFloat(form.valor));


  if (form.tipo === 'saida') {
    valorFinal = valorFinal * -1;
  }

  emit('save', {
    ...form,
    valor: valorFinal
  });
};
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="$emit('close')"></div>
    
    <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">
      
      <div class="bg-white px-6 py-4 border-b border-slate-200 flex justify-between items-center">
        <h2 class="text-base font-semibold text-slate-900 flex items-center gap-2">
          <span v-if="isEdicao">Editar Lançamento</span>
          <span v-else>Novo Lançamento</span>
        </h2>
        <button @click="$emit('close')" class="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-lg transition-colors"><X class="w-5 h-5" /></button>
      </div>

      <div class="p-6 space-y-5">
        
        <div v-if="isTrocaExistente" class="flex items-center gap-2 text-xs text-indigo-800 bg-indigo-50 border border-indigo-200 rounded-lg p-3">
          <ArrowLeftRight class="w-4 h-4 shrink-0" /> Lançamento de troca: valor, data e descrição também são atualizados na outra linha.
        </div>
        <div v-else class="flex bg-slate-100 p-1 rounded-lg">
          <button @click="form.tipo = 'entrada'" class="flex-1 py-2 text-sm font-bold rounded-md flex items-center justify-center gap-2 transition-all" :class="form.tipo === 'entrada' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'">
            <ArrowUpCircle class="w-4 h-4" /> Entrada
          </button>
          <button @click="form.tipo = 'saida'" class="flex-1 py-2 text-sm font-bold rounded-md flex items-center justify-center gap-2 transition-all" :class="form.tipo === 'saida' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'">
            <ArrowDownCircle class="w-4 h-4" /> Saída
          </button>
          <button v-if="!isEdicao" @click="form.tipo = 'troca'" class="flex-1 py-2 text-sm font-bold rounded-md flex items-center justify-center gap-2 transition-all" :class="form.tipo === 'troca' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'">
            <ArrowLeftRight class="w-4 h-4" /> Troca
          </button>
        </div>

        <div>
          <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Descrição</label>
          <input v-model="form.descricao" type="text" class="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" :placeholder="form.tipo === 'troca' ? 'Ex: João - dinheiro por PIX' : 'Ex: Pagamento Fornecedor'" />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Valor (R$)</label>
            <input v-model="form.valor" type="number" step="0.01" class="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none font-bold text-slate-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" placeholder="0,00" />
          </div>
          <div>
            <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Data</label>
            <BaseDateInput v-model="form.data" />
          </div>
        </div>

        <div v-if="form.tipo === 'troca'" class="space-y-4">
          <div v-for="lado in [{ campo: 'conta_entrada', rotulo: 'Entra em (o que recebi)' }, { campo: 'conta_saida', rotulo: 'Sai de (o que entreguei)' }]" :key="lado.campo">
            <label class="block text-[13px] font-medium text-slate-700 mb-2">{{ lado.rotulo }}</label>
            <div class="grid grid-cols-3 gap-2">
              <button v-for="c in CONTAS" :key="c.id" @click="form[lado.campo] = c.id" class="flex flex-col items-center justify-center p-3 rounded-lg border transition-all text-xs font-bold gap-1" :class="form[lado.campo] === c.id ? c.ativo : 'border-slate-200 hover:bg-slate-50 text-slate-500'">
                <component :is="c.icone" class="w-5 h-5" /> {{ c.nome }}
              </button>
            </div>
          </div>
          <p v-if="form.conta_entrada === form.conta_saida" class="text-xs text-red-600 font-medium">Escolha contas diferentes.</p>
          <p v-else-if="form.valor > 0" class="text-xs text-slate-500">
            Entrada de <strong class="text-emerald-600">R$ {{ Number(form.valor).toFixed(2) }}</strong> em {{ form.conta_entrada }} e saída de <strong class="text-red-600">R$ {{ Number(form.valor).toFixed(2) }}</strong> em {{ form.conta_saida }}. O total do caixa não muda.
          </p>
        </div>

        <div v-else>
          <label class="block text-[13px] font-medium text-slate-700 mb-2">Conta / Origem</label>
          <div class="grid grid-cols-3 gap-2">
            <button v-for="c in CONTAS" :key="c.id" @click="form.origem = c.id" class="flex flex-col items-center justify-center p-3 rounded-lg border transition-all text-xs font-bold gap-1" :class="form.origem === c.id ? c.ativo : 'border-slate-200 hover:bg-slate-50 text-slate-500'">
              <component :is="c.icone" class="w-5 h-5" /> {{ c.nome }}
            </button>
          </div>
        </div>
      </div>

      <div class="bg-slate-50/70 px-6 py-4 flex justify-end gap-3 border-t border-slate-200">
        <button @click="$emit('close')" class="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold shadow-xs hover:bg-slate-50 text-sm">Cancelar</button>
        <button @click="salvar" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-semibold shadow-xs flex items-center text-sm">
          <Save class="w-4 h-4 mr-2" /> {{ isEdicao ? 'Salvar Alterações' : 'Adicionar' }}
        </button>
      </div>
    </div>
  </div>
</template>