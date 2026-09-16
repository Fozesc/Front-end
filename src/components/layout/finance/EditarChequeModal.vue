<script setup>
import { reactive, ref } from 'vue';
import { Pencil, Save, X, Lock, AlertTriangle } from 'lucide-vue-next';
import BaseDateInput from '../../common/BaseDateInput.vue';
import checkService from '../../../services/checkService';

const props = defineProps({
  cheque: { type: Object, required: true }
});
const emit = defineEmits(['close', 'saved']);

const form = reactive({
  emitente: props.cheque.emitente || '',
  vencimento: props.cheque.vencimento || '',
  data_operacao: props.cheque.data_operacao || '',
  data_pagamento: props.cheque.data_pagamento || '',
  senha: ''
});

const erro = ref('');
const salvando = ref(false);

const formatCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const salvar = async () => {
  erro.value = '';
  if (!form.emitente.trim()) { erro.value = 'O emitente não pode ficar vazio.'; return; }
  if (!form.vencimento) { erro.value = 'Informe o vencimento.'; return; }
  if (!form.senha) { erro.value = 'Digite sua senha para confirmar a alteração.'; return; }

  salvando.value = true;
  try {
    await checkService.update(props.cheque.id, { ...form });
    emit('saved');
  } catch (e) {
    erro.value = e.response?.data?.error || 'Não foi possível salvar a alteração.';
  } finally {
    salvando.value = false;
    form.senha = '';
  }
};
</script>

<template>
  <div class="fixed inset-0 z-[70] flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="emit('close')"></div>

    <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

      <div class="bg-slate-900 px-6 py-4 flex justify-between items-center shrink-0">
        <div>
          <h2 class="text-xl font-bold text-white flex items-center">
            <Pencil class="w-5 h-5 mr-2 text-amber-400" /> Editar cheque
          </h2>
          <p class="text-slate-400 text-xs mt-0.5">
            Borderô #{{ cheque.operation_id }} &middot; {{ cheque.cliente }} &middot; Doc {{ cheque.num_doc || 'S/N' }}
          </p>
        </div>
        <button @click="emit('close')" class="text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all">
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="bg-amber-50 border-b border-amber-100 px-6 py-2 flex items-center gap-2 text-amber-800 text-xs font-bold">
        <AlertTriangle class="w-4 h-4 shrink-0" />
        <span>Valor, juros e líquido não são editáveis aqui. A alteração fica registrada na Auditoria.</span>
      </div>

      <div class="p-6 overflow-y-auto space-y-5">

        <div class="grid grid-cols-3 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
          <div>
            <div class="text-[10px] font-bold text-slate-400 uppercase">Valor bruto</div>
            <div class="font-bold text-slate-700 text-sm">{{ formatCurrency(cheque.valor_bruto) }}</div>
          </div>
          <div>
            <div class="text-[10px] font-bold text-slate-400 uppercase">Juros</div>
            <div class="font-bold text-slate-700 text-sm">{{ formatCurrency(cheque.juros) }}</div>
          </div>
          <div>
            <div class="text-[10px] font-bold text-slate-400 uppercase">Líquido</div>
            <div class="font-bold text-slate-700 text-sm">{{ formatCurrency(cheque.valor_liquido) }}</div>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Emitente</label>
          <input v-model="form.emitente" type="text" maxlength="100"
                 class="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Vencimento</label>
            <BaseDateInput v-model="form.vencimento" />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Data de pagamento</label>
            <BaseDateInput v-model="form.data_pagamento" />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Data da operação</label>
          <BaseDateInput v-model="form.data_operacao" />
          <p class="text-xs text-slate-500 mt-1">
            Vale para o borderô #{{ cheque.operation_id }} inteiro — todos os cheques dele mudam de data.
          </p>
        </div>

        <div class="bg-slate-900 rounded-xl p-4">
          <label class="text-white text-sm font-bold flex items-center mb-2">
            <Lock class="w-4 h-4 mr-2 text-amber-400" /> Confirme com a sua senha
          </label>
          <input v-model="form.senha" type="password" autocomplete="current-password"
                 placeholder="Senha do seu login"
                 @keyup.enter="salvar"
                 class="w-full px-3 py-2.5 bg-white/10 border border-white/20 text-white rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-slate-500" />
          <p class="text-slate-400 text-xs mt-2">
            Sem a senha nada é alterado. É a trava para ninguém mudar data ou nome sem querer.
          </p>
        </div>

        <div v-if="erro" class="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm font-bold">
          {{ erro }}
        </div>
      </div>

      <div class="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 shrink-0">
        <button @click="emit('close')" class="px-4 py-2 text-slate-600 font-bold text-sm hover:text-slate-900">
          Cancelar
        </button>
        <button @click="salvar" :disabled="salvando"
                class="bg-slate-900 text-white px-5 py-2 rounded-lg font-bold text-sm flex items-center shadow-md disabled:opacity-50">
          <Save class="w-4 h-4 mr-2" /> {{ salvando ? 'Salvando...' : 'Salvar alteração' }}
        </button>
      </div>
    </div>
  </div>
</template>
