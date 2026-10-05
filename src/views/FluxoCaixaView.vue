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
  // um recebimento dividido = linhas do mesmo cheque, no mesmo dia, com "(Parte i/n)".
  // Com imposto a parte pode ter 2 linhas (imposto + titulo), entao nao da para contar
  // linhas: o grupo esta completo quando aparecem as partes 1..n.
  const grupos = {};
  const linhasFinais = lancamentos.value.map((l) => {
    const info = l.check_id ? RX_PARTE.exec(l.descricao || '') : null;
    if (!info) return { ...l, descricaoLimpa: l.descricao, parte: 0 };
    const linha = {
      ...l,
      descricaoLimpa: (l.descricao || '').replace(RX_PARTE, ''),
      parte: Number(info[1]),
      partes: Number(info[2]),
      forma: info[3] || '',
      grupo: `${l.check_id}|${l.data}|${info[2]}`
    };
    (grupos[linha.grupo] ||= []).push(linha);
    return linha;
  });

  for (const grupo of Object.values(grupos)) {
    const completo = new Set(grupo.map(l => l.parte)).size === grupo[0].partes;
    const totalCheque = completo ? grupo.reduce((t, x) => t + Math.abs(x.valor || 0), 0) : 0;
    for (const l of grupo) {
      l.totalCheque = totalCheque;
      l.pct = totalCheque ? (Math.abs(l.valor || 0) / totalCheque) * 100 : 0;
    }
    // a lista vem do mais novo para o mais velho (id desc), o que colocava a parte 2
    // acima da parte 1. Dentro do bloco, reordena para ler 1, 2, 3...
    const posicoes = grupo.map(l => linhasFinais.indexOf(l)).sort((a, b) => a - b);
    const ordenadas = [...grupo].sort((a, b) => a.parte - b.parte);
    posicoes.forEach((pos, i) => { linhasFinais[pos] = ordenadas[i]; });
  }

  // a data aparece so na primeira linha de cada bloco
  const vistos = new Set();
  for (const l of linhasFinais) {
    if (!l.parte) continue;
    l.primeiraDoGrupo = !vistos.has(l.grupo);
    vistos.add(l.grupo);
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
        <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 text-red-600 mb-4">
          <AlertTriangle class="h-6 w-6" />
        </div>
        <h3 class="text-lg font-semibold text-slate-900 mb-1 text-center">Apagar lançamento do caixa</h3>
        <p class="text-slate-500 mb-4 text-sm leading-relaxed text-center">
          O saldo muda na hora e <strong class="text-slate-700">não há como desfazer</strong>.
        </p>

        <div v-if="confirmModal.item" class="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 text-sm">
          <div class="font-semibold text-slate-800">{{ confirmModal.item.descricao }}</div>
          <div class="flex justify-between mt-1 text-slate-500 text-xs">
            <span>{{ formatDate(confirmModal.item.data) }} · {{ confirmModal.item.origem }}</span>
            <span class="font-semibold tabular-nums" :class="confirmModal.item.tipo === 'entrada' ? 'text-emerald-600' : 'text-red-600'">
              {{ confirmModal.item.tipo === 'entrada' ? '+' : '-' }} {{ formatMoney(confirmModal.item.valor) }}
            </span>
          </div>
        </div>

        <p v-if="vinculoDoLancamento" class="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
          <AlertTriangle class="w-4 h-4 mt-0.5 shrink-0" /> {{ vinculoDoLancamento }}
        </p>

        <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Sua senha</label>
        <input
          v-model="confirmModal.senha"
          type="password"
          autocomplete="current-password"
          placeholder="Digite sua senha para confirmar"
          class="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg outline-none text-sm mb-2 focus:border-red-500 focus:ring-4 focus:ring-red-500/15 shadow-xs transition-shadow"
          @keyup.enter="confirmarExclusao"
        />
        <p v-if="confirmModal.erro" class="text-xs text-red-600 font-medium mb-2">{{ confirmModal.erro }}</p>

        <div class="flex gap-3 mt-4">
          <button @click="confirmModal.visible = false" class="flex-1 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg shadow-xs hover:bg-slate-50 transition-colors text-sm">
            Cancelar
          </button>
          <button @click="confirmarExclusao" :disabled="confirmModal.salvando"
                  class="flex-1 px-4 py-2.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors shadow-xs text-sm">
            {{ confirmModal.salvando ? 'Apagando...' : 'Sim, apagar' }}
          </button>
        </div>
      </div>
    </div>

    <div class="flex flex-col md:flex-row justify-between items-start md:items-end mb-7 gap-4">
      <div>
        <h1 class="text-2xl font-semibold text-slate-900 tracking-tight">Fluxo de Caixa</h1>
        <p class="text-slate-500 text-sm mt-1">Saldos por conta, dinheiro na rua e lançamentos.</p>
      </div>
      <div class="flex gap-2.5">
        <button @click="showConfigModal = true" class="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 h-9 px-3.5 rounded-lg text-sm font-semibold shadow-xs flex items-center gap-2 transition-colors">
          <Settings class="w-4 h-4 text-slate-500" /> Capital social
        </button>
        <button @click="abrirModalNovo" class="bg-indigo-600 hover:bg-indigo-700 text-white h-9 px-3.5 rounded-lg text-sm font-semibold shadow-xs ring-1 ring-inset ring-white/10 flex items-center transition-all active:scale-[0.98]">
          <Plus class="w-4 h-4 mr-2" /> Lançamento
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200/80">
        <div class="flex items-center gap-3 mb-4"><span class="w-9 h-9 rounded-lg bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200 flex items-center justify-center"><Building class="w-[18px] h-[18px]" /></span><div class="leading-tight"><div class="text-sm font-semibold text-slate-900">Saldo atual</div><div class="text-xs text-slate-500">no caixa, por conta</div></div></div>
        <div class="space-y-2">
          <div class="flex justify-between items-center text-sm"><span class="flex items-center gap-2 text-slate-600"><span class="w-2 h-2 rounded-full bg-blue-500"></span>BB</span><span class="font-semibold text-slate-800 tabular-nums">{{ formatMoney(saldos.bruto.bb_total) }}</span></div>
          <div class="flex justify-between items-center text-sm"><span class="flex items-center gap-2 text-slate-600"><span class="w-2 h-2 rounded-full bg-sky-400"></span>Caixa</span><span class="font-semibold text-slate-800 tabular-nums">{{ formatMoney(saldos.bruto.caixa_total) }}</span></div>
          <div class="flex justify-between items-center text-sm"><span class="flex items-center gap-2 text-slate-600"><span class="w-2 h-2 rounded-full bg-emerald-500"></span>Dinheiro</span><span class="font-semibold text-slate-800 tabular-nums">{{ formatMoney(saldos.bruto.dinheiro_total) }}</span></div>
          <div class="flex justify-between items-center border-t border-slate-100 pt-3 mt-1"><span class="text-sm font-medium text-slate-500">Total no caixa</span><span class="text-base font-semibold text-slate-900 tracking-tight tabular-nums">{{ formatMoney(totalBrutoGeral) }}</span></div>
        </div>
      </div>

      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200/80">
        <div class="flex items-center gap-3 mb-4"><span class="w-9 h-9 rounded-lg bg-red-50 text-red-600 ring-1 ring-inset ring-red-100 flex items-center justify-center"><ArrowDownCircle class="w-[18px] h-[18px]" /></span><div class="leading-tight"><div class="text-sm font-semibold text-slate-900">Emprestado</div><div class="text-xs text-slate-500">na rua, por origem</div></div></div>
        <div class="space-y-2">
          <div class="flex justify-between items-center text-sm"><span class="flex items-center gap-2 text-slate-600"><span class="w-2 h-2 rounded-full bg-blue-500"></span>Origem BB</span><span class="font-semibold text-red-600 tabular-nums">{{ formatMoney(saldos.na_rua.BRASIL) }}</span></div>
          <div class="flex justify-between items-center text-sm"><span class="flex items-center gap-2 text-slate-600"><span class="w-2 h-2 rounded-full bg-sky-400"></span>Origem Caixa</span><span class="font-semibold text-red-600 tabular-nums">{{ formatMoney(saldos.na_rua.CAIXA) }}</span></div>
          <div class="flex justify-between items-center text-sm"><span class="flex items-center gap-2 text-slate-600"><span class="w-2 h-2 rounded-full bg-emerald-500"></span>Origem Dinheiro</span><span class="font-semibold text-red-600 tabular-nums">{{ formatMoney(saldos.na_rua.DINHEIRO) }}</span></div>
          <div class="flex justify-between items-center border-t border-slate-100 pt-3 mt-1"><span class="text-sm font-medium text-slate-500">Total emprestado</span><span class="text-base font-semibold text-red-700 tracking-tight tabular-nums">{{ formatMoney(totalEmprestadoGeral) }}</span></div>
        </div>
      </div>

      <div class="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-xl shadow-md ring-1 ring-slate-900/5 relative overflow-hidden flex flex-col">
        <div class="flex items-center gap-3 mb-4"><span class="w-9 h-9 rounded-lg bg-white/10 text-emerald-300 ring-1 ring-inset ring-white/10 flex items-center justify-center"><Banknote class="w-[18px] h-[18px]" /></span><div class="leading-tight"><div class="text-sm font-semibold">Patrimônio total</div><div class="text-xs text-slate-400">caixa + emprestado</div></div></div>
        <div class="text-3xl font-semibold tracking-tight tabular-nums">{{ formatMoney(patrimonioAtual) }}</div>
        <div class="mt-auto pt-4 flex justify-between items-end border-t border-white/10">
          <div><span class="text-xs block text-slate-400">Investido</span><span class="text-sm font-semibold tabular-nums">{{ formatMoney(capitalTotal) }}</span></div>
          <div class="text-right">
            <span class="text-xs block text-slate-400 mb-0.5">Crescimento</span>
            <span class="text-sm font-semibold bg-emerald-400/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/20 px-2 py-0.5 rounded-md tabular-nums">{{ porcentagemCrescimento > 0 ? '+' : '' }}{{ porcentagemCrescimento.toFixed(1) }}%</span>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
      <div class="p-4 border-b border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div class="flex gap-3 w-full md:w-auto">
          <input v-model="filtros.texto" type="text" placeholder="Buscar histórico..." class="w-full md:w-64 px-3 py-2 border rounded-lg text-sm outline-none border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" />
          <input v-model="filtros.data" type="date" class="px-3 py-2 border rounded-lg text-sm outline-none border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" />
        </div>
        <div v-if="!loading" class="flex gap-5 text-sm">
          <div class="text-slate-500">Entradas <span class="ml-1 font-semibold text-emerald-600 tabular-nums">{{ formatMoney(resumoFiltro.entradas) }}</span></div>
          <div class="text-slate-500">Saídas <span class="ml-1 font-semibold text-red-600 tabular-nums">{{ formatMoney(resumoFiltro.saidas) }}</span></div>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-50/80 text-slate-500 text-xs font-medium border-b border-slate-200">
            <tr>
              <th class="px-4 py-2.5">Data</th>
              <th class="px-4 py-2.5">Descrição</th>
              <th class="px-4 py-2.5">Conta</th>
              <th class="px-4 py-2.5 text-right">Entrada</th>
              <th class="px-4 py-2.5 text-right">Saída</th>
              <th class="px-4 py-2.5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="loading"><td colspan="6" class="px-6 py-10 text-center"><Loader2 class="w-6 h-6 animate-spin mx-auto"/></td></tr>
            <tr v-for="item in linhas" :key="item.id"
                class="hover:bg-slate-50 transition-colors"
                :class="item.parte ? 'bg-indigo-50/40' : ''">
              <td class="px-4 py-2.5 text-slate-500 tabular-nums text-[13px] whitespace-nowrap"
                  :class="item.parte ? 'border-l-[3px] border-indigo-400' : ''">
                {{ item.parte && !item.primeiraDoGrupo ? '' : formatDate(item.data) }}
              </td>
              <td class="px-4 py-2.5 font-medium text-slate-800">
                <div class="flex items-center gap-2">
                  <Link2 v-if="item.parte" class="w-3.5 h-3.5 text-indigo-400 flex-shrink-0"
                         title="Parte de um recebimento dividido (mesmo cheque)" />
                  <span>{{ item.descricaoLimpa }}</span>
                </div>
                <div v-if="item.parte" class="mt-1 flex items-center gap-2 text-[11px] font-medium">
                  <span class="px-1.5 py-px rounded-md bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100">
                    Parte {{ item.parte }}/{{ item.partes }}
                  </span>
                  <span v-if="item.forma && item.forma !== item.origem" class="text-slate-500">{{ item.forma }}</span>
                  <span v-if="item.pct" class="text-slate-400">
                    {{ formatPct(item.pct) }} do cheque{{ item.totalCheque ? ' de ' + formatMoney(item.totalCheque) : '' }}
                  </span>
                </div>
              </td>
              <td class="px-4 py-2.5">
                <span class="px-2 py-0.5 rounded-md text-[11px] font-medium border whitespace-nowrap"
                  :class="{
                    'bg-blue-50 text-blue-700 border-blue-200': (item.origem || '').toLowerCase().includes('brasil') || (item.origem || '').toLowerCase().includes('bb'),
                    'bg-sky-50 text-sky-700 border-sky-200': (item.origem || '').toLowerCase().includes('caixa') || (item.origem || '').toLowerCase().includes('ce'),
                    'bg-emerald-50 text-emerald-700 border-emerald-200': !(item.origem || '').toLowerCase().includes('brasil') && !(item.origem || '').toLowerCase().includes('caixa')
                  }">
                  {{ item.origem }}
                </span>
              </td>
              <td class="px-4 py-2.5 text-right text-emerald-600 font-semibold tabular-nums whitespace-nowrap">{{ item.tipo === 'entrada' ? formatMoney(item.valor) : '-' }}</td>
              <td class="px-4 py-2.5 text-right text-red-600 font-semibold tabular-nums whitespace-nowrap">{{ item.tipo === 'saida' ? formatMoney(item.valor) : '-' }}</td>
              <td class="px-4 py-2.5 text-right">
                <div class="flex justify-end gap-0.5">
                  <button @click="abrirModalEdicao(item)" title="Editar" class="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"><Edit2 class="w-4 h-4"/></button>
                  <button @click="excluirLancamento(item)" title="Apagar" class="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 class="w-4 h-4"/></button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="px-5 py-3 border-t border-slate-200 flex justify-between items-center">
        <span class="text-[13px] text-slate-500">
          Página {{ currentPage }} de {{ totalPages || 1 }} · {{ totalItems }} lançamento(s)
        </span>
        <div class="flex gap-2">
          <button @click="mudarPagina(currentPage - 1)" :disabled="currentPage === 1"
                  class="h-8 px-3 bg-white border border-slate-300 rounded-lg shadow-xs text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed">
            Anterior
          </button>
          <button @click="mudarPagina(currentPage + 1)" :disabled="currentPage >= totalPages"
                  class="h-8 px-3 bg-white border border-slate-300 rounded-lg shadow-xs text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed">
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