<script setup>
// Troca de status pelo botao da lista (menos Pago, que tem o modal de Receber).
// Mostra antes de confirmar o que entra e o que sai do caixa.
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  X, ArrowRight, AlertTriangle, Loader2, CheckCircle2, Info, CalendarClock, Undo2, Scale, Clock, Ban
} from 'lucide-vue-next';
import checkService from '../../../services/checkService';
import { CONTAS, ESTILO, arred } from '../../../utils/contasCaixa';

const props = defineProps({
  cheque: { type: Object, required: true },
  novoStatus: { type: String, required: true },
  taxaMulta: { type: Number, default: 2 }
});
const emit = defineEmits(['close', 'confirmado']);

const ROTULO = { Aguardando: 'Aguardando', Atrasado: 'Atrasado', Devolvido: 'Devolvido', Juridico: 'Jurídico', Pago: 'Pago' };
const COR = {
  Pago: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Atrasado: 'bg-red-50 text-red-700 border-red-200',
  Devolvido: 'bg-orange-50 text-orange-700 border-orange-200',
  Juridico: 'bg-purple-50 text-purple-700 border-purple-200',
  Aguardando: 'bg-blue-50 text-blue-700 border-blue-200'
};
const TELA = {
  Devolvido: { titulo: 'Registrar devolução', icone: Ban, cor: 'text-orange-600', botao: 'bg-orange-600 hover:bg-orange-700 shadow-xs' },
  Juridico: { titulo: 'Enviar para o Jurídico', icone: Scale, cor: 'text-purple-600', botao: 'bg-purple-600 hover:bg-purple-700 shadow-xs' },
  Aguardando: { titulo: 'Voltar para Aguardando', icone: Undo2, cor: 'text-blue-600', botao: 'bg-blue-600 hover:bg-blue-700 shadow-xs' },
  Atrasado: { titulo: 'Marcar como atrasado', icone: Clock, cor: 'text-red-600', botao: 'bg-red-600 hover:bg-red-700 shadow-xs' }
};
const tela = computed(() => TELA[props.novoStatus] || TELA.Aguardando);

const devolucao = computed(() => props.novoStatus === 'Devolvido');
const taxa = ref(props.taxaMulta);
const conta = ref('Dinheiro');
const taxaValida = computed(() => { const t = Number(taxa.value); return taxa.value !== '' && Number.isFinite(t) && t >= 0 && t <= 100; });
// mesma conta do backend: valor do titulo x taxa
const multa = computed(() => (taxaValida.value ? arred(Number(props.cheque.valor_bruto) * Number(taxa.value) / 100) : 0));

const erro = ref('');
const salvando = ref(false);

const dinheiro = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const dataBR = (d) => (d ? d.split('-').reverse().join('/') : '-');
const nomeConta = (id) => CONTAS.find(c => c.id === id)?.nome || id;

// o que acontece no caixa e no painel, na ordem em que o backend faz
const efeitos = computed(() => {
  const c = props.cheque;
  const novo = props.novoStatus;
  const lista = [];
  if (c.status === 'Pago') {
    lista.push({ tipo: 'sai', texto: `Desfaz o recebimento: sai do caixa ${dinheiro(c.valor_pago)}` +
      (c.forma_pagamento ? ` (${c.forma_pagamento})` : '') +
      (c.imposto_cobrado ? `, já com ${dinheiro(c.imposto_cobrado)} de imposto` : '') + '.' });
  }
  if (c.status === 'Devolvido' && ['Aguardando', 'Atrasado'].includes(novo) && c.multa > 0) {
    lista.push({ tipo: 'sai', texto: `Desfaz a devolução: a multa de ${dinheiro(c.multa)} sai do caixa.` });
  }
  if (devolucao.value && multa.value > 0) {
    lista.push({ tipo: 'entra', texto: `Entra no caixa a multa de ${dinheiro(multa.value)} em ${nomeConta(conta.value)}.` });
  }
  const mexeNoCaixa = lista.length > 0;
  if (novo === 'Juridico') {
    lista.push({ tipo: 'info', texto: 'O título vai para o Jurídico e continua sendo cobrado' +
      (mexeNoCaixa ? '.' : ' — nada entra nem sai do caixa.') });
  } else if (!mexeNoCaixa) {
    lista.push({ tipo: 'info', texto: 'Nada entra nem sai do caixa: só muda a situação do título.' });
  }
  return lista;
});

