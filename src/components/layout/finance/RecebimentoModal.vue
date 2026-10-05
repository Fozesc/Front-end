<script setup>
import { ref, reactive, computed, nextTick, onMounted, onUnmounted } from 'vue';
import {
  X, Split, Wallet, AlertTriangle, Loader2, CheckCircle2, CalendarClock, Percent, Receipt
} from 'lucide-vue-next';
import checkService from '../../../services/checkService';
import settingsService from '../../../services/settingsService';
import PartesPagamento from './PartesPagamento.vue';
import { CONTAS, FORMAS, ESTILO, arred, partesFecham, partesParaEnviar } from '../../../utils/contasCaixa';
import {
  calcularDias, calcularImposto, iofDasConfiguracoes, IOF_BASE_PADRAO, IOF_DIARIO_PADRAO
} from '../../../utils/calculoBordero';

const props = defineProps({
  cheque: { type: Object, required: true }
});
const emit = defineEmits(['close', 'confirmado']);

const hoje = new Date().toLocaleDateString('en-CA');
const modo = ref('unica');            // 'unica' = como sempre foi | 'dividido'
const contaUnica = ref('Dinheiro');
const formaUnica = ref('Dinheiro');
const partes = ref([]);
const erro = ref('');
const salvando = ref(false);

const valorTitulo = computed(() => arred(props.cheque?.valor_bruto));
const diasAtraso = computed(() => calcularDias(props.cheque.vencimento, hoje, 0));
const situacao = computed(() => {
  const n = diasAtraso.value;
  if (n > 0) return { texto: `atrasado há ${n} dia${n > 1 ? 's' : ''}`, cor: 'bg-red-50 text-red-700 border-red-200' };
  if (n === 0) return { texto: 'vence hoje', cor: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { texto: `vence em ${-n} dia${n < -1 ? 's' : ''}`, cor: 'bg-slate-50 text-slate-600 border-slate-200' };
});

// Imposto: so entra quando ele marca. Atrasado ou nao, quem decide se cobra e' ele.
// 'calculado' = juros do borderô sobre o valor, do vencimento ate hoje | 'manual' = digitado.
const cobrarImposto = ref(false);
const modoImposto = ref('calculado');
const impostoDigitado = ref(null);
const campoDigitado = ref(null);
const taxaPadrao = ref(Number(props.cheque.taxa_cliente) || 4);
const taxaOrigem = ref(props.cheque.taxa_cliente ? 'taxa do cliente' : 'padrão');
const iofBase = ref(IOF_BASE_PADRAO);
const iofDiario = ref(IOF_DIARIO_PADRAO);
const imp = reactive({
  dataBase: props.cheque.vencimento,
  taxa: taxaPadrao.value,
  // mesma condicao do borderô de origem, igual a prorrogacao
  iof: Boolean(props.cheque.iof_bordero)
});
const numero = (v) => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };

const calc = computed(() => calcularImposto({
  valor: valorTitulo.value,
  dataBase: imp.dataBase,
  dataPagamento: hoje,
  taxaMensal: imp.taxa,
  diasCompensacao: 0,
  iofEnabled: imp.iof,
  iofBase: iofBase.value,
  iofDiario: iofDiario.value
}));
const imposto = computed(() => {
  if (!cobrarImposto.value) return 0;
  const v = modoImposto.value === 'manual' ? numero(impostoDigitado.value) : calc.value.encargos;
  return Number.isFinite(v) ? arred(v) : NaN;
});
const total = computed(() => arred(valorTitulo.value + (imposto.value || 0)));
const pctDoTitulo = computed(() => (valorTitulo.value > 0 && imposto.value > 0
  ? `${(imposto.value / valorTitulo.value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% do título` : ''));
const meses = (dias) => (dias / 30).toLocaleString('pt-BR', { maximumFractionDigits: 1 });

const digitarImposto = async () => {
  modoImposto.value = 'manual';
  if (impostoDigitado.value === null || impostoDigitado.value === '') {
    impostoDigitado.value = calc.value.encargos > 0 ? calc.value.encargos : '';
  }
  await nextTick();
  campoDigitado.value?.focus();
  campoDigitado.value?.select();
};

