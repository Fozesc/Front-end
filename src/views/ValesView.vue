<script setup>
import { ref, reactive, watch, onMounted } from 'vue';
import DashboardLayout from '../layouts/DashboardLayout.vue';
import { Plus, Loader2, CheckCircle2, X, HandCoins } from 'lucide-vue-next';
import valeService from '../services/valeService';
import { CONTAS } from '../utils/contasCaixa';

const hoje = () => new Date().toLocaleDateString('en-CA');

const vales = ref([]);
const loading = ref(true);
const totalItems = ref(0);
const totalPages = ref(1);
const currentPage = ref(1);
const emAberto = ref(0);
const qtdAberto = ref(0);
const filtros = reactive({ texto: '', status: 'Aberto' });

const novo = reactive({ visible: false, pessoa: '', valor: '', conta: 'Dinheiro', data: hoje(), descricao: '', erro: '', salvando: false });
const baixa = reactive({ visible: false, item: null, conta: 'Dinheiro', data: hoje(), erro: '', salvando: false });

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

const abrirNovo = () => Object.assign(novo, { visible: true, pessoa: '', valor: '', conta: 'Dinheiro', data: hoje(), descricao: '', erro: '' });

const salvarNovo = async () => {
  if (!novo.pessoa.trim() || !(Number(novo.valor) > 0)) { novo.erro = 'Informe a pessoa e um valor maior que zero.'; return; }
  novo.salvando = true;
  novo.erro = '';
  try {
    await valeService.create({ pessoa: novo.pessoa, valor: Number(novo.valor), conta: novo.conta, data: novo.data, descricao: novo.descricao });
    novo.visible = false;
    await carregar();
  } catch (e) {
    novo.erro = e.response?.data?.error || 'Não foi possível criar o vale.';
  } finally { novo.salvando = false; }
};

const abrirBaixa = (item) => Object.assign(baixa, { visible: true, item, conta: item.conta, data: hoje(), erro: '' });

const confirmarBaixa = async () => {
  baixa.salvando = true;
  baixa.erro = '';
  try {
    await valeService.baixar(baixa.item.id, { conta: baixa.conta, data: baixa.data });
    baixa.visible = false;
    await carregar();
  } catch (e) {
    baixa.erro = e.response?.data?.error || 'Não foi possível dar baixa.';
  } finally { baixa.salvando = false; }
};

const nomeConta = (id) => CONTAS.find(c => c.id === id)?.nome || id;
const formatMoney = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const formatDate = (d) => d ? d.split('-').reverse().join('/') : '-';
</script>

