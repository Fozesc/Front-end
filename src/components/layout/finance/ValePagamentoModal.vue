<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { X, Split, Wallet, AlertTriangle, Loader2, CheckCircle2, Receipt } from 'lucide-vue-next';
import valeService from '../../../services/valeService';
import PartesPagamento from './PartesPagamento.vue';
import { CONTAS, FORMAS, ESTILO, arred, partesFecham, partesParaEnviar } from '../../../utils/contasCaixa';

const props = defineProps({
  vale: { type: Object, required: true }
});
const emit = defineEmits(['close', 'confirmado']);

const hoje = new Date().toLocaleDateString('en-CA');
const saldo = computed(() => arred(props.vale.saldo));
const valor = ref(saldo.value);
const data = ref(hoje);
const observacao = ref('');
const modo = ref('unica');
const contaUnica = ref(props.vale.conta);
const formaUnica = ref(FORMAS[props.vale.conta]?.[0] || 'Dinheiro');
const partes = ref([]);
const erro = ref('');
const salvando = ref(false);

const pagando = computed(() => arred(valor.value));
const restaDepois = computed(() => arred(saldo.value - pagando.value));
const valorValido = computed(() => pagando.value > 0 && pagando.value <= saldo.value);
const podeConfirmar = computed(() =>
  valorValido.value && (modo.value === 'unica' || partesFecham(partes.value, pagando.value)));

const atalhos = computed(() => [0.25, 0.5].map(f => ({ rotulo: `${f * 100}%`, valor: arred(saldo.value * f) }))
  .concat({ rotulo: 'Tudo', valor: saldo.value }));

watch(valor, () => { partes.value = []; });

const dinheiro = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const dataBR = (d) => (d ? d.split('-').reverse().join('/') : '-');
const nomeConta = (id) => CONTAS.find(c => c.id === id)?.nome || id;

const trocarContaUnica = (conta) => {
  contaUnica.value = conta;
  if (!FORMAS[conta].includes(formaUnica.value)) formaUnica.value = FORMAS[conta][0];
};

const confirmar = async () => {
  if (!podeConfirmar.value || salvando.value) return;
  erro.value = '';
  salvando.value = true;
  try {
    await valeService.pagar(props.vale.id, {
      valor: pagando.value,
      data: data.value,
      observacao: observacao.value,
      partes: modo.value === 'dividido'
        ? partesParaEnviar(partes.value)
        : [{ conta: contaUnica.value, forma: formaUnica.value, valor: pagando.value }]
    });
    emit('confirmado');
    emit('close');
  } catch (e) {
    erro.value = e.response?.data?.error || 'Não foi possível registrar o pagamento.';
  } finally {
    salvando.value = false;
  }
};

const aoTeclar = (e) => { if (e.key === 'Escape') emit('close'); };
onMounted(() => window.addEventListener('keydown', aoTeclar));
onUnmounted(() => window.removeEventListener('keydown', aoTeclar));
</script>