const avisoImposto = computed(() => {
  if (!cobrarImposto.value) return '';
  if (modoImposto.value === 'calculado' && calc.value.dias <= 0) {
    return 'Nessa data o título não está atrasado e a conta dá zero. Mude o "a partir de" ou use "Digitar valor".';
  }
  if (imposto.value > valorTitulo.value) return 'O imposto ficou maior que o próprio título — confira.';
  return '';
});

const errosImposto = computed(() => {
  if (!cobrarImposto.value) return [];
  const e = [];
  const t = numero(imp.taxa);
  if (modoImposto.value === 'calculado' && (Number.isNaN(t) || t < 0 || t > 100)) e.push('Taxa inválida.');
  if (Number.isNaN(imposto.value) || imposto.value < 0) e.push('Valor do imposto inválido.');
  return e;
});

const podeConfirmar = computed(() =>
  !errosImposto.value.length && (modo.value === 'unica' || partesFecham(partes.value, total.value)));

onMounted(async () => {
  window.addEventListener('keydown', aoTeclar);
  try {
    const settings = await settingsService.get();
    const iof = iofDasConfiguracoes(settings);
    iofBase.value = iof.iofBase;
    iofDiario.value = iof.iofDiario;
    if (!props.cheque.taxa_cliente && settings.extension_rate) {
      taxaPadrao.value = Number(settings.extension_rate);
      imp.taxa = taxaPadrao.value;
    }
  } catch (e) {
    console.error('Erro ao carregar configurações:', e);
  }
});

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
    const payment_data = modo.value === 'dividido'
      ? { partes: partesParaEnviar(partes.value) }
      : { method: contaUnica.value, forma: formaUnica.value };
    if (imposto.value > 0) {
      payment_data.imposto = imposto.value;
      payment_data.imposto_calculo = {
        data_base: imp.dataBase,
        dias: calc.value.dias,
        taxa_mensal: numero(imp.taxa),
        iof: imp.iof,
        calculado: calc.value.encargos
      };
    }

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
onUnmounted(() => window.removeEventListener('keydown', aoTeclar));
</script>

