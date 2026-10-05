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

      <div class="bg-white px-6 py-4 border-b border-slate-200 flex justify-between items-center shrink-0">
        <div>
          <h2 class="text-base font-semibold text-slate-900 flex items-center">
            <Pencil class="w-5 h-5 mr-2 text-amber-600" /> Editar cheque
          </h2>
          <p class="text-slate-500 text-sm mt-0.5">
            Borderô #{{ cheque.operation_id }} &middot; {{ cheque.cliente }} &middot; Doc {{ cheque.num_doc || 'S/N' }}
          </p>
        </div>
        <button @click="emit('close')" class="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-lg transition-colors">
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="bg-amber-50 border-b border-amber-100 px-6 py-2.5 flex items-center gap-2 text-amber-800 text-xs font-medium">
        <AlertTriangle class="w-4 h-4 shrink-0" />
        <span>Valor, juros e líquido não são editáveis aqui. A alteração fica registrada na Auditoria.</span>
      </div>

      <div class="p-6 overflow-y-auto space-y-5">

        <div class="grid grid-cols-3 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
          <div>
            <div class="text-xs font-medium text-slate-500">Valor bruto</div>
            <div class="font-semibold text-slate-800 text-sm tabular-nums">{{ formatCurrency(cheque.valor_bruto) }}</div>
          </div>
          <div>
            <div class="text-xs font-medium text-slate-500">Juros</div>
            <div class="font-semibold text-slate-800 text-sm tabular-nums">{{ formatCurrency(cheque.juros) }}</div>
          </div>
          <div>
            <div class="text-xs font-medium text-slate-500">Líquido</div>
            <div class="font-semibold text-slate-800 text-sm tabular-nums">{{ formatCurrency(cheque.valor_liquido) }}</div>
          </div>
        </div>

        <div>
          <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Emitente</label>
          <input v-model="form.emitente" type="text" maxlength="100"
                 class="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Vencimento</label>
            <BaseDateInput v-model="form.vencimento" />
          </div>
          <div>
            <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Data de pagamento</label>
            <BaseDateInput v-model="form.data_pagamento" />
          </div>
        </div>

        <div>
          <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Data da operação</label>
          <BaseDateInput v-model="form.data_operacao" />
          <p class="text-xs text-slate-500 mt-1">
            Vale para o borderô #{{ cheque.operation_id }} inteiro — todos os cheques dele mudam de data.
          </p>
        </div>

        <div class="bg-amber-50/60 border border-amber-200 rounded-xl p-4">
          <label class="text-slate-900 text-sm font-semibold flex items-center mb-2">
            <Lock class="w-4 h-4 mr-2 text-amber-600" /> Confirme com a sua senha
          </label>
          <input v-model="form.senha" type="password" autocomplete="current-password"
                 placeholder="Senha do seu login"
                 @keyup.enter="salvar"
                 class="w-full px-3 py-2.5 bg-white border border-slate-300 text-slate-900 rounded-lg text-sm outline-none placeholder:text-slate-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15 shadow-xs transition-shadow" />
          <p class="text-slate-600 text-xs mt-2">
            Sem a senha nada é alterado. É a trava para ninguém mudar data ou nome sem querer.
          </p>
        </div>

        <div v-if="erro" class="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm font-medium">
          {{ erro }}
        </div>
      </div>

      <div class="px-6 py-4 border-t border-slate-200 bg-slate-50/70 flex justify-end gap-3 shrink-0">
        <button @click="emit('close')" class="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-semibold text-sm rounded-lg shadow-xs hover:bg-slate-50">
          Cancelar
        </button>
        <button @click="salvar" :disabled="salvando"
                class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center shadow-xs ring-1 ring-inset ring-white/10 disabled:opacity-50">
          <Save class="w-4 h-4 mr-2" /> {{ salvando ? 'Salvando...' : 'Salvar alteração' }}
        </button>
      </div>
    </div>
  </div>
</template>
