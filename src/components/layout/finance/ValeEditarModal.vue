<script setup>
import { reactive, ref, computed, onMounted, onUnmounted } from 'vue';
import { X, Pencil, Save, Lock, AlertTriangle, Loader2, Receipt } from 'lucide-vue-next';
import valeService from '../../../services/valeService';
import { CONTAS, ESTILO, arred } from '../../../utils/contasCaixa';

const props = defineProps({
  vale: { type: Object, required: true }
});
const emit = defineEmits(['close', 'salvo']);

const form = reactive({
  descricao: props.vale.descricao || '',
  valor: props.vale.valor,
  data: props.vale.data,
  conta: props.vale.conta,
  senha: ''
});
const erro = ref('');
const aviso = ref('');
const salvando = ref(false);

const valor = computed(() => arred(form.valor));
const pago = computed(() => arred(props.vale.pago));
const restaDepois = computed(() => arred(valor.value - pago.value));
const valorValido = computed(() => valor.value > 0 && valor.value >= pago.value);

const dinheiro = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const dataBR = (d) => (d ? d.split('-').reverse().join('/') : '-');
const nomeConta = (id) => CONTAS.find(c => c.id === id)?.nome || id;

const salvar = async () => {
  erro.value = '';
  if (!form.descricao.trim()) { erro.value = 'Informe a descrição do vale.'; return; }
  if (!valorValido.value) { erro.value = `O valor tem que ser maior que zero e no mínimo o que já foi pago (${dinheiro(pago.value)}).`; return; }
  if (!form.data) { erro.value = 'Informe a data.'; return; }
  if (!form.senha) { erro.value = 'Digite sua senha para confirmar a alteração.'; return; }
  salvando.value = true;
  try {
    const r = await valeService.editar(props.vale.id, { ...form, valor: valor.value });
    if (!r.saida_no_caixa) aviso.value = 'O vale foi alterado, mas a saída dele não foi encontrada no caixa — o caixa não mudou.';
    emit('salvo');
    if (r.saida_no_caixa) emit('close');
  } catch (e) {
    erro.value = e.response?.data?.error || 'Não foi possível salvar a alteração.';
  } finally {
    salvando.value = false;
    form.senha = '';
  }
};

const aoTeclar = (e) => { if (e.key === 'Escape') emit('close'); };
onMounted(() => window.addEventListener('keydown', aoTeclar));
onUnmounted(() => window.removeEventListener('keydown', aoTeclar));
</script>

<template>
  <div class="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true">
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="$emit('close')"></div>

    <div class="relative z-10 w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[92vh]" data-modal="vale-editar">
      <div class="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-start flex-shrink-0">
        <div class="min-w-0">
          <h2 class="text-slate-900 text-base font-semibold flex items-center gap-2">
            <Pencil class="w-5 h-5 text-amber-600" /> Editar vale #{{ vale.id }}
          </h2>
          <p class="text-slate-500 text-sm mt-0.5 truncate">{{ vale.descricao }}</p>
        </div>
        <button @click="$emit('close')" aria-label="Fechar" class="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-lg transition-colors">
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="p-6 space-y-5 overflow-y-auto text-sm">
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1.5">Descrição</label>
          <input v-model="form.descricao" maxlength="200"
                 class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1.5">Valor do vale</label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">R$</span>
              <input v-model.number="form.valor" type="number" step="0.01" :min="Math.max(pago, 0.01)" inputmode="decimal" data-campo="vale-editar-valor"
                     class="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-lg font-semibold text-slate-900 tabular-nums outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" />
            </div>
            <p v-if="pago > 0" class="text-xs mt-1" :class="valorValido ? 'text-slate-500' : 'text-red-600 font-medium'">
              Já foram pagos {{ dinheiro(pago) }} — o valor não pode ficar abaixo disso.
              <template v-if="valorValido">{{ restaDepois > 0 ? `Vai faltar ${dinheiro(restaDepois)}.` : 'Fica quitado.' }}</template>
            </p>
          </div>
          <div class="md:w-44">
            <label class="block text-xs font-medium text-slate-600 mb-1.5">Data</label>
            <input v-model="form.data" type="date"
                   class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" />
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1.5">Saiu de qual conta</label>
          <div class="grid grid-cols-3 gap-2">
            <button v-for="c in CONTAS" :key="c.id" @click="form.conta = c.id"
                    class="border rounded-xl p-3 text-left transition-all"
                    :class="form.conta === c.id ? ESTILO[c.id].ativo : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white'">
              <component :is="c.icone" class="w-5 h-5 mb-1.5" />
              <div class="text-xs font-semibold leading-tight">{{ c.nome }}</div>
              <div class="text-[11px] opacity-70">{{ c.sub }}</div>
            </button>
          </div>
        </div>

        <div class="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-start gap-2">
          <Receipt class="w-4 h-4 text-slate-400 flex-shrink-0 mt-px" />
          <span>
            O caixa acompanha: a saída deste vale passa a ser <strong class="text-slate-800">{{ dinheiro(valorValido ? valor : 0) }}</strong>
            em <strong class="text-slate-800">{{ nomeConta(form.conta) }}</strong> no dia <strong class="text-slate-800">{{ dataBR(form.data) }}</strong>.
            Os pagamentos já feitos não mudam.
          </span>
        </div>

        <div class="bg-amber-50/60 border border-amber-200 rounded-xl p-4">
          <label class="text-slate-900 text-sm font-semibold flex items-center mb-2">
            <Lock class="w-4 h-4 mr-2 text-amber-600" /> Confirme com a sua senha
          </label>
          <input v-model="form.senha" type="password" autocomplete="current-password" placeholder="Senha do seu login"
                 @keyup.enter="salvar" data-campo="vale-editar-senha"
                 class="w-full px-3 py-2.5 bg-white border border-slate-300 text-slate-900 rounded-lg text-sm outline-none placeholder:text-slate-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15 shadow-xs transition-shadow" />
          <p class="text-slate-600 text-xs mt-2">A alteração mexe no caixa e fica registrada na Auditoria.</p>
        </div>

        <div v-if="erro" class="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm font-medium flex items-start gap-2">
          <AlertTriangle class="w-4 h-4 mt-0.5 flex-shrink-0" /> {{ erro }}
        </div>
        <div v-if="aviso" class="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-sm font-medium flex items-start gap-2">
          <AlertTriangle class="w-4 h-4 mt-0.5 flex-shrink-0" /> {{ aviso }}
        </div>
      </div>

      <div class="bg-slate-50/70 px-6 py-4 border-t border-slate-200 flex gap-3 flex-shrink-0">
        <button @click="$emit('close')" class="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg shadow-xs hover:bg-slate-50 transition-colors text-sm">
          {{ aviso ? 'Fechar' : 'Cancelar' }}
        </button>
        <button v-if="!aviso" @click="salvar" :disabled="salvando" data-campo="vale-editar-salvar"
                class="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-xs transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:shadow-none">
          <Loader2 v-if="salvando" class="w-4 h-4 animate-spin" /><Save v-else class="w-4 h-4" />
          {{ salvando ? 'Salvando...' : 'Salvar alteração' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-scale-in { animation: scaleIn 0.2s ease-out; }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
input[type="number"] { -moz-appearance: textfield; }
</style>
