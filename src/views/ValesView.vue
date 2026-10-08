<script setup>
import { ref, reactive, watch, onMounted } from 'vue';
import DashboardLayout from '../layouts/DashboardLayout.vue';
import ValeDetalhesModal from '../components/layout/finance/ValeDetalhesModal.vue';
import ValePagamentoModal from '../components/layout/finance/ValePagamentoModal.vue';
import ValeEditarModal from '../components/layout/finance/ValeEditarModal.vue';
import { Plus, Loader2, X, HandCoins, Wallet, AlertTriangle, Pencil, Trash2 } from 'lucide-vue-next';
import valeService from '../services/valeService';
import { CONTAS, ESTILO } from '../utils/contasCaixa';

const hoje = () => new Date().toLocaleDateString('en-CA');

const vales = ref([]);
const loading = ref(true);
const totalItems = ref(0);
const totalPages = ref(1);
const currentPage = ref(1);
const emAberto = ref(0);
const qtdAberto = ref(0);
const filtros = reactive({ texto: '', status: 'Aberto' });

const novo = reactive({ visible: false, valor: '', conta: 'Dinheiro', data: hoje(), descricao: '', erro: '', salvando: false });
const detalheId = ref(null);
const detalheVersao = ref(0);
const pagando = ref(null);
const editando = ref(null);
const detalheApagar = ref(false);
const aviso = ref('');

const carregar = async () => {
  loading.value = true;
  try {
    const res = await valeService.getAll({ page: currentPage.value, per_page: 30, search: filtros.texto, status: filtros.status });
    vales.value = res.items;
    totalItems.value = res.total;
    totalPages.value = res.pages;
    emAberto.value = res.em_aberto;
    qtdAberto.value = res.qtd_aberto;
  } catch (e) { console.error(e); } finally { loading.value = false; }
};

let timeoutBusca = null;
watch(() => filtros.texto, () => {
  clearTimeout(timeoutBusca);
  timeoutBusca = setTimeout(() => { currentPage.value = 1; carregar(); }, 400);
});
watch(() => filtros.status, () => { currentPage.value = 1; carregar(); });
const mudarPagina = (p) => { if (p >= 1 && p <= totalPages.value) { currentPage.value = p; carregar(); } };
onMounted(carregar);

const abrirNovo = () => Object.assign(novo, { visible: true, valor: '', conta: 'Dinheiro', data: hoje(), descricao: '', erro: '' });

const salvarNovo = async () => {
  if (!novo.descricao.trim() || !(Number(novo.valor) > 0)) { novo.erro = 'Informe a descrição e um valor maior que zero.'; return; }
  novo.salvando = true;
  novo.erro = '';
  try {
    await valeService.create({ descricao: novo.descricao, valor: Number(novo.valor), conta: novo.conta, data: novo.data });
    novo.visible = false;
    await carregar();
  } catch (e) {
    novo.erro = e.response?.data?.error || 'Não foi possível criar o vale.';
  } finally { novo.salvando = false; }
};

const aposPagamento = async () => {
  detalheApagar.value = false;
  detalheVersao.value++;
  await carregar();
};

const abrirDetalhe = (v, apagar = false) => {
  detalheApagar.value = apagar;
  detalheId.value = v.id;
};

const aposApagar = async (r) => {
  aviso.value = r?.saida_no_caixa === false
    ? `Vale #${detalheId.value} apagado. A saída dele não foi encontrada no caixa (talvez já tivesse sido apagada lá) — confira o Fluxo de Caixa.`
    : '';
  detalheId.value = null;
  await carregar();
};

const nomeConta = (id) => CONTAS.find(c => c.id === id)?.nome || id;
const formatMoney = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const formatDate = (d) => d ? d.split('-').reverse().join('/') : '-';
</script>

