<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  X, Banknote, Landmark, Building2, Split, Wallet, Plus, Trash2,
  AlertTriangle, Loader2, CheckCircle2, Link2, Divide
} from 'lucide-vue-next';
import checkService from '../../../services/checkService';

const props = defineProps({
  cheque: { type: Object, required: true }
});
const emit = defineEmits(['close', 'confirmado']);

// As tres contas do caixa. O `id` e' o texto que o backend usa para saber em qual
// saldo o dinheiro entra - nao inventar valor novo aqui sem mexer no backend.
const CONTAS = [
  { id: 'Dinheiro', nome: 'Dinheiro', curto: 'Dinheiro', sub: 'Cofre', icone: Banknote },
  { id: 'BB', nome: 'Banco do Brasil', curto: 'BB', sub: 'Conta BB', icone: Landmark },
  { id: 'Caixa', nome: 'Caixa Econômica', curto: 'Caixa', sub: 'Conta CEF', icone: Building2 }
];

// Formas que fazem sentido em cada conta (PIX no cofre nao existe).
const FORMAS = {
  Dinheiro: ['Dinheiro', 'Outro'],
  BB: ['PIX', 'TED/DOC', 'Depósito', 'Cheque', 'Outro'],
  Caixa: ['PIX', 'TED/DOC', 'Depósito', 'Cheque', 'Outro']
};

// Classes escritas inteiras de proposito: o Tailwind so gera o que ele ve no codigo.
const ESTILO = {
  Dinheiro: {
    barra: 'bg-emerald-500',
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    ativo: 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm',
    ponto: 'bg-emerald-500'
  },
  BB: {
    barra: 'bg-blue-500',
    chip: 'bg-blue-50 text-blue-700 border-blue-200',
    ativo: 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm',
    ponto: 'bg-blue-500'
  },
  Caixa: {
    barra: 'bg-sky-500',
    chip: 'bg-sky-50 text-sky-700 border-sky-200',
    ativo: 'border-sky-500 bg-sky-50 text-sky-700 shadow-sm',
    ponto: 'bg-sky-500'
  }
};

const modo = ref('unica');            // 'unica' = como sempre foi | 'dividido'
const contaUnica = ref('Dinheiro');
const formaUnica = ref('Dinheiro');
const partes = ref([]);
const erro = ref('');
const salvando = ref(false);

const arred = (v) => Math.round((Number(v) || 0) * 100) / 100;

const total = computed(() => arred(props.cheque?.valor_bruto));
const soma = computed(() => arred(partes.value.reduce((t, p) => t + (Number(p.valor) || 0), 0)));
const restante = computed(() => arred(total.value - soma.value));
const fecha = computed(() =>
  partes.value.length > 0 &&
  partes.value.every(p => (Number(p.valor) || 0) > 0) &&
  Math.abs(restante.value) < 0.005
);
const podeConfirmar = computed(() => modo.value === 'unica' || fecha.value);

const pct = (v) => (total.value > 0 ? ((Number(v) || 0) / total.value) * 100 : 0);
const pctTexto = (v) => {
  const p = pct(v);
  return `${p % 1 === 0 ? p.toFixed(0) : p.toFixed(1)}%`;
};

const dinheiro = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const dataBR = (d) => (d ? d.split('-').reverse().join('/') : '-');

const irParaDividido = () => {
  modo.value = 'dividido';
  if (!partes.value.length) dividirIgualmente(2);
};

const dividirIgualmente = (quantas) => {
  const n = quantas || partes.value.length || 2;
  if (!partes.value.length) {
    partes.value = [
      { conta: 'Dinheiro', forma: 'Dinheiro', valor: 0 },
      { conta: 'BB', forma: 'PIX', valor: 0 }
    ].slice(0, Math.max(n, 2));
  }
  const centavos = Math.round(total.value * 100);
  const fatia = Math.floor(centavos / partes.value.length);
  partes.value.forEach((p, i) => {
    const extra = i === partes.value.length - 1 ? centavos - fatia * partes.value.length : 0;
    p.valor = arred((fatia + extra) / 100);
  });
};

const adicionarParte = () => {
  if (partes.value.length >= 10) return;
  const usadas = partes.value.map(p => p.conta);
  const livre = CONTAS.find(c => !usadas.includes(c.id))?.id || 'Dinheiro';
  partes.value.push({
    conta: livre,
    forma: FORMAS[livre][0],
    valor: restante.value > 0 ? restante.value : 0
  });
};

const removerParte = (i) => {
  partes.value.splice(i, 1);
  if (!partes.value.length) modo.value = 'unica';
};

const trocarConta = (parte, conta) => {
  parte.conta = conta;
  if (!FORMAS[conta].includes(parte.forma)) parte.forma = FORMAS[conta][0];
};

const trocarContaUnica = (conta) => {
  contaUnica.value = conta;
  if (!FORMAS[conta].includes(formaUnica.value)) formaUnica.value = FORMAS[conta][0];
};