const confirmar = async () => {
  if (salvando.value) return;
  if (devolucao.value && !taxaValida.value) { erro.value = 'Taxa da multa inválida (de 0 a 100%).'; return; }
  erro.value = '';
  salvando.value = true;
  try {
    const payment_data = devolucao.value ? { method: conta.value, taxa_multa: Number(taxa.value) } : {};
    await checkService.updateStatus(props.cheque.id, props.novoStatus, { payment_data });
    emit('confirmado');
    emit('close');
  } catch (e) {
    erro.value = e.response?.data?.error || 'Erro ao mudar o status.';
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

    <div class="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[92vh]" data-modal="status">
      <div class="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-start flex-shrink-0">
        <div class="min-w-0">
          <h2 class="text-slate-900 text-base font-semibold flex items-center gap-2">
            <component :is="tela.icone" :class="['w-5 h-5', tela.cor]" /> {{ tela.titulo }}
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
        <!-- de -> para -->
        <div class="flex items-center justify-center gap-3">
          <span :class="['px-2 py-0.5 rounded-md text-xs font-medium border', COR[cheque.status] || COR.Aguardando]">{{ ROTULO[cheque.status] || cheque.status }}</span>
          <ArrowRight class="w-4 h-4 text-slate-400" />
          <span :class="['px-2 py-0.5 rounded-md text-xs font-medium border ring-2 ring-offset-1 ring-slate-200', COR[novoStatus]]" data-campo="status-novo">{{ ROTULO[novoStatus] }}</span>
        </div>

        <!-- o titulo -->
        <div class="grid grid-cols-3 gap-px bg-slate-200 border border-slate-200 rounded-xl overflow-hidden">
          <div class="bg-white p-3">
            <div class="text-xs font-medium text-slate-500">Vencimento</div>
            <div class="font-semibold text-slate-900 mt-0.5">{{ dataBR(cheque.vencimento) }}</div>
            <div v-if="cheque.prorrogacoes" class="text-[11px] font-medium text-amber-700 mt-0.5 flex items-center gap-1">
              <CalendarClock class="w-3 h-3" /> prorrogado
            </div>
          </div>
          <div class="bg-white p-3">
            <div class="text-xs font-medium text-slate-500">Valor</div>
            <div class="font-semibold text-slate-900 tabular-nums mt-0.5">{{ dinheiro(cheque.valor_bruto) }}</div>
          </div>
          <div class="bg-white p-3 min-w-0">
            <div class="text-xs font-medium text-slate-500">Banco · doc</div>
            <div class="font-semibold text-slate-900 truncate mt-0.5">{{ cheque.banco || '—' }}</div>
            <div class="text-xs text-slate-500 truncate">{{ cheque.num_doc || 'sem número' }}</div>
          </div>
        </div>

        <!-- devolucao: multa -->
        <div v-if="devolucao" class="rounded-xl border border-orange-200 overflow-hidden">
          <div class="px-4 py-2.5 bg-orange-50 text-xs font-semibold text-orange-700">Multa da devolução</div>
          <div class="p-4 space-y-4">
            <div class="flex items-end gap-4">
              <div class="w-28">
                <label class="block text-xs font-medium text-slate-600 mb-1.5">Taxa</label>
                <div class="relative">
                  <input type="number" step="0.01" min="0" max="100" v-model="taxa" data-campo="taxa-multa"
                         class="w-full border border-slate-300 rounded-lg px-2 py-1.5 pr-6 font-bold text-slate-800 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/15 shadow-xs transition-shadow">
                  <span class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 font-medium">%</span>
                </div>
              </div>
              <div class="flex-1 text-right">
                <div class="text-xs font-medium text-slate-500">Multa</div>
                <div class="text-2xl font-semibold tracking-tight text-orange-700 tabular-nums" data-campo="multa">{{ dinheiro(multa) }}</div>
                <div class="text-xs text-slate-500">{{ taxaValida ? `${taxa}% de ${dinheiro(cheque.valor_bruto)}` : 'taxa inválida' }}</div>
              </div>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1.5">Onde a multa entra</label>
              <div class="grid grid-cols-3 gap-2">
                <button v-for="c in CONTAS" :key="c.id" @click="conta = c.id"
                        class="border rounded-xl p-2.5 text-left transition-all"
                        :class="conta === c.id ? ESTILO[c.id].ativo : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white'">
                  <component :is="c.icone" class="w-4 h-4 mb-1" />
                  <div class="text-xs font-semibold leading-tight">{{ c.nome }}</div>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- o que acontece -->
        <div>
          <div class="text-xs font-medium text-slate-500 mb-2">O que acontece</div>
          <ul class="space-y-2" data-campo="efeitos">
            <li v-for="(e, i) in efeitos" :key="i" class="flex items-start gap-2 text-xs rounded-lg border p-2.5"
                :class="{ 'bg-red-50 border-red-200 text-red-800': e.tipo === 'sai',
                          'bg-emerald-50 border-emerald-200 text-emerald-800': e.tipo === 'entra',
                          'bg-slate-50 border-slate-200 text-slate-600': e.tipo === 'info' }">
              <AlertTriangle v-if="e.tipo === 'sai'" class="w-4 h-4 flex-shrink-0" />
              <CheckCircle2 v-else-if="e.tipo === 'entra'" class="w-4 h-4 flex-shrink-0" />
              <Info v-else class="w-4 h-4 flex-shrink-0" />
              <span>{{ e.texto }}</span>
            </li>
          </ul>
        </div>

        <div v-if="erro" class="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm font-medium flex items-start gap-2">
          <AlertTriangle class="w-4 h-4 mt-0.5 flex-shrink-0" /> {{ erro }}
        </div>
      </div>

      <div class="bg-slate-50/70 px-6 py-4 border-t border-slate-200 flex gap-3 flex-shrink-0">
        <button @click="$emit('close')"
                class="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg shadow-xs hover:bg-slate-50 transition-colors text-sm">
          Cancelar
        </button>
        <button @click="confirmar" :disabled="salvando || (devolucao && !taxaValida)" data-campo="confirmar-status"
                :class="['flex-1 px-4 py-2.5 text-white font-semibold rounded-lg shadow-xs transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed', tela.botao]">
          <Loader2 v-if="salvando" class="w-4 h-4 animate-spin" />
          <CheckCircle2 v-else class="w-4 h-4" />
          {{ salvando ? 'Gravando...' : (devolucao && multa > 0 ? `Confirmar devolução e multa de ${dinheiro(multa)}` : `Confirmar: ${ROTULO[novoStatus]}`) }}
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
