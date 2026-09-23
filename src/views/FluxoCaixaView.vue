<script setup>
import { ref, onMounted, reactive, watch, computed } from 'vue';
import DashboardLayout from '../layouts/DashboardLayout.vue';
import NovoLancamentoModal from '../components/FluxoCaixa/NovoLancamentoModal.vue';
import ConfiguracaoModal from '../components/FluxoCaixa/ConfiguracaoModal.vue';
import DetalhesLancamentoModal from '../components/FluxoCaixa/DetalhesLancamentoModal.vue';

import { 
  Building, Banknote, Plus, Trash2, Edit2, Settings, ArrowDownCircle,
  Loader2, TrendingUp, AlertTriangle, Link2
} from 'lucide-vue-next';

import transactionService from '../services/transactionService';

const showModal = ref(false);
const showConfigModal = ref(false);
const loading = ref(true);

const lancamentoEmEdicao = ref(null);
const lancamentoParaDetalhes = ref(null);

const lancamentos = ref([]);
const totalItems = ref(0);
const totalPages = ref(1);
const currentPage = ref(1);
const itemsPerPage = 40;

const resumoFiltro = ref({ entradas: 0, saidas: 0, resultado: 0 });

const saldos = ref({
  bruto: { bb_total: 0, caixa_total: 0, dinheiro_total: 0 },
  na_rua: { BRASIL: 0, CAIXA: 0, DINHEIRO: 0 }
}); 
const capitalTotal = ref(0); 

const filtros = reactive({ texto: '', data: '', tipo: 'todos' });

// Exclusao de lancamento: exige a senha de quem esta logado (o backend confere).
const confirmModal = reactive({
  visible: false,
  item: null,
  senha: '',
  erro: '',
  salvando: false
});

// CÁLCULOS
const totalBrutoGeral = computed(() => saldos.value.bruto.bb_total + saldos.value.bruto.caixa_total + saldos.value.bruto.dinheiro_total);
const totalEmprestadoGeral = computed(() => saldos.value.na_rua.BRASIL + saldos.value.na_rua.CAIXA + saldos.value.na_rua.DINHEIRO);
const patrimonioAtual = computed(() => totalBrutoGeral.value + totalEmprestadoGeral.value);
const porcentagemCrescimento = computed(() => {
  if (capitalTotal.value <= 0) return 0;
  return ((patrimonioAtual.value - capitalTotal.value) / capitalTotal.value) * 100;
});

const carregarTabela = async () => {
  loading.value = true;
  try {
    const params = { page: currentPage.value, per_page: itemsPerPage, search: filtros.texto, date: filtros.data, type: filtros.tipo };
    const res = await transactionService.getAll(params);
    lancamentos.value = res.items.filter(i => i.categoria !== 'Saldo Inicial');
    totalItems.value = res.total;
    totalPages.value = res.pages;
    if (res.summary) resumoFiltro.value = res.summary;
  } catch (error) { console.error(error); } finally { loading.value = false; }
};

const carregarSaldos = async () => {
  try {
    const resSaldos = await transactionService.getBalances();
    saldos.value.bruto = resSaldos.bruto;
    saldos.value.na_rua = resSaldos.na_rua;
    capitalTotal.value = resSaldos.capital_total; 
  } catch (e) { console.error(e); }
};

let timeoutSearch = null;
watch(() => filtros.texto, () => {
  clearTimeout(timeoutSearch);
  timeoutSearch = setTimeout(() => { currentPage.value = 1; carregarTabela(); }, 400);
});
watch([() => filtros.data, () => filtros.tipo], () => { currentPage.value = 1; carregarTabela(); });

const mudarPagina = (p) => { if (p >= 1 && p <= totalPages.value) { currentPage.value = p; carregarTabela(); } };

onMounted(() => { carregarTabela(); carregarSaldos(); });

const abrirModalNovo = () => { lancamentoEmEdicao.value = null; showModal.value = true; };
const abrirModalEdicao = (item) => { lancamentoEmEdicao.value = { ...item }; showModal.value = true; };