const usarRestante = (parte) => {
  parte.valor = arred((Number(parte.valor) || 0) + restante.value);
};

const confirmar = async () => {
  if (!podeConfirmar.value || salvando.value) return;
  erro.value = '';
  salvando.value = true;
  try {
    const payment_data = modo.value === 'dividido'
      ? { partes: partes.value.map(p => ({ conta: p.conta, forma: p.forma, valor: arred(p.valor) })) }
      : { method: contaUnica.value, forma: formaUnica.value };

    await checkService.updateStatus(props.cheque.id, 'Pago', { payment_data });
    emit('confirmado');
    emit('close');
  } catch (e) {
    erro.value = e.response?.data?.error || 'Erro ao dar baixa no título.';
  } finally {
    salvando.value = false;
  }
};

const aoTeclar = (e) => { if (e.key === 'Escape') emit('close'); };
onMounted(() => window.addEventListener('keydown', aoTeclar));
onUnmounted(() => window.removeEventListener('keydown', aoTeclar));
</script>

<template>
  <div class="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true">
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="$emit('close')"></div>

    <div class="relative z-10 w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[92vh]">

      <div class="bg-slate-900 px-6 py-5 flex justify-between items-start flex-shrink-0">
        <div>
          <h2 class="text-white text-lg font-bold flex items-center gap-2">
            <Wallet class="w-5 h-5 text-emerald-400" /> Receber Título
          </h2>
          <p class="text-slate-400 text-xs mt-1">
            {{ cheque.emitente || cheque.cliente }} · venc. {{ dataBR(cheque.vencimento) }}
            <span v-if="cheque.num_doc"> · doc {{ cheque.num_doc }}</span>
          </p>
        </div>
        <button @click="$emit('close')" aria-label="Fechar"
                class="text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors">
          <X class="w-4 h-4" />
        </button>
      </div>

      <div class="p-6 space-y-5 overflow-y-auto">

        <div class="text-center bg-slate-50 border border-slate-200 rounded-xl py-4">
          <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor a receber</span>
          <div class="text-3xl font-black text-slate-900 mt-0.5">{{ dinheiro(total) }}</div>
        </div>

        <div class="flex bg-slate-100 p-1 rounded-xl">
          <button @click="modo = 'unica'"
                  class="flex-1 py-2.5 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all uppercase tracking-wide"
                  :class="modo === 'unica' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'">
            <Wallet class="w-4 h-4" /> Uma conta só
          </button>
          <button @click="irParaDividido"
                  class="flex-1 py-2.5 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all uppercase tracking-wide"
                  :class="modo === 'dividido' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'">
            <Split class="w-4 h-4" /> Dividir em partes
          </button>
        </div>

        <div v-if="erro" class="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm font-bold flex items-start gap-2">
          <AlertTriangle class="w-4 h-4 mt-0.5 flex-shrink-0" /> {{ erro }}
        </div>

        <!-- ------------------------------------------------ recebimento normal -->
        <div v-if="modo === 'unica'" class="space-y-4">
          <div>
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Onde o dinheiro entra</label>
            <div class="grid grid-cols-3 gap-2">
              <button v-for="c in CONTAS" :key="c.id" @click="trocarContaUnica(c.id)"
                      class="border-2 rounded-xl p-3 text-left transition-all"
                      :class="contaUnica === c.id ? ESTILO[c.id].ativo : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white'">
                <component :is="c.icone" class="w-5 h-5 mb-1.5" />
                <div class="text-xs font-bold leading-tight">{{ c.nome }}</div>
                <div class="text-[10px] opacity-70">{{ c.sub }}</div>
              </button>
            </div>
          </div>

          <div>
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Como recebeu</label>
            <div class="flex flex-wrap gap-2">
              <button v-for="f in FORMAS[contaUnica]" :key="f" @click="formaUnica = f"
                      class="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
                      :class="formaUnica === f ? ESTILO[contaUnica].chip : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'">
                {{ f }}
              </button>
            </div>
          </div>

          <p class="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
            Vai lançar <strong class="text-slate-800">{{ dinheiro(total) }}</strong> de entrada em
            <strong class="text-slate-800">{{ contaUnica }}</strong> — uma linha no caixa.
          </p>
        </div>

        <!-- ---------------------------------------------- recebimento dividido -->
        <div v-else class="space-y-4">

          <div class="sticky -top-6 bg-white pt-6 pb-2 z-10">
            <div class="flex h-3 rounded-full overflow-hidden bg-slate-200">
              <div v-for="(p, i) in partes" :key="'b' + i"
                   class="transition-all duration-300"
                   :class="ESTILO[p.conta].barra"
                   :style="{ width: Math.min(pct(p.valor), 100) + '%' }"></div>
            </div>
            <div class="flex justify-between items-center mt-2 text-xs">
              <div class="flex flex-wrap gap-x-3 gap-y-1">
                <span v-for="(p, i) in partes" :key="'l' + i" class="flex items-center gap-1.5 text-slate-500 font-bold">
                  <span class="w-2 h-2 rounded-full" :class="ESTILO[p.conta].ponto"></span>
                  {{ p.conta }} {{ pctTexto(p.valor) }}
                </span>
              </div>
              <span v-if="fecha" class="flex items-center gap-1 font-black text-emerald-600 uppercase text-[10px] tracking-wide">
                <CheckCircle2 class="w-3.5 h-3.5" /> Fechou
              </span>
              <span v-else class="font-black uppercase text-[10px] tracking-wide"
                    :class="restante > 0 ? 'text-amber-600' : 'text-red-600'">
                {{ restante > 0 ? `Falta ${dinheiro(restante)}` : `Passou ${dinheiro(-restante)}` }}
              </span>
            </div>
          </div>

          <div class="space-y-2">
            <div v-for="(p, i) in partes" :key="'p' + i"
                 class="border border-slate-200 rounded-xl p-3 bg-white hover:border-slate-300 transition-colors">
              <div class="flex items-center justify-between mb-2">
                <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Parte {{ i + 1 }}</span>
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded-md text-[11px] font-black border" :class="ESTILO[p.conta].chip">
                    {{ pctTexto(p.valor) }}
                  </span>
                  <button v-if="partes.length > 1" @click="removerParte(i)" aria-label="Remover parte"
                          class="text-slate-300 hover:text-red-600 transition-colors p-1">
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div class="grid grid-cols-3 gap-1.5 mb-2">
                <button v-for="c in CONTAS" :key="c.id" @click="trocarConta(p, c.id)" :title="c.nome"
                        class="border-2 rounded-lg py-2 px-1 flex items-center justify-center gap-1.5 transition-all"
                        :class="p.conta === c.id ? ESTILO[c.id].ativo : 'border-slate-200 text-slate-400 hover:border-slate-300'">
                  <component :is="c.icone" class="w-4 h-4 flex-shrink-0" />
                  <span class="text-[11px] font-bold truncate">{{ c.curto }}</span>
                </button>
              </div>

              <div class="grid grid-cols-12 gap-2 items-center">
                <select v-model="p.forma" aria-label="Como recebeu"
                        class="col-span-5 bg-slate-50 border border-slate-200 rounded-lg py-2 px-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500">
                  <option v-for="f in FORMAS[p.conta]" :key="f" :value="f">{{ f }}</option>
                </select>

                <div class="col-span-7 relative">
                  <span class="absolute left-2.5 top-2.5 text-[11px] font-bold text-slate-400">R$</span>
                  <input v-model="p.valor" type="number" step="0.01" min="0" inputmode="decimal"
                         aria-label="Valor da parte"
                         @focus="$event.target.select()" @keyup.enter="confirmar"
                         class="w-full border border-slate-300 rounded-lg py-2 pl-8 pr-2 text-sm font-bold text-slate-800 text-right outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              <button v-if="!fecha && restante !== 0" @click="usarRestante(p)"
                      class="mt-2 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline">
                jogar o restante aqui ({{ dinheiro(restante) }})
              </button>
            </div>
          </div>

          <div class="flex gap-2">
            <button @click="adicionarParte" :disabled="partes.length >= 10"
                    class="flex-1 border-2 border-dashed border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 rounded-xl py-2.5 text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-40">
              <Plus class="w-4 h-4" /> Adicionar parte
            </button>
            <button @click="dividirIgualmente()"
                    class="border-2 border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700 rounded-xl py-2.5 px-4 text-xs font-bold flex items-center justify-center gap-2 transition-colors">
              <Divide class="w-4 h-4" /> Igualmente
            </button>
          </div>

          <p class="text-xs text-slate-500 bg-indigo-50 border border-indigo-100 rounded-lg p-3 flex items-start gap-2">
            <Link2 class="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
            <span>
              Vão aparecer <strong class="text-indigo-900">{{ partes.length }} linhas no caixa</strong>
              (uma por conta, com o valor de cada parte), todas vinculadas a este mesmo cheque —
              no Fluxo de Caixa elas aparecem agrupadas.
            </span>
          </p>
        </div>
      </div>

      <div class="bg-slate-50 px-6 py-4 border-t border-slate-200 flex gap-3 flex-shrink-0">
        <button @click="$emit('close')"
                class="px-5 py-3 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-100 transition-colors text-sm">
          Cancelar
        </button>
        <button @click="confirmar" :disabled="!podeConfirmar || salvando"
                class="flex-1 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed">
          <Loader2 v-if="salvando" class="w-4 h-4 animate-spin" />
          <CheckCircle2 v-else class="w-4 h-4" />
          {{ salvando ? 'Lançando...' : `Confirmar recebimento de ${dinheiro(total)}` }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-scale-in { animation: scaleIn 0.2s ease-out; }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
/* tira as setinhas do input de valor: o teclado numerico e o R$ ja bastam */
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
input[type="number"] { -moz-appearance: textfield; }
</style>