<template>
  <DashboardLayout>
    <div v-if="novo.visible" class="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" @keydown.esc="novo.visible = false">
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="novo.visible = false"></div>
      <div class="relative z-10 w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[92vh]">
        <div class="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-start flex-shrink-0">
          <div>
            <h2 class="text-slate-900 text-base font-semibold flex items-center gap-2"><HandCoins class="w-5 h-5 text-red-500" /> Novo vale</h2>
            <p class="text-slate-500 text-sm mt-0.5">O valor sai do caixa na hora e volta conforme for pago.</p>
          </div>
          <button @click="novo.visible = false" aria-label="Fechar" class="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-lg transition-colors"><X class="w-5 h-5" /></button>
        </div>

        <div class="p-6 space-y-5 overflow-y-auto text-sm">
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1.5">Descrição</label>
            <input v-model="novo.descricao" maxlength="200" autofocus placeholder="Ex.: João - adiantamento de salário" data-campo="vale-descricao"
                   class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" />
          </div>
          <div class="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1.5">Valor</label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">R$</span>
                <input v-model="novo.valor" type="number" min="0.01" step="0.01" inputmode="decimal" @keyup.enter="salvarNovo"
                       class="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-lg font-semibold text-slate-900 tabular-nums outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" />
              </div>
            </div>
            <div class="md:w-44">
              <label class="block text-xs font-medium text-slate-600 mb-1.5">Data</label>
              <input v-model="novo.data" type="date"
                     class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1.5">Sai de qual conta</label>
            <div class="grid grid-cols-3 gap-2">
              <button v-for="c in CONTAS" :key="c.id" @click="novo.conta = c.id"
                      class="border rounded-xl p-3 text-left transition-all"
                      :class="novo.conta === c.id ? ESTILO[c.id].ativo : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white'">
                <component :is="c.icone" class="w-5 h-5 mb-1.5" />
                <div class="text-xs font-semibold leading-tight">{{ c.nome }}</div>
                <div class="text-[11px] opacity-70">{{ c.sub }}</div>
              </button>
            </div>
          </div>
          <div v-if="novo.erro" class="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm font-medium flex items-start gap-2">
            <AlertTriangle class="w-4 h-4 mt-0.5 flex-shrink-0" /> {{ novo.erro }}
          </div>
        </div>

        <div class="bg-slate-50/70 px-6 py-4 border-t border-slate-200 flex gap-3 flex-shrink-0">
          <button @click="novo.visible = false" class="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg shadow-xs hover:bg-slate-50 transition-colors text-sm">Cancelar</button>
          <button @click="salvarNovo" :disabled="novo.salvando"
                  class="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-xs transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:shadow-none">
            <Loader2 v-if="novo.salvando" class="w-4 h-4 animate-spin" />
            <Plus v-else class="w-4 h-4" />
            {{ novo.salvando ? 'Salvando...' : `Criar vale de ${formatMoney(Number(novo.valor) || 0)} · sai de ${nomeConta(novo.conta)}` }}
          </button>
        </div>
      </div>
    </div>

    <ValeDetalhesModal v-if="detalheId" :key="detalheId + '-' + detalheVersao" :vale-id="detalheId"
                       :coberto="!!pagando || !!editando" :iniciar-apagando="detalheApagar"
                       @close="detalheId = null" @pagar="pagando = $event" @alterado="carregar"
                       @editar="editando = $event" @apagado="aposApagar" />
    <ValePagamentoModal v-if="pagando" :vale="pagando" @close="pagando = null" @confirmado="aposPagamento" />
    <ValeEditarModal v-if="editando" :vale="editando" @close="editando = null" @salvo="aposPagamento" />

    <div class="flex flex-col md:flex-row justify-between items-start md:items-end mb-7 gap-4">
      <div>
        <h1 class="text-2xl font-semibold text-slate-900 tracking-tight">Vales</h1>
        <p class="text-slate-500 text-sm mt-1">Adiantamentos que saem do caixa e voltam aos poucos ou de uma vez. Clique num vale para ver os pagamentos.</p>
      </div>
      <button @click="abrirNovo" class="bg-indigo-600 hover:bg-indigo-700 text-white h-9 px-3.5 rounded-lg text-sm font-semibold shadow-xs ring-1 ring-inset ring-white/10 flex items-center transition-colors">
        <Plus class="w-4 h-4 mr-2" /> Novo vale
      </button>
    </div>

    <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200/80 mb-6 max-w-sm">
      <div class="flex items-center gap-3">
        <span class="w-9 h-9 rounded-lg bg-red-50 text-red-600 ring-1 ring-inset ring-red-100 flex items-center justify-center"><HandCoins class="w-[18px] h-[18px]" /></span>
        <span class="text-sm font-medium text-slate-500">Em aberto <span class="text-slate-400">· {{ qtdAberto }} vale(s)</span></span>
      </div>
      <div class="mt-4 text-2xl font-semibold tracking-tight tabular-nums text-red-600">{{ formatMoney(emAberto) }}</div>
    </div>

    <div v-if="aviso" class="mb-4 bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-sm font-medium flex items-start justify-between gap-2">
      <span class="flex items-start gap-2"><AlertTriangle class="w-4 h-4 mt-0.5 flex-shrink-0" /> {{ aviso }}</span>
      <button @click="aviso = ''" aria-label="Fechar aviso" class="p-0.5 rounded hover:bg-amber-100"><X class="w-4 h-4" /></button>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
      <div class="p-4 border-b border-slate-200 flex flex-col md:flex-row gap-3">
        <input v-model="filtros.texto" type="text" placeholder="Buscar na descrição..." class="w-full md:w-64 px-3 py-2 border rounded-lg text-sm outline-none border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" />
        <select v-model="filtros.status" class="px-3 py-2 border rounded-lg text-sm outline-none border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow">
          <option value="Aberto">Em aberto</option>
          <option value="Pago">Pagos</option>
          <option value="">Todos</option>
        </select>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-50/80 text-slate-500 text-xs font-medium border-b border-slate-200">
            <tr>
              <th class="px-4 py-2.5">Data</th>
              <th class="px-4 py-2.5">Descrição</th>
              <th class="px-4 py-2.5">Saiu de</th>
              <th class="px-4 py-2.5 text-right">Valor</th>
              <th class="px-4 py-2.5 text-right">Falta pagar</th>
              <th class="px-4 py-2.5">Situação</th>
              <th class="px-4 py-2.5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="loading"><td colspan="7" class="px-6 py-10 text-center"><Loader2 class="w-6 h-6 animate-spin mx-auto" /></td></tr>
            <tr v-else-if="!vales.length"><td colspan="7" class="px-6 py-10 text-center text-slate-400">Nenhum vale.</td></tr>
            <tr v-for="v in vales" v-show="!loading" :key="v.id" @click="abrirDetalhe(v)" class="hover:bg-slate-50 cursor-pointer">
              <td class="px-4 py-2.5 text-slate-500 tabular-nums text-[13px] whitespace-nowrap">{{ formatDate(v.data) }}</td>
              <td class="px-4 py-2.5 font-medium text-slate-800">{{ v.descricao }}</td>
              <td class="px-4 py-2.5 text-xs text-slate-600">{{ nomeConta(v.conta) }}</td>
              <td class="px-4 py-2.5 text-right font-semibold text-slate-900 tabular-nums">{{ formatMoney(v.valor) }}</td>
              <td class="px-4 py-2.5 text-right tabular-nums">
                <span class="font-semibold" :class="v.saldo > 0 ? 'text-red-600' : 'text-slate-400'">{{ formatMoney(v.saldo) }}</span>
                <div v-if="v.pago > 0 && v.saldo > 0" class="text-[11px] text-emerald-600">pago {{ formatMoney(v.pago) }}</div>
              </td>
              <td class="px-4 py-2.5">
                <span v-if="v.status === 'Pago'" class="px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Pago {{ formatDate(v.data_pagamento) }} · {{ nomeConta(v.conta_pagamento) }}
                </span>
                <span v-else-if="v.pago > 0" class="px-2 py-0.5 rounded-md text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">Pago em parte</span>
                <span v-else class="px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">Em aberto</span>
              </td>
              <td class="px-4 py-2.5 text-right whitespace-nowrap">
                <button v-if="v.status === 'Aberto'" @click.stop="pagando = v" class="inline-flex items-center gap-1.5 h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors align-middle">
                  <Wallet class="w-4 h-4" /> Pagar
                </button>
                <button @click.stop="editando = v" title="Editar vale" aria-label="Editar vale"
                        class="ml-1 p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors align-middle"><Pencil class="w-4 h-4" /></button>
                <button @click.stop="abrirDetalhe(v, true)" title="Apagar vale" aria-label="Apagar vale"
                        class="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors align-middle"><Trash2 class="w-4 h-4" /></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="px-5 py-3 border-t border-slate-200 flex justify-between items-center">
        <span class="text-[13px] text-slate-500">Página {{ currentPage }} de {{ totalPages || 1 }} · {{ totalItems }} vale(s)</span>
        <div class="flex gap-2">
          <button @click="mudarPagina(currentPage - 1)" :disabled="currentPage === 1" class="h-8 px-3 bg-white border border-slate-300 rounded-lg shadow-xs text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:shadow-none">Anterior</button>
          <button @click="mudarPagina(currentPage + 1)" :disabled="currentPage >= totalPages" class="h-8 px-3 bg-white border border-slate-300 rounded-lg shadow-xs text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:shadow-none">Próxima</button>
        </div>
      </div>
    </div>
  </DashboardLayout>
</template>

<style scoped>
.animate-scale-in { animation: scaleIn 0.2s ease-out; }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
input[type="number"] { -moz-appearance: textfield; }
</style>
