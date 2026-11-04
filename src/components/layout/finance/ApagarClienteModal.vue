<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { Trash2, Lock, AlertTriangle, Loader2 } from 'lucide-vue-next';
import clientService from '../../../services/clientService';

// so cliente sem borderô (o servidor confere); com borderô o caminho e' apagar os borderôs ou juntar cadastros
const props = defineProps({ cliente: { type: Object, required: true } });
const emit = defineEmits(['close', 'apagado']);

const senha = ref('');
const erro = ref('');
const salvando = ref(false);

const apagar = async () => {
  erro.value = '';
  if (!senha.value) { erro.value = 'Digite sua senha para confirmar.'; return; }
  salvando.value = true;
  try {
    await clientService.apagar(props.cliente.id, senha.value);
    emit('apagado');
  } catch (e) {
    erro.value = e.response?.data?.error || 'Não foi possível apagar o cliente.';
  } finally {
    salvando.value = false;
    senha.value = '';
  }
};

const aoTeclar = (e) => { if (e.key === 'Escape') emit('close'); };
onMounted(() => window.addEventListener('keydown', aoTeclar));
onUnmounted(() => window.removeEventListener('keydown', aoTeclar));
</script>

<template>
  <div class="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" data-modal="apagar-cliente">
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="emit('close')"></div>
    <div class="relative z-10 w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden">
      <div class="border-b border-slate-200 px-6 py-4">
        <h2 class="text-base font-semibold text-slate-900 flex items-center gap-2"><Trash2 class="w-5 h-5 text-red-600" /> Apagar cliente</h2>
        <p class="text-slate-500 text-sm mt-0.5 truncate">{{ cliente.nome || cliente.name }}</p>
      </div>
      <div class="p-6 space-y-4 text-sm">
        <p class="text-slate-600">Só cliente sem borderô pode ser apagado. O cadastro e as notas dele saem; os eventos do calendário ficam, sem o cliente.</p>
        <div class="bg-amber-50/60 border border-amber-200 rounded-lg p-4">
          <label for="apagar-cliente-senha" class="text-slate-900 text-sm font-semibold flex items-center mb-2"><Lock class="w-4 h-4 mr-2 text-amber-600" /> Confirme com a sua senha</label>
          <input id="apagar-cliente-senha" v-model="senha" type="password" autocomplete="current-password" placeholder="Senha do seu login"
                 @keyup.enter="apagar" data-campo="apagar-cliente-senha"
                 class="h-10 w-full px-3 bg-white border border-slate-300 text-slate-900 rounded-md text-sm outline-none placeholder:text-slate-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15 shadow-xs" />
          <p class="text-slate-600 text-xs mt-2">Não tem desfazer. Fica registrado na Auditoria.</p>
        </div>
        <div v-if="erro" class="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md font-medium flex items-start gap-2">
          <AlertTriangle class="w-4 h-4 mt-0.5 flex-shrink-0" /> {{ erro }}
        </div>
      </div>
      <div class="bg-slate-50/70 px-6 py-4 border-t border-slate-200 flex gap-3">
        <button @click="emit('close')" class="px-4 h-10 bg-white border border-slate-300 text-slate-700 font-semibold rounded-md shadow-xs hover:bg-slate-50 text-sm">Cancelar</button>
        <button @click="apagar" :disabled="salvando" data-campo="apagar-cliente-confirmar"
                class="flex-1 h-10 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-md shadow-xs text-sm flex items-center justify-center gap-2 disabled:opacity-60">
          <Loader2 v-if="salvando" class="w-4 h-4 animate-spin" /><Trash2 v-else class="w-4 h-4" /> Apagar cliente
        </button>
      </div>
    </div>
  </div>
</template>
