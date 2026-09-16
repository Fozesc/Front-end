<script setup>
import { ref, computed, watch } from 'vue';
import { Merge, X, Lock, AlertTriangle, Search, ArrowRight, Trash2, Check as CheckIcon } from 'lucide-vue-next';
import clientService from '../../../services/clientService';

const props = defineProps({
  cliente: { type: Object, required: true }
});
const emit = defineEmits(['close', 'merged']);

const busca = ref('');
const resultados = ref([]);
const buscando = ref(false);
const escolhido = ref(null);
const manter = ref('atual');
const senha = ref('');
const erro = ref('');
const salvando = ref(false);

let timer = null;
watch(busca, (termo) => {
  clearTimeout(timer);
  escolhido.value = null;
  if (!termo || termo.trim().length < 2) { resultados.value = []; return; }
  buscando.value = true;
  timer = setTimeout(async () => {
    try {
      const r = await clientService.getAll({ search: termo.trim(), per_page: 8 });
      resultados.value = (r.items || []).filter(c => c.id !== props.cliente.id);
    } catch { resultados.value = []; }
    finally { buscando.value = false; }
  }, 350);
});

const fica = computed(() => manter.value === 'atual' ? props.cliente : escolhido.value);
const some = computed(() => manter.value === 'atual' ? escolhido.value : props.cliente);

const formatMoney = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const confirmar = async () => {
  erro.value = '';
  if (!escolhido.value) { erro.value = 'Escolha o outro cadastro do mesmo cliente.'; return; }
  if (!senha.value) { erro.value = 'Digite sua senha para confirmar.'; return; }

  salvando.value = true;
  try {
    const r = await clientService.merge({
      origem_id: some.value.id,
      destino_id: fica.value.id,
      senha: senha.value
    });
    emit('merged', r.data);
  } catch (e) {
    erro.value = e.response?.data?.error || 'Não foi possível juntar os cadastros.';
  } finally {
    salvando.value = false;
    senha.value = '';
  }
};
</script>