<template>
  <DashboardLayout>
    <div v-if="novo.visible" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="novo.visible = false"></div>
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 p-6">
        <div class="flex justify-between items-center mb-5">
          <h3 class="text-lg font-semibold text-slate-900">Novo vale</h3>
          <button @click="novo.visible = false" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"><X class="w-5 h-5" /></button>
        </div>
        <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Para quem</label>
        <input v-model="novo.pessoa" maxlength="100" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm mb-3 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" />
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Valor</label>
            <input v-model="novo.valor" type="number" min="0.01" step="0.01" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" />
          </div>
          <div>
            <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Data</label>
            <input v-model="novo.data" type="date" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" />
          </div>
        </div>
        <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Sai de qual conta</label>
        <select v-model="novo.conta" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm mb-3 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow">
          <option v-for="c in CONTAS" :key="c.id" :value="c.id">{{ c.nome }}</option>
        </select>
        <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Observação (opcional)</label>
        <input v-model="novo.descricao" maxlength="200" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm mb-2 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" />
        <p class="text-xs text-slate-500 mb-2">O valor sai do caixa ({{ nomeConta(novo.conta) }}) na hora.</p>
        <p v-if="novo.erro" class="text-xs text-red-600 font-medium mb-2">{{ novo.erro }}</p>
        <div class="flex gap-3 mt-4">
          <button @click="novo.visible = false" class="flex-1 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg shadow-xs hover:bg-slate-50 text-sm">Cancelar</button>
          <button @click="salvarNovo" :disabled="novo.salvando" class="flex-1 px-4 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg shadow-xs hover:bg-indigo-700 disabled:opacity-60 text-sm">
            {{ novo.salvando ? 'Salvando...' : 'Criar vale' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="baixa.visible" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="baixa.visible = false"></div>
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 p-6">
        <h3 class="text-lg font-semibold text-slate-900 mb-4">Dar baixa no vale</h3>
        <div class="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 text-sm flex justify-between">
          <span class="font-semibold text-slate-800">{{ baixa.item.pessoa }}</span>
          <span class="font-semibold text-emerald-600 tabular-nums">{{ formatMoney(baixa.item.valor) }}</span>
        </div>
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Entra em qual conta</label>
            <select v-model="baixa.conta" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow">
              <option v-for="c in CONTAS" :key="c.id" :value="c.id">{{ c.nome }}</option>
            </select>
          </div>
          <div>
            <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Data</label>
            <input v-model="baixa.data" type="date" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" />
          </div>
        </div>
        <p class="text-xs text-slate-500 mb-2">O valor volta para o caixa ({{ nomeConta(baixa.conta) }}).</p>
        <p v-if="baixa.erro" class="text-xs text-red-600 font-medium mb-2">{{ baixa.erro }}</p>
        <div class="flex gap-3 mt-4">
          <button @click="baixa.visible = false" class="flex-1 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg shadow-xs hover:bg-slate-50 text-sm">Cancelar</button>
          <button @click="confirmarBaixa" :disabled="baixa.salvando" class="flex-1 px-4 py-2.5 bg-emerald-600 text-white font-semibold rounded-lg shadow-xs hover:bg-emerald-700 disabled:opacity-60 text-sm">
            {{ baixa.salvando ? 'Salvando...' : 'Confirmar baixa' }}
          </button>
        </div>
      </div>
    </div>

    <div class="flex flex-col md:flex-row justify-between items-start md:items-end mb-7 gap-4">
      <div>
        <h1 class="text-2xl font-semibold text-slate-900 tracking-tight">Vales</h1>
        <p class="text-slate-500 text-sm mt-1">Adiantamentos que saem do caixa e voltam na baixa.</p>
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

    <div class="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
      <div class="p-4 border-b border-slate-200 flex flex-col md:flex-row gap-3">
        <input v-model="filtros.texto" type="text" placeholder="Buscar pessoa..." class="w-full md:w-64 px-3 py-2 border rounded-lg text-sm outline-none border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" />
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
              <th class="px-4 py-2.5">Pessoa</th>
              <th class="px-4 py-2.5">Saiu de</th>
              <th class="px-4 py-2.5 text-right">Valor</th>
              <th class="px-4 py-2.5">Situação</th>
              <th class="px-4 py-2.5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="loading"><td colspan="6" class="px-6 py-10 text-center"><Loader2 class="w-6 h-6 animate-spin mx-auto" /></td></tr>
            <tr v-else-if="!vales.length"><td colspan="6" class="px-6 py-10 text-center text-slate-400">Nenhum vale.</td></tr>
            <tr v-for="v in vales" v-show="!loading" :key="v.id" class="hover:bg-slate-50">
              <td class="px-4 py-2.5 text-slate-500 tabular-nums text-[13px] whitespace-nowrap">{{ formatDate(v.data) }}</td>
              <td class="px-4 py-2.5 font-medium text-slate-800">
                {{ v.pessoa }}
                <div v-if="v.descricao" class="text-xs text-slate-400">{{ v.descricao }}</div>
              </td>
              <td class="px-4 py-2.5 text-xs text-slate-600">{{ nomeConta(v.conta) }}</td>
              <td class="px-4 py-2.5 text-right font-semibold text-slate-900 tabular-nums">{{ formatMoney(v.valor) }}</td>
              <td class="px-4 py-2.5">
                <span v-if="v.status === 'Pago'" class="px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Pago {{ formatDate(v.data_pagamento) }} · {{ nomeConta(v.conta_pagamento) }}
                </span>
                <span v-else class="px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">Em aberto</span>
              </td>
              <td class="px-4 py-2.5 text-right">
                <button v-if="v.status === 'Aberto'" @click="abrirBaixa(v)" class="inline-flex items-center gap-1.5 h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors">
                  <CheckCircle2 class="w-4 h-4" /> Dar baixa
                </button>
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