const salvarLancamento = async (dados) => {
  try {
    if (lancamentoEmEdicao.value?.id) await transactionService.update(lancamentoEmEdicao.value.id, dados);
    else await transactionService.create(dados);
    showModal.value = false;
    await carregarTabela();
    await carregarSaldos(); 
  } catch (error) { alert("Erro ao salvar."); }
};

const excluirLancamento = (item) => {
  confirmModal.item = item;
  confirmModal.senha = '';
  confirmModal.erro = '';
  confirmModal.visible = true;
};

// De onde a linha veio. Apagar uma baixa de cheque tira o dinheiro do caixa mas
// deixa o cheque como Pago - por isso o aviso aparece antes de confirmar.
const vinculoDoLancamento = computed(() => {
  const i = confirmModal.item;
  if (!i) return '';
  if (i.check_id) return 'Esta linha é a baixa de um cheque. Apagar tira o dinheiro do caixa, mas o cheque continua marcado como Pago.';
  if (i.operation_id) return 'Esta linha é o dinheiro emprestado em um borderô. Apagar tira a saída do caixa, mas o borderô continua lá.';
  return '';
});

const confirmarExclusao = async () => {
  if (!confirmModal.senha) { confirmModal.erro = 'Digite sua senha para confirmar.'; return; }
  confirmModal.salvando = true;
  confirmModal.erro = '';
  try {
    await transactionService.delete(confirmModal.item.id, confirmModal.senha);
    confirmModal.visible = false;
    confirmModal.senha = '';
    await carregarTabela();
    await carregarSaldos();
  } catch (error) {
    confirmModal.erro = error.response?.data?.error || 'Não foi possível apagar o lançamento.';
  } finally {
    confirmModal.salvando = false;
  }
};

const formatMoney = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const formatDate = (d) => d ? d.split('-').reverse().join('/') : '-';
const formatPct = (p) => `${p % 1 === 0 ? p.toFixed(0) : p.toFixed(1)}%`;

// Recebimento dividido: o backend grava uma linha por parte e marca o rotulo
// "(Parte 1/2 · PIX)" na descricao. Aqui a linha vira: descricao limpa + etiqueta,
// e as partes do mesmo cheque (check_id) aparecem grudadas como um bloco.
const RX_PARTE = /\s*\(Parte (\d+)\/(\d+)(?: · ([^)]+))?\)\s*$/;

const linhas = computed(() => {
  const porCheque = {};
  for (const l of lancamentos.value) {
    if (l.check_id) (porCheque[l.check_id] ||= []).push(l);
  }

  const linhasFinais = lancamentos.value.map((l) => {
    const info = RX_PARTE.exec(l.descricao || '');
    if (!info) return { ...l, descricaoLimpa: l.descricao, parte: 0 };

    const grupo = porCheque[l.check_id] || [];
    const completo = grupo.length === Number(info[2]);
    const totalCheque = completo ? grupo.reduce((t, x) => t + Math.abs(x.valor || 0), 0) : 0;

    return {
      ...l,
      descricaoLimpa: (l.descricao || '').replace(RX_PARTE, ''),
      parte: Number(info[1]),
      partes: Number(info[2]),
      forma: info[3] || '',
      totalCheque,
      pct: totalCheque ? (Math.abs(l.valor || 0) / totalCheque) * 100 : 0,
      primeiraDoGrupo: completo && Number(info[1]) === 1
    };
  });

  // a lista vem do mais novo para o mais velho (id desc), o que colocava a parte 2
  // acima da parte 1. Dentro do bloco do mesmo cheque, inverte para ler 1, 2, 3...
  for (const grupo of Object.values(porCheque)) {
    if (grupo.length < 2) continue;
    const posicoes = grupo
      .map(l => linhasFinais.findIndex(x => x.id === l.id))
      .sort((a, b) => a - b);
    const ordenadas = posicoes.map(i => linhasFinais[i]).sort((a, b) => a.parte - b.parte);
    posicoes.forEach((pos, i) => { linhasFinais[pos] = ordenadas[i]; });
  }

  return linhasFinais;
});
</script>

