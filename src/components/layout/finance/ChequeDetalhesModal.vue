<script setup>
import { ref, computed, onMounted } from 'vue';
import { X, CreditCard, FileText, History, ArrowRight, Split, Receipt, Layers, Loader2, AlertTriangle } from 'lucide-vue-next';
import checkService from '../../../services/checkService';

const props = defineProps({
  cheque: Object,
  isOpen: Boolean
});

const emit = defineEmits(['close']);

// Abre na hora com o que a lista ja tem; o borderô e os outros titulos chegam em seguida.
const detalhe = ref(null);
const carregando = ref(true);
const erro = ref('');
const d = computed(() => ({ ...props.cheque, ...(detalhe.value || {}) }));
const b = computed(() => detalhe.value?.bordero || null);

onMounted(async () => {
  try {
    detalhe.value = await checkService.detalhes(props.cheque.id);
  } catch (e) {
    erro.value = 'Não consegui carregar os dados do borderô.';
  } finally {
    carregando.value = false;
  }
});

const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
const formatDate = (val) => val ? String(val).slice(0, 10).split('-').reverse().join('/') : '-';
const pct = (v) => `${(Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

const ABERTOS = ['Aguardando', 'Atrasado', 'Prorrogado', 'Juridico', 'Devolvido'];
const hoje = new Date().toLocaleDateString('en-CA');
const diasEntre = (de, ate) => Math.round((new Date(ate + 'T12:00:00') - new Date(de + 'T12:00:00')) / 86400000);

const prazo = computed(() => {
  if (!ABERTOS.includes(d.value.status) || !d.value.vencimento) return null;
  const n = diasEntre(hoje, d.value.vencimento);
  if (n > 0) return { texto: `vence em ${n} dia${n > 1 ? 's' : ''}`, cor: 'text-slate-500' };
  if (n === 0) return { texto: 'vence hoje', cor: 'text-amber-600' };
  return { texto: `atrasado há ${-n} dia${n < -1 ? 's' : ''}`, cor: 'text-red-600' };
});

// dados deste titulo no borderô de origem
const valorFace = computed(() => Number(d.value.valor_original ?? d.value.valor_bruto) || 0);
const jurosPct = computed(() => (valorFace.value ? (Number(d.value.juros) || 0) / valorFace.value * 100 : 0));
// taxa ao mes que esses numeros representam (juros compostos, como o borderô):
// dá a taxa do borderô nos criados aqui e a taxa da planilha nos importados
const taxaEquivalente = computed(() => {
  const liq = Number(d.value.valor_liquido) || 0;
  if (!d.value.dias || d.value.dias <= 0 || liq <= 0 || liq >= valorFace.value) return null;
  return (Math.pow(valorFace.value / liq, 30 / d.value.dias) - 1) * 100;
});
const parcela = computed(() => {
  const lista = detalhe.value?.titulos_do_bordero || [];
  const i = lista.findIndex(t => t.id === d.value.id);
  return i >= 0 ? `${i + 1} de ${b.value?.qtd_titulos || lista.length}` : null;
});
const desconto = computed(() => (b.value ? b.value.valor_total - b.value.liquido_entregue : 0));
// juros gravado nos titulos x desconto de verdade (valor - liquido entregue - IOF)
const diferencaJuros = computed(() => {
  if (!b.value || b.value.importado) return 0;
  const dif = desconto.value - b.value.iof - b.value.juros_total;
  return Math.abs(dif) > 1 ? dif : 0;
});

const historico = computed(() => d.value.historico_prorrogacao || []);
const corStatus = (s) => ({
  Pago: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Atrasado: 'bg-red-100 text-red-700 border-red-200',
  Devolvido: 'bg-orange-100 text-orange-700 border-orange-200',
  Juridico: 'bg-purple-100 text-purple-700 border-purple-200',
  Prorrogado: 'bg-amber-50 text-amber-700 border-amber-200',
}[s] || 'bg-blue-50 text-blue-700 border-blue-200');
const statusDoTitulo = (t) => (t.status === 'Aguardando' && t.vencimento < hoje ? 'Atrasado' : t.status);

// % da parte sobre o valor recebido (recebimento dividido)
const percentual = (valor) => {
  const total = Number(d.value?.valor_pago) || Number(d.value?.valor_bruto) || 0;
  if (!total) return '';
  const p = (Number(valor) || 0) / total * 100;
  return `${p % 1 === 0 ? p.toFixed(0) : p.toFixed(1)}%`;
};
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[70] flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="$emit('close')"></div>

    <div class="bg-white w-full max-w-4xl rounded-2xl shadow-2xl relative z-10 overflow-hidden animate-scale-in flex flex-col max-h-[92vh]" data-modal="detalhes">

      <div class="bg-slate-900 px-6 py-4 flex justify-between items-start flex-shrink-0">
        <div>
          <h2 class="text-white text-xl font-bold flex items-center gap-2 flex-wrap">
            <CreditCard class="w-6 h-6 text-emerald-400" />
            {{ (d.tipo || 'CHEQUE') === 'PROMISSORIA' ? 'Promissória' : 'Cheque' }} {{ d.numero ? '#' + d.numero : 'sem número' }}
            <span :class="['px-2 py-0.5 rounded-md text-[11px] font-black uppercase border', corStatus(d.status)]">{{ d.status }}</span>
            <span v-if="d.fora_do_calculo" class="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-slate-700 text-slate-200">fora do cálculo</span>
            <span v-if="d.importado" class="px-2 py-0.5 rounded-md text-[10px] font-black uppercase border border-indigo-400 text-indigo-300">importado</span>
          </h2>
          <p class="text-slate-400 text-sm mt-1">{{ d.cliente }} · Borderô #{{ d.operation_id }}<template v-if="parcela"> · título {{ parcela }}</template></p>
        </div>
        <button @click="$emit('close')" class="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors">
          <X class="w-6 h-6" />
        </button>
      </div>

      <div class="p-6 space-y-5 overflow-y-auto text-sm">

        <!-- resumo -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="rounded-xl border border-slate-200 p-3">
            <div class="text-[10px] font-bold text-slate-400 uppercase">Valor devido hoje</div>
            <div class="text-2xl font-extrabold text-slate-900 tabular-nums">{{ formatMoney(d.valor_bruto) }}</div>
            <div v-if="valorFace !== d.valor_bruto" class="text-[11px] text-slate-500">valor de face: {{ formatMoney(valorFace) }}</div>
            <div v-if="d.juros_pendentes > 0" class="text-[11px] text-amber-700">inclui {{ formatMoney(d.juros_pendentes) }} de juros não pagos</div>
          </div>
          <div class="rounded-xl border border-slate-200 p-3">
            <div class="text-[10px] font-bold text-slate-400 uppercase">Vencimento</div>
            <div class="text-2xl font-extrabold text-indigo-700">{{ formatDate(d.vencimento) }}</div>
            <div v-if="prazo" :class="['text-[11px] font-bold', prazo.cor]">{{ prazo.texto }}</div>
            <div v-if="d.vencimento_original && d.vencimento_original !== d.vencimento" class="text-[11px] text-slate-400">original: {{ formatDate(d.vencimento_original) }}</div>
          </div>
          <div class="rounded-xl border border-slate-200 p-3">
            <div class="text-[10px] font-bold text-slate-400 uppercase">Emitente</div>
            <div class="font-bold text-slate-800 truncate" :title="d.emitente">{{ d.emitente || 'Mesmo do cliente' }}</div>
            <div class="text-[11px] text-slate-500 truncate">{{ d.banco || 'banco não informado' }}</div>
          </div>
          <div class="rounded-xl border border-slate-200 p-3">
            <div class="text-[10px] font-bold text-slate-400 uppercase">Cliente</div>
            <div class="font-bold text-slate-800 truncate" :title="d.cliente">{{ d.cliente }}</div>
            <div class="text-[11px] text-slate-500">taxa do cliente: {{ d.taxa_cliente != null ? pct(d.taxa_cliente) + ' a.m.' : '—' }}</div>
          </div>
        </div>

        <div v-if="erro" class="text-xs text-red-600 flex items-center gap-1"><AlertTriangle class="w-3 h-3" /> {{ erro }}</div>
        <div v-else-if="carregando" class="text-xs text-slate-400 flex items-center gap-1"><Loader2 class="w-3 h-3 animate-spin" /> carregando dados do borderô…</div>

        <!-- este titulo no borderô -->
        <section class="rounded-xl border border-slate-200 overflow-hidden">
          <h3 class="px-4 py-2 bg-slate-50 text-xs font-black text-slate-500 uppercase tracking-wide flex items-center gap-2"><Receipt class="w-4 h-4" /> Este título no borderô</h3>
          <div class="grid grid-cols-2 md:grid-cols-6 gap-3 p-4">
            <div><div class="text-[10px] font-bold text-slate-400 uppercase">Valor de face</div><div class="font-bold tabular-nums">{{ formatMoney(valorFace) }}</div></div>
            <div><div class="text-[10px] font-bold text-slate-400 uppercase">Prazo</div><div class="font-bold">{{ d.dias != null ? d.dias + ' dias' : '—' }}</div>
              <div class="text-[10px] text-slate-400">{{ formatDate(d.data_operacao) }} → {{ formatDate(d.vencimento_original) }}</div></div>
            <div><div class="text-[10px] font-bold text-slate-400 uppercase">Taxa</div>
              <div class="font-bold">
                <template v-if="b && b.taxa_mensal > 0">{{ pct(b.taxa_mensal) }} a.m.</template>
                <template v-else-if="taxaEquivalente !== null">≈ {{ pct(taxaEquivalente) }} a.m.</template>
                <template v-else>—</template>
              </div>
              <div v-if="b && !(b.taxa_mensal > 0) && taxaEquivalente !== null" class="text-[10px] text-slate-400">calculada dos valores</div></div>
            <div><div class="text-[10px] font-bold text-slate-400 uppercase">Juros</div><div class="font-bold text-red-600 tabular-nums">{{ formatMoney(d.juros) }}</div>
              <div class="text-[10px] text-slate-400">{{ pct(jurosPct) }} do valor</div></div>
            <div><div class="text-[10px] font-bold text-slate-400 uppercase">Líquido ao cliente</div><div class="font-bold text-emerald-700 tabular-nums">{{ formatMoney(d.valor_liquido) }}</div></div>
            <div><div class="text-[10px] font-bold text-slate-400 uppercase">Título</div><div class="font-bold">{{ parcela || '—' }}</div>
              <div class="text-[10px] text-slate-400">{{ d.tipo === 'PROMISSORIA' ? 'promissória' : 'cheque' }}</div></div>
          </div>
        </section>

        <!-- borderô de origem -->
        <section v-if="b" class="rounded-xl border border-slate-200 overflow-hidden">
          <h3 class="px-4 py-2 bg-slate-50 text-xs font-black text-slate-500 uppercase tracking-wide flex items-center gap-2">
            <FileText class="w-4 h-4" /> Borderô #{{ b.id }}
            <span v-if="b.importado" class="normal-case font-bold text-indigo-600">· importado da planilha</span>
          </h3>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
            <div><div class="text-[10px] font-bold text-slate-400 uppercase">Data da operação</div><div class="font-bold">{{ formatDate(b.data) }}</div>
              <div v-if="b.lancado_em && !b.importado" class="text-[10px] text-slate-400">lançado em {{ formatDate(b.lancado_em) }} {{ b.lancado_em.slice(11) }}</div></div>
            <div><div class="text-[10px] font-bold text-slate-400 uppercase">Taxa / compensação</div>
              <div class="font-bold">{{ b.taxa_mensal > 0 ? pct(b.taxa_mensal) + ' a.m.' : 'não informada' }} · {{ b.dias_compensacao }} dia(s)</div></div>
            <div><div class="text-[10px] font-bold text-slate-400 uppercase">IOF</div><div class="font-bold tabular-nums">{{ b.iof > 0 ? formatMoney(b.iof) : 'sem IOF' }}</div></div>
            <div><div class="text-[10px] font-bold text-slate-400 uppercase">Saiu do caixa</div><div class="font-bold">{{ b.conta_saida || '—' }}</div></div>
            <div><div class="text-[10px] font-bold text-slate-400 uppercase">Valor total ({{ b.qtd_titulos }} títulos)</div><div class="font-bold tabular-nums">{{ formatMoney(b.valor_total) }}</div></div>
            <div><div class="text-[10px] font-bold text-slate-400 uppercase">Desconto cobrado</div><div class="font-bold text-red-600 tabular-nums">{{ formatMoney(desconto) }}</div>
              <div class="text-[10px] text-slate-400">{{ b.valor_total ? pct(desconto / b.valor_total * 100) : '' }} do valor</div></div>
            <div><div class="text-[10px] font-bold text-slate-400 uppercase">Líquido entregue</div><div class="font-bold text-emerald-700 tabular-nums">{{ formatMoney(b.liquido_entregue) }}</div></div>
            <div><div class="text-[10px] font-bold text-slate-400 uppercase">Juros registrado nos títulos</div><div class="font-bold tabular-nums">{{ formatMoney(b.juros_total) }}</div></div>
          </div>
          <div v-if="diferencaJuros" class="mx-4 mb-3 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
            O juros registrado nos títulos está {{ formatMoney(Math.abs(diferencaJuros)) }} {{ diferencaJuros > 0 ? 'abaixo' : 'acima' }} do desconto cobrado neste borderô.
          </div>
          <div v-if="b.observacao" class="mx-4 mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 whitespace-pre-wrap">{{ b.observacao }}</div>
        </section>

        <!-- pagamento -->
        <section v-if="d.data_pagamento || d.status === 'Devolvido'" class="rounded-xl border border-emerald-200 overflow-hidden">
          <h3 class="px-4 py-2 bg-emerald-50 text-xs font-black text-emerald-700 uppercase tracking-wide">Pagamento</h3>
          <div class="grid grid-cols-3 gap-3 p-4">
            <div v-if="d.data_pagamento"><div class="text-[10px] font-bold text-slate-400 uppercase">Pago em</div><div class="font-bold text-emerald-700">{{ formatDate(d.data_pagamento) }}</div></div>
            <div v-if="d.valor_pago"><div class="text-[10px] font-bold text-slate-400 uppercase">Valor recebido</div><div class="font-bold tabular-nums">{{ formatMoney(d.valor_pago) }}</div></div>
            <div v-if="d.forma_pagamento"><div class="text-[10px] font-bold text-slate-400 uppercase">Forma</div><div class="font-bold">{{ d.forma_pagamento }}</div></div>
            <div v-if="d.status === 'Devolvido' && d.forma_devolucao"><div class="text-[10px] font-bold text-red-500 uppercase">Multa cobrada via</div><div class="font-bold">{{ d.forma_devolucao }}</div></div>
          </div>
          <table v-if="d.partes_pagamento && d.partes_pagamento.length" class="w-full text-xs border-t border-emerald-100">
            <tbody class="divide-y divide-emerald-100">
              <tr v-for="(p, i) in d.partes_pagamento" :key="i">
                <td class="px-4 py-2 text-slate-500 font-bold"><Split class="w-3 h-3 inline mr-1" />{{ i + 1 }}ª parte</td>
                <td class="px-2 py-2 font-black uppercase text-[10px] text-emerald-800">{{ p.conta }}</td>
                <td class="px-2 py-2 text-slate-500 uppercase text-[10px] font-bold">{{ p.forma && p.forma !== p.conta ? p.forma : '' }}</td>
                <td class="px-2 py-2 text-right text-slate-400 font-bold">{{ percentual(p.valor) }}</td>
                <td class="px-4 py-2 text-right font-black text-emerald-700">{{ formatMoney(p.valor) }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- prorrogacoes e pagamentos parciais -->
        <section class="rounded-xl border border-slate-200 overflow-hidden">
          <h3 class="px-4 py-2 bg-slate-50 text-xs font-black text-slate-500 uppercase tracking-wide flex items-center gap-2">
            <History class="w-4 h-4" /> Prorrogações e pagamentos parciais ({{ historico.length }})
          </h3>
          <p v-if="!historico.length" class="px-4 py-3 text-slate-400 text-xs">Nenhuma prorrogação até agora.</p>
          <div v-else class="overflow-x-auto">
            <table class="w-full text-xs text-left">
              <thead class="text-slate-400 font-bold uppercase text-[10px]">
                <tr>
                  <th class="px-3 py-2">Data</th>
                  <th class="px-3 py-2">Vencimento</th>
                  <th class="px-3 py-2 text-right">Devia</th>
                  <th class="px-3 py-2 text-right">Juros</th>
                  <th class="px-3 py-2 text-right">Pagou</th>
                  <th class="px-3 py-2 text-right">Novo valor</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <template v-for="h in historico" :key="h.id">
                  <tr v-if="h.novo_total !== undefined" class="align-top">
                    <td class="px-3 py-2 text-slate-600 whitespace-nowrap">{{ formatDate(h.data_simulacao) }}</td>
                    <td class="px-3 py-2 whitespace-nowrap">
                      <template v-if="h.prorrogar">
                        <span class="text-slate-500">{{ formatDate(h.de) }}</span>
                        <ArrowRight class="w-3 h-3 inline text-slate-300 mx-1" />
                        <span class="font-bold text-indigo-700">{{ formatDate(h.para) }}</span>
                        <div class="text-[10px] text-slate-400">{{ h.dias }} dias · {{ pct(h.taxa_mensal) }} a.m.{{ h.iof ? ' · IOF' : '' }}</div>
                      </template>
                      <span v-else class="text-slate-500">pagamento parcial (sem prorrogar)</span>
                    </td>
                    <td class="px-3 py-2 text-right tabular-nums whitespace-nowrap">{{ formatMoney(h.valor_anterior) }}
                      <div v-if="h.ajuste" class="text-[10px] text-amber-700">ajuste {{ formatMoney(h.ajuste) }}</div></td>
                    <td class="px-3 py-2 text-right tabular-nums text-red-600 whitespace-nowrap">{{ h.novos_juros ? formatMoney(h.novos_juros) : '—' }}
                      <div v-if="h.juros_calculado != null && h.juros_calculado !== h.novos_juros" class="text-[10px] text-amber-700">à mão (sist. {{ formatMoney(h.juros_calculado) }})</div></td>
                    <td class="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                      <span :class="h.valor_recebido ? 'text-emerald-700 font-bold' : 'text-slate-400'">{{ h.valor_recebido ? formatMoney(h.valor_recebido) : 'nada' }}</span>
                      <div v-if="h.juros_pagos" class="text-[10px] text-slate-500">juros {{ formatMoney(h.juros_pagos) }}</div>
                      <div v-if="h.principal_abatido" class="text-[10px] text-slate-500">abateu {{ formatMoney(h.principal_abatido) }}</div>
                      <div v-if="h.juros_nao_pagos" class="text-[10px] text-amber-700">faltou {{ formatMoney(h.juros_nao_pagos) }} de juros</div>
                      <div v-if="h.conta" class="text-[10px] text-slate-400">{{ h.conta }} · {{ formatDate(h.data_recebimento) }}</div>
                    </td>
                    <td class="px-3 py-2 text-right tabular-nums font-bold text-slate-800 whitespace-nowrap">{{ formatMoney(h.novo_total) }}</td>
                  </tr>
                  <tr v-else class="align-top">
                    <td class="px-3 py-2 text-slate-600 whitespace-nowrap">{{ formatDate(h.data_simulacao) }}</td>
                    <td class="px-3 py-2 whitespace-nowrap">
                      <span class="text-slate-500">{{ formatDate(h.de) }}</span>
                      <ArrowRight class="w-3 h-3 inline text-slate-300 mx-1" />
                      <span class="font-bold text-indigo-700">{{ formatDate(h.para) }}</span>
                      <div class="text-[10px] text-slate-400">+{{ h.dias }} dias</div>
                    </td>
                    <td class="px-3 py-2 text-right text-slate-400">—</td>
                    <td class="px-3 py-2 text-right tabular-nums text-red-600">{{ formatMoney(h.taxa) }}</td>
                    <td class="px-3 py-2 text-right text-[10px] text-slate-500">pago na hora<div>{{ h.forma_pagamento }}</div></td>
                    <td class="px-3 py-2 text-right text-slate-400">—</td>
                  </tr>
                  <tr v-if="h.observacao"><td></td><td colspan="5" class="px-3 pb-2 -mt-1 text-[11px] text-slate-500 italic">“{{ h.observacao }}”</td></tr>
                </template>
              </tbody>
            </table>
          </div>
        </section>

        <!-- outros titulos do mesmo borderô -->
        <section v-if="detalhe && detalhe.titulos_do_bordero && detalhe.titulos_do_bordero.length > 1" class="rounded-xl border border-slate-200 overflow-hidden">
          <h3 class="px-4 py-2 bg-slate-50 text-xs font-black text-slate-500 uppercase tracking-wide flex items-center gap-2">
            <Layers class="w-4 h-4" /> Títulos do borderô #{{ b?.id }} ({{ b?.qtd_titulos }})
          </h3>
          <div class="max-h-56 overflow-y-auto">
            <table class="w-full text-xs">
              <tbody class="divide-y divide-slate-100">
                <tr v-for="(t, i) in detalhe.titulos_do_bordero" :key="t.id" :class="t.id === d.id ? 'bg-indigo-50 font-bold' : ''">
                  <td class="px-4 py-1.5 text-slate-400 w-10">{{ i + 1 }}</td>
                  <td class="px-2 py-1.5">{{ t.numero || 'S/N' }}</td>
                  <td class="px-2 py-1.5 text-slate-500 truncate max-w-[180px]">{{ t.emitente }}</td>
                  <td class="px-2 py-1.5">{{ formatDate(t.vencimento) }}</td>
                  <td class="px-2 py-1.5 text-right tabular-nums">{{ formatMoney(t.valor) }}</td>
                  <td class="px-4 py-1.5 text-right"><span :class="['px-2 py-0.5 rounded border text-[10px] font-black uppercase', corStatus(statusDoTitulo(t))]">{{ statusDoTitulo(t) }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div class="bg-slate-50 p-4 flex justify-end flex-shrink-0 border-t border-slate-200">
        <button @click="$emit('close')" class="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition-colors">Fechar</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-scale-in { animation: scaleIn 0.2s ease-out; }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
</style>