<template>
  <div class="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true">
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="$emit('close')"></div>

    <div class="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[92vh]" data-modal="vale-pagamento">
      <div class="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-start flex-shrink-0">
        <div class="min-w-0">
          <h2 class="text-slate-900 text-base font-semibold flex items-center gap-2">
            <Wallet class="w-5 h-5 text-emerald-600" /> Pagamento do vale #{{ vale.id }}
          </h2>
          <p class="text-slate-500 text-sm mt-0.5 truncate">{{ vale.descricao }}</p>
        </div>
        <button @click="$emit('close')" aria-label="Fechar"
                class="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-lg transition-colors">
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="p-6 space-y-5 overflow-y-auto text-sm">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-200 border border-slate-200 rounded-xl overflow-hidden">
          <div class="bg-white p-3">
            <div class="text-xs font-medium text-slate-500">Emitido em</div>
            <div class="font-semibold text-slate-900 mt-0.5">{{ dataBR(vale.data) }}</div>
            <div class="text-[11px] text-slate-500 mt-1">saiu de {{ nomeConta(vale.conta) }}</div>
          </div>
          <div class="bg-white p-3">
            <div class="text-xs font-medium text-slate-500">Valor do vale</div>
            <div class="font-semibold text-slate-900 tabular-nums mt-0.5">{{ dinheiro(vale.valor) }}</div>
          </div>
          <div class="bg-white p-3">
            <div class="text-xs font-medium text-slate-500">Já pago</div>
            <div class="font-semibold text-emerald-700 tabular-nums mt-0.5">{{ dinheiro(vale.pago) }}</div>
          </div>
          <div class="bg-white p-3">
            <div class="text-xs font-medium text-slate-500">Falta pagar</div>
            <div class="font-semibold text-red-600 tabular-nums mt-0.5">{{ dinheiro(saldo) }}</div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1.5">Quanto está pagando agora</label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">R$</span>
              <input v-model.number="valor" type="number" step="0.01" min="0.01" :max="saldo" inputmode="decimal"
                     data-campo="vale-valor-pagar" @focus="$event.target.select()" @keyup.enter="confirmar"
                     class="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-lg font-semibold text-slate-900 tabular-nums outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow">
            </div>
            <div class="flex flex-wrap gap-2 mt-2">
              <button v-for="a in atalhos" :key="a.rotulo" @click="valor = a.valor"
                      class="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                      :class="pagando === a.valor ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'">
                {{ a.rotulo }} · {{ dinheiro(a.valor) }}
              </button>
            </div>
          </div>
          <div class="md:w-44">
            <label class="block text-xs font-medium text-slate-600 mb-1.5">Data do pagamento</label>
            <input v-model="data" type="date"
                   class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow">
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1.5">Observação do pagamento <span class="text-slate-400 font-normal">(opcional)</span></label>
          <input v-model="observacao" maxlength="100" placeholder="Ex.: descontado do salário" data-campo="vale-obs-pagamento"
                 class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow">
        </div>

        <div class="flex items-center justify-between gap-4 rounded-xl px-5 py-4 border"
             :class="!valorValido ? 'bg-red-50/60 border-red-200' : restaDepois > 0 ? 'bg-amber-50/60 border-amber-200' : 'bg-emerald-50/60 border-emerald-200'">
          <div>
            <div class="text-xs font-semibold" :class="!valorValido ? 'text-red-700' : restaDepois > 0 ? 'text-amber-700' : 'text-emerald-700'">
              {{ !valorValido ? 'Valor inválido' : restaDepois > 0 ? 'Pagamento parcial' : 'Quita o vale' }}
            </div>
            <div class="text-xs text-slate-600 mt-0.5" data-campo="vale-resta">
              <template v-if="!valorValido">entre {{ dinheiro(0.01) }} e {{ dinheiro(saldo) }}</template>
              <template v-else-if="restaDepois > 0">depois deste, ainda faltam <strong class="text-slate-800">{{ dinheiro(restaDepois) }}</strong></template>
              <template v-else>o vale fica como Pago</template>
            </div>
          </div>
          <div class="text-3xl font-semibold tracking-tight tabular-nums text-slate-900">{{ dinheiro(valorValido ? pagando : 0) }}</div>
        </div>

        <div class="flex bg-slate-100 p-1 rounded-lg gap-0.5">
          <button @click="modo = 'unica'"
                  class="flex-1 py-2 text-[13px] font-semibold rounded-md flex items-center justify-center gap-2 transition-all"
                  :class="modo === 'unica' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'">
            <Wallet class="w-4 h-4" /> Uma conta só
          </button>
          <button @click="modo = 'dividido'" :disabled="!valorValido" data-campo="vale-dividir"
                  class="flex-1 py-2 text-[13px] font-semibold rounded-md flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                  :class="modo === 'dividido' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'">
            <Split class="w-4 h-4" /> Dividir em partes
          </button>
        </div>

        <div v-if="modo === 'unica'" class="space-y-4">
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1.5">Onde o dinheiro entra</label>
            <div class="grid grid-cols-3 gap-2">
              <button v-for="c in CONTAS" :key="c.id" @click="trocarContaUnica(c.id)"
                      class="border rounded-xl p-3 text-left transition-all"
                      :class="contaUnica === c.id ? ESTILO[c.id].ativo : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white'">
                <component :is="c.icone" class="w-5 h-5 mb-1.5" />
                <div class="text-xs font-semibold leading-tight">{{ c.nome }}</div>
                <div class="text-[11px] opacity-70">{{ c.sub }}</div>
              </button>
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1.5">Como pagou</label>
            <div class="flex flex-wrap gap-2">
              <button v-for="f in FORMAS[contaUnica]" :key="f" @click="formaUnica = f"
                      class="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                      :class="formaUnica === f ? ESTILO[contaUnica].chip : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'">
                {{ f }}
              </button>
            </div>
          </div>

          <div class="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-start gap-2">
            <Receipt class="w-4 h-4 text-slate-400 flex-shrink-0 mt-px" />
            <span>
              Entra em <strong class="text-slate-800">{{ nomeConta(contaUnica) }}</strong>:
              <strong class="text-slate-800">{{ dinheiro(valorValido ? pagando : 0) }}</strong>
              como “{{ restaDepois > 0 ? 'Pagamento parcial' : 'Pagamento' }} do vale #{{ vale.id }} - {{ vale.descricao }}<template v-if="observacao.trim()"> · {{ observacao.trim() }}</template>”.
            </span>
          </div>
        </div>

        <PartesPagamento v-else-if="valorValido" :key="pagando" v-model="partes" :total="pagando" @enviar="confirmar" />

        <div v-if="erro" class="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm font-medium flex items-start gap-2">
          <AlertTriangle class="w-4 h-4 mt-0.5 flex-shrink-0" /> {{ erro }}
        </div>
      </div>

      <div class="bg-slate-50/70 px-6 py-4 border-t border-slate-200 flex gap-3 flex-shrink-0">
        <button @click="$emit('close')"
                class="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg shadow-xs hover:bg-slate-50 transition-colors text-sm">
          Cancelar
        </button>
        <button @click="confirmar" :disabled="!podeConfirmar || salvando" data-campo="vale-confirmar-pagamento"
                class="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed">
          <Loader2 v-if="salvando" class="w-4 h-4 animate-spin" />
          <CheckCircle2 v-else class="w-4 h-4" />
          {{ salvando ? 'Lançando...' : `Confirmar pagamento de ${dinheiro(valorValido ? pagando : 0)}` }}
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