<template>
  <DashboardLayout>
    <NovoLancamentoModal v-if="showModal" :lancamento="lancamentoEmEdicao" @close="showModal = false" @save="salvarLancamento" />
    <ConfiguracaoModal v-if="showConfigModal" @close="showConfigModal = false" @save="carregarSaldos" />
    <DetalhesLancamentoModal v-if="lancamentoParaDetalhes" :lancamento="lancamentoParaDetalhes" @close="lancamentoParaDetalhes = null" />

    <div v-if="confirmModal.visible" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="confirmModal.visible = false"></div>
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 p-6 animate-scale-in">
        <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 text-red-600 mb-5">
          <AlertTriangle class="h-8 w-8" />
        </div>
        <h3 class="text-xl font-bold text-slate-900 mb-2 text-center">Apagar lançamento do caixa</h3>
        <p class="text-slate-500 mb-4 text-sm leading-relaxed text-center">
          O saldo muda na hora e <strong class="text-slate-700">não há como desfazer</strong>.
        </p>

        <div v-if="confirmModal.item" class="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 text-sm">
          <div class="font-bold text-slate-800">{{ confirmModal.item.descricao }}</div>
          <div class="flex justify-between mt-1 text-slate-500 text-xs">
            <span>{{ formatDate(confirmModal.item.data) }} · {{ confirmModal.item.origem }}</span>
            <span class="font-bold" :class="confirmModal.item.tipo === 'entrada' ? 'text-emerald-600' : 'text-red-600'">
              {{ confirmModal.item.tipo === 'entrada' ? '+' : '-' }} {{ formatMoney(confirmModal.item.valor) }}
            </span>
          </div>
        </div>

        <p v-if="vinculoDoLancamento" class="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
          <AlertTriangle class="w-4 h-4 mt-0.5 shrink-0" /> {{ vinculoDoLancamento }}
        </p>

        <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Sua senha</label>
        <input
          v-model="confirmModal.senha"
          type="password"
          autocomplete="current-password"
          placeholder="Digite sua senha para confirmar"
          class="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 text-sm mb-2"
          @keyup.enter="confirmarExclusao"
        />
        <p v-if="confirmModal.erro" class="text-xs text-red-600 font-bold mb-2">{{ confirmModal.erro }}</p>

        <div class="flex gap-3 mt-4">
          <button @click="confirmModal.visible = false" class="flex-1 px-4 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm">
            Cancelar
          </button>
          <button @click="confirmarExclusao" :disabled="confirmModal.salvando"
                  class="flex-1 px-4 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 disabled:opacity-60 transition-colors shadow-lg shadow-red-200 text-sm">
            {{ confirmModal.salvando ? 'Apagando...' : 'Sim, apagar' }}
          </button>
        </div>
      </div>
    </div>

    <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
      <h1 class="text-3xl font-bold text-slate-900">Fluxo de Caixa</h1>
      <div class="flex gap-3">
        <button @click="showConfigModal = true" class="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg transition-colors flex items-center gap-1">
          <Settings class="w-4 h-4" /> Capital Social
        </button>
        <button @click="abrirModalNovo" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-bold shadow-md flex items-center text-sm transition-transform active:scale-95">
          <Plus class="w-4 h-4 mr-2" /> Lançamento
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <div class="flex items-center gap-3 mb-4 text-slate-700"><Building class="w-5 h-5" /> <span class="text-xs font-bold uppercase tracking-wider">Saldo Atual (No Caixa)</span></div>
        <div class="space-y-2">
          <div class="flex justify-between items-center"><span class="text-xs text-blue-600 font-bold uppercase">BB</span><span class="text-sm font-bold text-slate-700">{{ formatMoney(saldos.bruto.bb_total) }}</span></div>
          <div class="flex justify-between items-center"><span class="text-xs text-sky-500 font-bold uppercase">Caixa</span><span class="text-sm font-bold text-slate-700">{{ formatMoney(saldos.bruto.caixa_total) }}</span></div>
          <div class="flex justify-between items-center border-t border-slate-100 pt-2 mt-1"><span class="text-xs text-emerald-600 font-bold uppercase">Dinheiro</span><span class="text-sm font-bold text-slate-700">{{ formatMoney(saldos.bruto.dinheiro_total) }}</span></div>
          <div class="flex justify-between items-center pt-1 font-black text-slate-900 uppercase text-[10px]"><span>Total Caixa:</span><span>{{ formatMoney(totalBrutoGeral) }}</span></div>
        </div>
      </div>

      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <div class="flex items-center gap-3 mb-4 text-red-600"><ArrowDownCircle class="w-5 h-5" /> <span class="text-xs font-bold uppercase tracking-wider">Emprestado (Na Rua)</span></div>
        <div class="space-y-2">
          <div class="flex justify-between items-center"><span class="text-xs text-slate-500 font-bold uppercase">Origem BB</span><span class="text-sm font-bold text-red-600">{{ formatMoney(saldos.na_rua.BRASIL) }}</span></div>
          <div class="flex justify-between items-center"><span class="text-xs text-slate-500 font-bold uppercase">Origem Caixa</span><span class="text-sm font-bold text-red-600">{{ formatMoney(saldos.na_rua.CAIXA) }}</span></div>
          <div class="flex justify-between items-center border-t border-slate-100 pt-2 mt-1"><span class="text-xs text-slate-500 font-bold uppercase">Origem Dinheiro</span><span class="text-sm font-bold text-red-600">{{ formatMoney(saldos.na_rua.DINHEIRO) }}</span></div>
          <div class="flex justify-between items-center pt-1 font-black text-red-800 uppercase text-[10px]"><span>Total:</span><span>{{ formatMoney(totalEmprestadoGeral) }}</span></div>
        </div>
      </div>

      <div class="bg-emerald-600 text-white p-5 rounded-xl shadow-lg relative overflow-hidden">
        <div class="absolute right-0 top-0 opacity-10 transform translate-x-4 -translate-y-4"><TrendingUp class="w-24 h-24" /></div>
        <div class="flex items-center gap-3 mb-2 opacity-90"><Banknote class="w-5 h-5" /> <span class="text-xs font-bold uppercase tracking-wider">Patrimônio Total</span></div>
        <div class="text-3xl font-black tracking-tight">{{ formatMoney(patrimonioAtual) }}</div>
        <div class="mt-4 flex justify-between items-end border-t border-emerald-500 pt-3">
          <div><span class="text-[10px] block opacity-70 uppercase font-bold text-emerald-100">Investido</span><span class="text-sm font-bold">{{ formatMoney(capitalTotal) }}</span></div>
          <div class="text-right">
            <span class="text-[10px] block opacity-70 uppercase font-bold text-emerald-100">Crescimento</span>
            <span class="text-sm font-bold bg-white/20 px-2 py-0.5 rounded-full">{{ porcentagemCrescimento > 0 ? '+' : '' }}{{ porcentagemCrescimento.toFixed(1) }}%</span>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div class="p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div class="flex gap-3 w-full md:w-auto">
          <input v-model="filtros.texto" type="text" placeholder="Buscar histórico..." class="w-full md:w-64 px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
          <input v-model="filtros.data" type="date" class="px-3 py-2 border rounded-lg text-sm outline-none" />
        </div>
        <div v-if="!loading" class="flex gap-4 text-sm font-bold">
          <div class="text-emerald-600 uppercase text-[10px] tracking-widest">Entradas: <span class="text-sm">{{ formatMoney(resumoFiltro.entradas) }}</span></div>
          <div class="text-red-600 uppercase text-[10px] tracking-widest">Saídas: <span class="text-sm">{{ formatMoney(resumoFiltro.saidas) }}</span></div>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
            <tr>
              <th class="px-6 py-4">Data</th>
              <th class="px-6 py-4">Descrição</th>
              <th class="px-6 py-4">Conta</th>
              <th class="px-6 py-4 text-right">Entrada</th>
              <th class="px-6 py-4 text-right">Saída</th>
              <th class="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="loading"><td colspan="6" class="px-6 py-10 text-center"><Loader2 class="w-6 h-6 animate-spin mx-auto"/></td></tr>
            <tr v-for="item in linhas" :key="item.id"
                class="hover:bg-slate-50 transition-colors"
                :class="item.parte ? 'bg-indigo-50/40' : ''">
              <td class="px-6 py-4 text-slate-500 font-mono text-xs"
                  :class="item.parte ? 'border-l-[3px] border-indigo-400' : ''">
                {{ item.parte && !item.primeiraDoGrupo ? '' : formatDate(item.data) }}
              </td>
              <td class="px-6 py-4 font-medium text-slate-800">
                <div class="flex items-center gap-2">
                  <Link2 v-if="item.parte" class="w-3.5 h-3.5 text-indigo-400 flex-shrink-0"
                         title="Parte de um recebimento dividido (mesmo cheque)" />
                  <span>{{ item.descricaoLimpa }}</span>
                </div>
                <div v-if="item.parte" class="mt-1 flex items-center gap-2 text-[10px] font-bold">
                  <span class="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 uppercase tracking-tight">
                    Parte {{ item.parte }}/{{ item.partes }}
                  </span>
                  <span v-if="item.forma && item.forma !== item.origem" class="text-slate-500 uppercase">{{ item.forma }}</span>
                  <span v-if="item.pct" class="text-slate-400">
                    {{ formatPct(item.pct) }} do cheque{{ item.totalCheque ? ' de ' + formatMoney(item.totalCheque) : '' }}
                  </span>
                </div>
              </td>
              <td class="px-6 py-4">
                <span class="px-3 py-1 rounded text-[10px] font-bold border uppercase tracking-tighter whitespace-nowrap"
                  :class="{
                    'bg-blue-50 text-blue-700 border-blue-100': (item.origem || '').toLowerCase().includes('brasil') || (item.origem || '').toLowerCase().includes('bb'),
                    'bg-sky-50 text-sky-700 border-sky-100': (item.origem || '').toLowerCase().includes('caixa') || (item.origem || '').toLowerCase().includes('ce'),
                    'bg-emerald-50 text-emerald-700 border-emerald-100': !(item.origem || '').toLowerCase().includes('brasil') && !(item.origem || '').toLowerCase().includes('caixa')
                  }">
                  {{ item.origem }}
                </span>
              </td>
              <td class="px-6 py-4 text-right text-emerald-600 font-bold">{{ item.tipo === 'entrada' ? formatMoney(item.valor) : '-' }}</td>
              <td class="px-6 py-4 text-right text-red-600 font-bold">{{ item.tipo === 'saida' ? formatMoney(item.valor) : '-' }}</td>
              <td class="px-6 py-4 text-right">
                <div class="flex justify-end gap-2 opacity-40 hover:opacity-100 transition-opacity">
                  <button @click="abrirModalEdicao(item)" class="p-1 hover:text-indigo-600"><Edit2 class="w-4 h-4"/></button>
                  <button @click="excluirLancamento(item)" class="p-1 hover:text-red-600"><Trash2 class="w-4 h-4"/></button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
        <span class="text-xs text-slate-500 font-bold">
          Página {{ currentPage }} de {{ totalPages || 1 }} · {{ totalItems }} lançamento(s)
        </span>
        <div class="flex gap-2">
          <button @click="mudarPagina(currentPage - 1)" :disabled="currentPage === 1"
                  class="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed">
            Anterior
          </button>
          <button @click="mudarPagina(currentPage + 1)" :disabled="currentPage >= totalPages"
                  class="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed">
            Próxima
          </button>
        </div>
      </div>
    </div>
  </DashboardLayout>
</template>

<style scoped>
.animate-scale-in { animation: scaleIn 0.2s ease-out; }
@keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
</style>