<template>
  <div class="fixed inset-0 z-[70] flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="emit('close')"></div>

    <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">

      <div class="bg-slate-900 px-6 py-4 flex justify-between items-center shrink-0">
        <div>
          <h2 class="text-xl font-bold text-white flex items-center">
            <Merge class="w-5 h-5 mr-2 text-amber-400" /> Juntar cadastros do mesmo cliente
          </h2>
          <p class="text-slate-400 text-xs mt-0.5">
            Partindo de <strong class="text-slate-200">{{ cliente.name }}</strong>
          </p>
        </div>
        <button @click="emit('close')" class="text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all">
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="p-6 overflow-y-auto space-y-5">

        <div class="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start text-sm text-amber-900">
          <AlertTriangle class="w-5 h-5 mr-2 shrink-0 text-amber-600" />
          <span>
            Todos os borderôs e cheques passam para o cadastro que você mantiver.
            O outro cadastro é <strong>apagado</strong>. Nenhum cheque é alterado ou perdido.
            <strong>Não há como desfazer</strong> — o cadastro apagado fica registrado na Auditoria.
          </span>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-500 uppercase mb-1.5">
            1. Qual é o outro cadastro dessa mesma pessoa?
          </label>
          <div class="relative">
            <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input v-model="busca" type="text" placeholder="Digite o nome ou o CPF/CNPJ..."
                   class="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
          </div>

          <p v-if="buscando" class="text-xs text-slate-400 mt-2">Procurando...</p>
          <p v-else-if="busca.trim().length >= 2 && !resultados.length" class="text-xs text-slate-400 mt-2">
            Nenhum outro cliente com esse nome.
          </p>

          <ul v-if="resultados.length" class="mt-2 border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-56 overflow-y-auto">
            <li v-for="c in resultados" :key="c.id">
              <button type="button" @click="escolhido = c"
                      class="w-full text-left px-3 py-2.5 hover:bg-indigo-50 transition-colors flex items-center justify-between"
                      :class="escolhido?.id === c.id ? 'bg-indigo-50' : ''">
                <span>
                  <span class="font-semibold text-slate-800 text-sm">{{ c.name }}</span>
                  <span class="block text-xs text-slate-500">
                    {{ c.document || 'sem CPF/CNPJ' }} &middot;
                    {{ c.cheques_totais }} cheque(s) &middot; em aberto {{ formatMoney(c.valor_em_aberto) }}
                  </span>
                </span>
                <CheckIcon v-if="escolhido?.id === c.id" class="w-5 h-5 text-indigo-600 shrink-0" />
              </button>
            </li>
          </ul>
        </div>

        <div v-if="escolhido">
          <label class="block text-xs font-bold text-slate-500 uppercase mb-1.5">
            2. Qual cadastro deve ficar?
          </label>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button v-for="opcao in [{ k: 'atual', c: cliente }, { k: 'outro', c: escolhido }]" :key="opcao.k"
                    type="button" @click="manter = opcao.k"
                    class="text-left border-2 rounded-xl p-3 transition-all"
                    :class="manter === opcao.k ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'">
              <div class="flex items-center justify-between mb-1">
                <span class="text-[11px] font-bold uppercase"
                      :class="manter === opcao.k ? 'text-emerald-700' : 'text-slate-400'">
                  {{ manter === opcao.k ? 'Este fica' : 'Este será apagado' }}
                </span>
                <CheckIcon v-if="manter === opcao.k" class="w-4 h-4 text-emerald-600" />
                <Trash2 v-else class="w-4 h-4 text-slate-400" />
              </div>
              <p class="font-bold text-slate-800 text-sm leading-tight">{{ opcao.c.name }}</p>
              <dl class="mt-2 text-xs text-slate-600 space-y-0.5">
                <div class="flex justify-between"><dt>CPF/CNPJ</dt><dd class="font-semibold">{{ opcao.c.document || '—' }}</dd></div>
                <div class="flex justify-between"><dt>Telefone</dt><dd class="font-semibold">{{ opcao.c.phone || '—' }}</dd></div>
                <div class="flex justify-between"><dt>Limite</dt><dd class="font-semibold">{{ formatMoney(opcao.c.credit_limit) }}</dd></div>
                <div class="flex justify-between"><dt>Taxa</dt><dd class="font-semibold">{{ opcao.c.standard_rate }}%</dd></div>
                <div class="flex justify-between"><dt>Cheques</dt><dd class="font-semibold">{{ opcao.c.cheques_totais }}</dd></div>
              </dl>
            </button>
          </div>
          <p class="text-xs text-slate-500 mt-2">
            O cadastro apagado perde CPF, telefone, limite e taxa — escolha o que estiver mais completo.
          </p>
        </div>

        <div v-if="escolhido" class="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <p class="text-sm text-slate-700 flex items-center flex-wrap gap-2">
            <span class="font-bold text-red-600 line-through">{{ some?.name }}</span>
            <ArrowRight class="w-4 h-4 text-slate-400" />
            <span class="font-bold text-emerald-700">{{ fica?.name }}</span>
          </p>
          <p class="text-xs text-slate-500 mt-1">
            {{ some?.cheques_totais || 0 }} cheque(s) mudam de dono. O cadastro
            <strong>{{ some?.name }}</strong> deixa de existir.
          </p>
        </div>

        <div v-if="escolhido">
          <label class="block text-xs font-bold text-slate-500 uppercase mb-1.5 flex items-center">
            <Lock class="w-3.5 h-3.5 mr-1.5" /> 3. Sua senha para confirmar
          </label>
          <input v-model="senha" type="password" autocomplete="current-password"
                 @keyup.enter="confirmar" placeholder="Senha do seu login"
                 class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
        </div>

        <p v-if="erro" class="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{{ erro }}</p>
      </div>

      <div class="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-end gap-3 shrink-0">
        <button @click="emit('close')" class="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors text-sm">
          Cancelar
        </button>
        <button @click="confirmar" :disabled="salvando || !escolhido"
                class="bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-amber-200 flex items-center transition-all active:scale-95 text-sm">
          <Merge class="w-4 h-4 mr-2" />
          {{ salvando ? 'Juntando...' : 'Juntar e apagar o antigo' }}
        </button>
      </div>
    </div>
  </div>
</template>