<template>
  <div class="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true">
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="$emit('close')"></div>

    <div class="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[92vh]" data-modal="receber">

      <div class="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-start flex-shrink-0">
        <div class="min-w-0">
          <h2 class="text-slate-900 text-base font-semibold flex items-center gap-2">
            <Wallet class="w-5 h-5 text-emerald-600" /> Receber título
          </h2>
          <p class="text-slate-500 text-sm mt-0.5 truncate">
            {{ cheque.tipo === 'PROMISSORIA' ? 'Promissória' : 'Cheque' }} #{{ cheque.numero || 'S/N' }}
            · {{ cheque.emitente || cheque.cliente }} · {{ cheque.cliente }}
          </p>
        </div>
        <button @click="$emit('close')" aria-label="Fechar"
                class="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-lg transition-colors">
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="p-6 space-y-5 overflow-y-auto text-sm">

        <!-- o titulo -->
        <div class="grid grid-cols-2 md:grid-cols-[1fr_0.9fr_1.1fr_1.15fr] gap-px bg-slate-200 border border-slate-200 rounded-xl overflow-hidden">
          <div class="bg-white p-3">
            <div class="text-xs font-medium text-slate-500">Vencimento</div>
            <div class="font-semibold text-slate-900 mt-0.5">{{ dataBR(cheque.vencimento) }}</div>
            <span :class="['inline-block mt-1 px-1.5 py-0.5 rounded-md border text-[11px] font-medium whitespace-nowrap', situacao.cor]">{{ situacao.texto }}</span>
          </div>
          <div class="bg-white p-3">
            <div class="text-xs font-medium text-slate-500">Valor do título</div>
            <div class="font-semibold text-slate-900 tabular-nums mt-0.5">{{ dinheiro(valorTitulo) }}</div>
            <div v-if="cheque.valor_original !== undefined && cheque.valor_original !== cheque.valor_bruto" class="text-[11px] text-slate-500 mt-1">
              face {{ dinheiro(cheque.valor_original) }}
            </div>
          </div>
          <div class="bg-white p-3 min-w-0">
            <div class="text-xs font-medium text-slate-500">Emitente</div>
            <div class="font-semibold text-slate-900 truncate mt-0.5" :title="cheque.emitente">{{ cheque.emitente || cheque.cliente }}</div>
            <div class="text-[11px] text-slate-500 truncate mt-1">
              {{ [cheque.banco, cheque.num_doc && 'doc ' + cheque.num_doc].filter(Boolean).join(' · ') || 'banco não informado' }}
            </div>
          </div>
          <div class="bg-white p-3 min-w-0">
            <div class="text-xs font-medium text-slate-500">Cliente</div>
            <div class="font-semibold text-slate-900 truncate mt-0.5" :title="cheque.cliente">{{ cheque.cliente }}</div>
            <div class="text-[11px] text-slate-500 mt-1">Borderô #{{ cheque.operation_id }}</div>
          </div>
        </div>
        <div v-if="cheque.prorrogacoes" class="-mt-3 flex items-center gap-1.5 text-[11px] text-amber-800 font-medium">
          <CalendarClock class="w-3.5 h-3.5" />
          Prorrogado{{ cheque.prorrogacoes > 1 ? ` ${cheque.prorrogacoes} vezes` : '' }} · vencimento original {{ dataBR(cheque.vencimento_original) }}
        </div>

        <!-- imposto -->
        <section class="border rounded-xl overflow-hidden transition-colors" :class="cobrarImposto ? 'border-indigo-300' : 'border-slate-200 hover:border-slate-300'">
          <label class="flex items-start gap-3 px-4 py-3 cursor-pointer select-none" data-campo="cobrar-imposto">
            <input type="checkbox" v-model="cobrarImposto" class="mt-0.5 w-4 h-4 accent-indigo-600 flex-shrink-0">
            <div class="flex-1 min-w-0">
              <div class="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                <Percent class="w-4 h-4 text-indigo-500" /> Cobrar imposto (juros + IOF)
              </div>
              <div class="text-xs text-slate-500 mt-0.5">
                <template v-if="diasAtraso > 0">Atrasado {{ diasAtraso }} dia{{ diasAtraso > 1 ? 's' : '' }}: juros do borderô sobre o valor, do vencimento até hoje.</template>
                <template v-else>Título em dia — marque só se for cobrar mesmo assim.</template>
              </div>
            </div>
            <div v-if="cobrarImposto" class="text-right flex-shrink-0">
              <div class="text-xs font-medium text-slate-500">Imposto</div>
              <div class="text-sm font-semibold text-indigo-700 tabular-nums">+ {{ dinheiro(imposto) }}</div>
            </div>
          </label>

          <div v-if="cobrarImposto" class="border-t border-slate-200">
            <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200">
              <div class="inline-flex border border-slate-300 rounded-lg overflow-hidden text-xs font-semibold shadow-xs">
                <button @click="modoImposto = 'calculado'" data-campo="imposto-calcular"
                        class="px-3 py-1.5 transition-colors"
                        :class="modoImposto === 'calculado' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'">
                  Calcular pela taxa
                </button>
                <button @click="digitarImposto" data-campo="imposto-digitar"
                        class="px-3 py-1.5 border-l border-slate-300 transition-colors"
                        :class="modoImposto === 'manual' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'">
                  Digitar valor
                </button>
              </div>
              <span class="text-[11px] text-slate-500">
                {{ modoImposto === 'calculado' ? 'juros compostos, igual ao borderô' : 'o valor digitado é o que entra no caixa' }}
              </span>
            </div>

            <template v-if="modoImposto === 'calculado'">
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4 px-4 py-3">
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1.5">A partir de</label>
                  <input type="date" v-model="imp.dataBase" :max="hoje" data-campo="imposto-data"
                         class="w-full border border-slate-300 rounded px-2 py-1.5 text-sm font-semibold text-slate-800 bg-white outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow">
                  <button v-if="imp.dataBase !== cheque.vencimento" @click="imp.dataBase = cheque.vencimento"
                          class="mt-0.5 text-[11px] font-semibold text-indigo-600 hover:underline">voltar ao vencimento</button>
                </div>
                <div>
                  <div class="text-xs font-medium text-slate-500 mb-1">Até</div>
                  <div class="h-[34px] flex items-center text-sm font-semibold text-slate-800">hoje · {{ dataBR(hoje) }}</div>
                </div>
                <div>
                  <div class="text-xs font-medium text-slate-500 mb-1">Prazo</div>
                  <div class="h-[34px] flex flex-col justify-center text-sm font-semibold text-slate-800 leading-tight" data-campo="imposto-dias">
                    {{ calc.dias > 0 ? calc.dias + ' dias' : '—' }}
                    <span v-if="calc.dias > 30" class="text-[11px] font-normal text-slate-500">≈ {{ meses(calc.dias) }} meses</span>
                  </div>
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1.5">Taxa a.m.</label>
                  <div class="flex items-center gap-2">
                    <div class="relative flex-1">
                      <input type="number" step="0.01" min="0" v-model="imp.taxa" data-campo="imposto-taxa"
                             class="w-full border border-slate-300 rounded px-2 py-1.5 pr-6 text-sm font-semibold text-slate-800 bg-white outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow">
                      <span class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                    </div>
                    <label class="flex items-center gap-1 text-xs text-slate-600 cursor-pointer"
                           :title="`IOF ${iofBase}% + ${iofDiario}% ao dia (diário até 365 dias)`">
                      <input type="checkbox" v-model="imp.iof" class="accent-indigo-600" data-campo="imposto-iof"> IOF
                    </label>
                  </div>
                  <div class="text-[11px] text-slate-400 mt-0.5">
                    <template v-if="Number(imp.taxa) === taxaPadrao">{{ taxaOrigem }}</template>
                    <button v-else @click="imp.taxa = taxaPadrao" class="font-semibold text-indigo-600 hover:underline">voltar a {{ taxaPadrao }}%</button>
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-2 md:grid-cols-4 gap-4 px-4 py-3 border-t border-slate-100 bg-slate-50/60">
                <div>
                  <div class="text-xs font-medium text-slate-500 mb-1">Valor do título</div>
                  <div class="text-sm font-semibold text-slate-800 tabular-nums">{{ dinheiro(valorTitulo) }}</div>
                </div>
                <div>
                  <div class="text-xs font-medium text-slate-500 mb-1">+ Juros</div>
                  <div class="text-sm font-semibold text-red-700 tabular-nums">{{ dinheiro(calc.juros) }}</div>
                </div>
                <div>
                  <div class="text-xs font-medium text-slate-500 mb-1">+ IOF</div>
                  <div class="text-sm font-semibold tabular-nums" :class="imp.iof ? 'text-red-700' : 'text-slate-400'">{{ imp.iof ? dinheiro(calc.iof) : 'sem IOF' }}</div>
                </div>
                <div>
                  <div class="text-xs font-medium text-slate-500 mb-1">= Imposto</div>
                  <div class="text-base font-semibold text-indigo-800 tabular-nums" data-campo="imposto-valor">{{ dinheiro(calc.encargos) }}</div>
                  <div v-if="pctDoTitulo" class="text-[11px] text-slate-500">{{ pctDoTitulo }}</div>
                </div>
              </div>
            </template>

            <div v-else class="px-4 py-4 flex flex-wrap items-end gap-6">
              <div class="w-56">
                <label class="block text-xs font-medium text-slate-600 mb-1.5">Valor do imposto</label>
                <div class="relative">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">R$</span>
                  <input ref="campoDigitado" type="number" step="0.01" min="0" v-model="impostoDigitado" data-campo="imposto-digitado"
                         @keyup.enter="confirmar" placeholder="0,00"
                         class="w-full border border-slate-300 rounded pl-9 pr-3 py-1.5 text-lg font-semibold text-indigo-800 tabular-nums outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow">
                </div>
                <div v-if="pctDoTitulo" class="text-[11px] text-slate-500 mt-0.5">{{ pctDoTitulo }}</div>
              </div>
              <div class="text-xs text-slate-500 pb-2 flex-1 min-w-[200px]">
                <template v-if="calc.encargos > 0">Pela taxa daria <strong class="text-slate-700">{{ dinheiro(calc.encargos) }}</strong>
                  ({{ calc.dias }} dias a {{ imp.taxa }}% a.m.{{ imp.iof ? ' + IOF' : '' }}).</template>
                <template v-else>Título em dia: pela taxa não há o que cobrar.</template>
              </div>
            </div>

            <div v-if="avisoImposto" class="px-4 py-2 text-xs bg-amber-50 border-t border-amber-200 text-amber-800 flex items-start gap-2" data-campo="imposto-aviso">
              <AlertTriangle class="w-4 h-4 flex-shrink-0 mt-px" /> {{ avisoImposto }}
            </div>
            <div v-if="errosImposto.length" class="px-4 pb-3 pt-2 text-xs font-medium text-red-600">{{ errosImposto[0] }}</div>
          </div>
        </section>

        <!-- total -->
        <div class="flex items-center justify-between gap-4 rounded-xl px-5 py-4 border"
             :class="imposto > 0 ? 'bg-indigo-50/70 border-indigo-200' : 'bg-emerald-50/60 border-emerald-200'">
          <div>
            <div class="text-xs font-semibold" :class="imposto > 0 ? 'text-indigo-600' : 'text-emerald-700'">Total a receber</div>
            <div class="text-xs text-slate-600 mt-0.5" data-campo="composicao">
              <template v-if="imposto > 0">título {{ dinheiro(valorTitulo) }} + imposto {{ dinheiro(imposto) }}</template>
              <template v-else>só o valor do título</template>
            </div>
          </div>
          <div class="text-3xl font-semibold tracking-tight tabular-nums" :class="imposto > 0 ? 'text-indigo-900' : 'text-slate-900'" data-campo="total">{{ dinheiro(total) }}</div>
        </div>

        <!-- onde o dinheiro entra -->
        <div class="flex bg-slate-100 p-1 rounded-lg gap-0.5">
          <button @click="modo = 'unica'"
                  class="flex-1 py-2 text-[13px] font-semibold rounded-md flex items-center justify-center gap-2 transition-all"
                  :class="modo === 'unica' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'">
            <Wallet class="w-4 h-4" /> Uma conta só
          </button>
          <button @click="modo = 'dividido'"
                  class="flex-1 py-2 text-[13px] font-semibold rounded-md flex items-center justify-center gap-2 transition-all"
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
            <label class="block text-xs font-medium text-slate-600 mb-1.5">Como recebeu</label>
            <div class="flex flex-wrap gap-2">
              <button v-for="f in FORMAS[contaUnica]" :key="f" @click="formaUnica = f"
                      class="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                      :class="formaUnica === f ? ESTILO[contaUnica].chip : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'">
                {{ f }}
              </button>
            </div>
          </div>

          <div class="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-start gap-2" data-campo="previa-caixa">
            <Receipt class="w-4 h-4 text-slate-400 flex-shrink-0 mt-px" />
            <span>
              Entra em <strong class="text-slate-800">{{ nomeConta(contaUnica) }}</strong>:
              <strong class="text-slate-800">{{ dinheiro(valorTitulo) }}</strong> do título<template v-if="imposto > 0">
              + <strong class="text-indigo-700">{{ dinheiro(imposto) }}</strong> de imposto</template>
              — {{ imposto > 0 ? 'duas linhas' : 'uma linha' }} no caixa.
            </span>
          </div>
        </div>

        <template v-else>
          <PartesPagamento v-model="partes" :total="total" @enviar="confirmar" />
          <p v-if="imposto > 0" class="text-xs text-slate-500 -mt-2">
            O imposto ({{ dinheiro(imposto) }}) sai primeiro da 1ª parte e vira uma linha "Imposto" no caixa, na conta dela.
          </p>
        </template>

        <div v-if="erro" class="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm font-medium flex items-start gap-2">
          <AlertTriangle class="w-4 h-4 mt-0.5 flex-shrink-0" /> {{ erro }}
        </div>
      </div>

      <div class="bg-slate-50/70 px-6 py-4 border-t border-slate-200 flex gap-3 flex-shrink-0">
        <button @click="$emit('close')"
                class="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg shadow-xs hover:bg-slate-50 transition-colors text-sm">
          Cancelar
        </button>
        <button @click="confirmar" :disabled="!podeConfirmar || salvando" data-campo="confirmar"
                class="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed">
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
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
input[type="number"] { -moz-appearance: textfield; }
</style>
