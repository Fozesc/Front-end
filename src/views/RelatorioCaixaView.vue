<script setup>
import { ref, reactive, watch, onMounted, computed } from 'vue';
import DashboardLayout from '../layouts/DashboardLayout.vue';
import { FileDown, Loader2, AlertTriangle, Wallet, ArrowDownLeft, ArrowUpRight, Scale, ChevronLeft, ChevronRight } from 'lucide-vue-next';
import api from '../services/api';
import { CONTAS, ESTILO } from '../utils/contasCaixa';
import { baixarRelatorioCaixaPdf } from '../utils/relatorioCaixaPdf';

const POR_PAGINA = 100;
const LIMITE_PDF = 10000;

const iso = (d) => d.toLocaleDateString('en-CA');
const hoje = new Date();
const atalhos = [
  { rotulo: 'Este mês', de: () => iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), ate: () => iso(hoje) },
  { rotulo: 'Mês passado', de: () => iso(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)), ate: () => iso(new Date(hoje.getFullYear(), hoje.getMonth(), 0)) },
  { rotulo: 'Últimos 30 dias', de: () => iso(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 30)), ate: () => iso(hoje) },
  { rotulo: 'Este ano', de: () => iso(new Date(hoje.getFullYear(), 0, 1)), ate: () => iso(hoje) },
  { rotulo: 'Tudo', de: () => '', ate: () => '' },
];
const OPCOES_CONTA = [{ id: 'todas', nome: 'Todas as contas', curto: 'Todas', icone: Wallet }, ...CONTAS.map(c => ({ ...c, id: c.id.toLowerCase() }))];

const filtro = reactive({ inicio: atalhos[0].de(), fim: atalhos[0].ate(), conta: 'todas', tipo: 'todos' });
const pagina = ref(1);
const dados = ref(null);
const carregando = ref(false);
const erro = ref('');
const gerandoPdf = ref(false);

const carregar = async () => {
  carregando.value = true;
  erro.value = '';
  try {
    const { data } = await api.get('/reports/caixa', { params: { ...filtro, page: pagina.value, per_page: POR_PAGINA } });
    dados.value = data;
  } catch (e) {
    erro.value = e.response?.data?.error || 'Não foi possível gerar o relatório.';
  } finally {
    carregando.value = false;
  }
};

let espera = null;
watch(filtro, () => {
  clearTimeout(espera);
  espera = setTimeout(() => { pagina.value = 1; carregar(); }, 300);
});
watch(pagina, carregar);
onMounted(carregar);

const usarAtalho = (a) => { filtro.inicio = a.de(); filtro.fim = a.ate(); };
const atalhoAtivo = (a) => filtro.inicio === a.de() && filtro.fim === a.ate();

// o PDF leva o extrato inteiro do periodo (busca de 1000 em 1000)
const baixarPdf = async () => {
  if (!dados.value || gerandoPdf.value) return;
  if (dados.value.extrato.total > LIMITE_PDF) {
    erro.value = `O período tem ${dados.value.extrato.total} lançamentos: diminua o período para gerar o PDF (até ${LIMITE_PDF}).`;
    return;
  }
  gerandoPdf.value = true;
  erro.value = '';
  try {
    const itens = [];
    let base = null;
    for (let p = 1; ; p++) {
      const { data } = await api.get('/reports/caixa', { params: { ...filtro, page: p, per_page: 1000 } });
      base ||= data;
      itens.push(...data.extrato.items);
      if (p >= data.extrato.pages) break;
    }
    await baixarRelatorioCaixaPdf(base, itens);
  } catch (e) {
    console.error(e);
    erro.value = e.response?.data?.error || 'Não foi possível gerar o PDF.';
  } finally {
    gerandoPdf.value = false;
  }
};

const moeda = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const dataBR = (d) => (d ? d.split('-').reverse().join('/') : '');
const pct = (v, total) => (total > 0 ? Math.max((v / total) * 100, 2) : 0);
const totalCat = (lista) => lista.reduce((t, c) => t + c.total, 0);
const estiloChip = (origem) => {
  const o = (origem || '').toUpperCase();
  const e = o.includes('BB') || o.includes('BRASIL') ? ESTILO.BB : o.includes('CAIXA') ? ESTILO.Caixa : ESTILO.Dinheiro;
  return e.chip;
};
const tituloConta = computed(() => OPCOES_CONTA.find(c => c.id === filtro.conta)?.nome || 'Todas as contas');
const somaPorConta = (campo) => (dados.value?.por_conta || []).reduce((t, c) => t + c[campo], 0);

const rotulo = 'block text-[13px] font-medium text-slate-700 mb-1.5';
const campo = 'h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-xs outline-none transition-shadow focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15';
const segmento = (ativo) => ['flex-1 px-3 rounded-[5px] text-[13px] font-medium transition-colors whitespace-nowrap flex items-center justify-center gap-1.5',
  ativo ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800'];
</script>

<template>
  <DashboardLayout>
    <div class="space-y-4">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
          <h1 class="text-2xl font-semibold text-slate-900 tracking-tight">Relatório do Caixa</h1>
          <p class="text-slate-500 text-sm mt-0.5">Entradas e saídas de cada conta, com o extrato para rastrear cada lançamento.</p>
        </div>
        <button @click="baixarPdf" :disabled="!dados || gerandoPdf" data-campo="baixar-pdf"
                class="h-9 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-semibold shadow-xs flex items-center gap-2 disabled:opacity-60">
          <Loader2 v-if="gerandoPdf" class="w-4 h-4 animate-spin" /><FileDown v-else class="w-4 h-4" />
          {{ gerandoPdf ? 'Gerando PDF...' : 'Baixar PDF' }}
        </button>
      </div>

      <section class="bg-white border border-slate-200 rounded-lg shadow-xs p-5 space-y-4">
        <div class="flex flex-wrap items-end gap-3">
          <div>
            <span :class="rotulo">Período</span>
            <div class="flex items-center gap-2">
              <input type="date" v-model="filtro.inicio" aria-label="De" :class="[campo, 'w-40']" />
              <span class="text-slate-400 text-sm">a</span>
              <input type="date" v-model="filtro.fim" aria-label="Até" :class="[campo, 'w-40']" />
            </div>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <button v-for="a in atalhos" :key="a.rotulo" @click="usarAtalho(a)"
                    class="h-10 px-3 rounded-md border text-xs font-semibold transition-colors"
                    :class="atalhoAtivo(a) ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'">
              {{ a.rotulo }}
            </button>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4">
          <div>
            <span id="rel-conta" :class="rotulo">Conta</span>
            <div class="flex h-10 gap-0.5 p-0.5 rounded-md border border-slate-300 bg-slate-50" role="radiogroup" aria-labelledby="rel-conta">
              <button v-for="c in OPCOES_CONTA" :key="c.id" type="button" role="radio" :aria-checked="filtro.conta === c.id"
                      @click="filtro.conta = c.id" :class="segmento(filtro.conta === c.id)" :data-conta="c.id">
                <component :is="c.icone" class="w-3.5 h-3.5" /> {{ c.curto }}
              </button>
            </div>
          </div>
          <div>
            <span id="rel-tipo" :class="rotulo">Mostrar no extrato</span>
            <div class="flex h-10 gap-0.5 p-0.5 rounded-md border border-slate-300 bg-slate-50" role="radiogroup" aria-labelledby="rel-tipo">
              <button v-for="t in [{ id: 'todos', n: 'Tudo' }, { id: 'entrada', n: 'Só entradas' }, { id: 'saida', n: 'Só saídas' }]" :key="t.id"
                      type="button" role="radio" :aria-checked="filtro.tipo === t.id" @click="filtro.tipo = t.id" :class="segmento(filtro.tipo === t.id)">
                {{ t.n }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <div v-if="erro" class="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm font-medium flex items-center gap-2">
        <AlertTriangle class="w-4 h-4 flex-shrink-0" /> {{ erro }}
      </div>

      <div v-if="!dados && carregando" class="py-16"><Loader2 class="w-6 h-6 animate-spin mx-auto text-slate-400" /></div>

      <template v-if="dados">
        <div class="grid grid-cols-2 xl:grid-cols-4 gap-4" :class="carregando ? 'opacity-60' : ''">
          <div class="bg-white border border-slate-200 rounded-lg shadow-xs p-4">
            <div class="flex items-center gap-2 text-xs font-medium text-slate-500"><Scale class="w-4 h-4" /> Saldo anterior</div>
            <div class="mt-2 text-xl font-semibold tabular-nums" :class="dados.resumo.saldo_anterior < 0 ? 'text-red-600' : 'text-slate-900'">{{ moeda(dados.resumo.saldo_anterior) }}</div>
            <div class="text-[11px] text-slate-400">em {{ dataBR(dados.inicio) }}</div>
          </div>
          <div class="bg-white border border-slate-200 rounded-lg shadow-xs p-4">
            <div class="flex items-center gap-2 text-xs font-medium text-slate-500"><ArrowDownLeft class="w-4 h-4 text-emerald-500" /> Entradas</div>
            <div class="mt-2 text-xl font-semibold tabular-nums text-emerald-600" data-campo="rel-entradas">{{ moeda(dados.resumo.entradas) }}</div>
            <div class="text-[11px] text-slate-400">no período</div>
          </div>
          <div class="bg-white border border-slate-200 rounded-lg shadow-xs p-4">
            <div class="flex items-center gap-2 text-xs font-medium text-slate-500"><ArrowUpRight class="w-4 h-4 text-red-500" /> Saídas</div>
            <div class="mt-2 text-xl font-semibold tabular-nums text-red-600" data-campo="rel-saidas">− {{ moeda(dados.resumo.saidas) }}</div>
            <div class="text-[11px] text-slate-400">{{ dados.resumo.qtd }} lançamento(s) no período</div>
          </div>
          <div class="bg-slate-900 rounded-lg shadow-xs p-4">
            <div class="flex items-center gap-2 text-xs font-medium text-slate-400"><Wallet class="w-4 h-4" /> Saldo final · {{ tituloConta }}</div>
            <div class="mt-2 text-xl font-semibold tabular-nums" :class="dados.resumo.saldo_final < 0 ? 'text-red-300' : 'text-white'" data-campo="rel-saldo-final">{{ moeda(dados.resumo.saldo_final) }}</div>
            <div class="text-[11px] text-slate-400">em {{ dataBR(dados.fim) }}</div>
          </div>
        </div>

        <section v-if="filtro.conta === 'todas'" class="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
          <header class="px-5 py-3 border-b border-slate-200">
            <h2 class="text-sm font-semibold text-slate-900">Por conta</h2>
            <p class="text-xs text-slate-500">Clique numa conta para ver só ela.</p>
          </header>
          <div class="overflow-x-auto">
            <table class="w-full text-sm whitespace-nowrap">
              <thead class="bg-slate-50/80 border-b border-slate-200 text-xs font-medium text-slate-500">
                <tr>
                  <th class="pl-5 pr-3 py-2 text-left">Conta</th>
                  <th class="px-3 py-2 text-right">Saldo anterior</th>
                  <th class="px-3 py-2 text-right">Entradas</th>
                  <th class="px-3 py-2 text-right">Saídas</th>
                  <th class="pl-3 pr-5 py-2 text-right">Saldo final</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 tabular-nums">
                <tr v-for="c in dados.por_conta" :key="c.conta" @click="filtro.conta = c.conta.toLowerCase()" class="hover:bg-slate-50 cursor-pointer">
                  <td class="pl-5 pr-3 py-2.5"><span class="px-2 py-0.5 rounded-md text-xs font-semibold border" :class="ESTILO[c.conta]?.chip">{{ c.conta }}</span></td>
                  <td class="px-3 py-2.5 text-right text-slate-600">{{ moeda(c.saldo_anterior) }}</td>
                  <td class="px-3 py-2.5 text-right text-emerald-600">{{ moeda(c.entradas) }}</td>
                  <td class="px-3 py-2.5 text-right text-red-600">− {{ moeda(c.saidas) }}</td>
                  <td class="pl-3 pr-5 py-2.5 text-right font-semibold" :class="c.saldo_final < 0 ? 'text-red-600' : 'text-slate-900'">{{ moeda(c.saldo_final) }}</td>
                </tr>
              </tbody>
              <tfoot class="bg-slate-50/80 border-t border-slate-200 font-semibold tabular-nums">
                <tr>
                  <td class="pl-5 pr-3 py-2.5 text-xs text-slate-500">Total</td>
                  <td class="px-3 py-2.5 text-right">{{ moeda(somaPorConta('saldo_anterior')) }}</td>
                  <td class="px-3 py-2.5 text-right text-emerald-600">{{ moeda(somaPorConta('entradas')) }}</td>
                  <td class="px-3 py-2.5 text-right text-red-600">− {{ moeda(somaPorConta('saidas')) }}</td>
                  <td class="pl-3 pr-5 py-2.5 text-right">{{ moeda(somaPorConta('saldo_final')) }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <section v-for="lado in [{ chave: 'entrada', titulo: 'Entradas por categoria', cor: 'bg-emerald-500', texto: 'text-emerald-600' },
                                    { chave: 'saida', titulo: 'Saídas por categoria', cor: 'bg-red-500', texto: 'text-red-600' }]"
                   :key="lado.chave" class="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
            <header class="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <h2 class="text-sm font-semibold text-slate-900">{{ lado.titulo }}</h2>
              <span class="text-xs font-semibold tabular-nums" :class="lado.texto">{{ moeda(totalCat(dados.categorias[lado.chave])) }}</span>
            </header>
            <ul class="p-5 space-y-3">
              <li v-for="c in dados.categorias[lado.chave]" :key="c.categoria">
                <div class="flex justify-between text-sm">
                  <span class="text-slate-700">{{ c.categoria }} <span class="text-xs text-slate-400">· {{ c.qtd }}</span></span>
                  <span class="font-semibold tabular-nums text-slate-900">{{ moeda(c.total) }}</span>
                </div>
                <div class="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div class="h-full rounded-full" :class="lado.cor" :style="{ width: pct(c.total, totalCat(dados.categorias[lado.chave])) + '%' }"></div>
                </div>
              </li>
              <li v-if="!dados.categorias[lado.chave].length" class="text-sm text-slate-400 text-center py-4">Nada no período.</li>
            </ul>
          </section>
        </div>

        <section class="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
          <header class="px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-4">
            <div>
              <h2 class="text-sm font-semibold text-slate-900">Extrato · {{ tituloConta }}</h2>
              <p class="text-xs text-slate-500">{{ dados.extrato.total }} lançamento(s) · o saldo de cada linha conta tudo o que entrou e saiu da conta até ali</p>
            </div>
            <div v-if="dados.extrato.pages > 1" class="flex items-center gap-2 text-xs text-slate-500">
              <button @click="pagina--" :disabled="pagina <= 1" aria-label="Página anterior" class="h-8 w-8 flex items-center justify-center rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40"><ChevronLeft class="w-4 h-4" /></button>
              {{ dados.extrato.page }} de {{ dados.extrato.pages }}
              <button @click="pagina++" :disabled="pagina >= dados.extrato.pages" aria-label="Próxima página" class="h-8 w-8 flex items-center justify-center rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40"><ChevronRight class="w-4 h-4" /></button>
            </div>
          </header>
          <div class="overflow-x-auto">
            <table class="w-full text-sm whitespace-nowrap">
              <thead class="bg-slate-50/80 border-b border-slate-200 text-xs font-medium text-slate-500">
                <tr>
                  <th class="pl-5 pr-3 py-2 text-left">Data</th>
                  <th class="px-3 py-2 text-left">Descrição</th>
                  <th class="px-3 py-2 text-left">Categoria</th>
                  <th class="px-3 py-2 text-left">Conta</th>
                  <th class="px-3 py-2 text-right">Entrada</th>
                  <th class="px-3 py-2 text-right">Saída</th>
                  <th class="pl-3 pr-5 py-2 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 tabular-nums">
                <tr v-for="l in dados.extrato.items" :key="l.id" class="hover:bg-slate-50/60" data-campo="rel-linha">
                  <td class="pl-5 pr-3 py-2 text-slate-500 text-[13px]">{{ dataBR(l.data) }}</td>
                  <td class="px-3 py-2 text-slate-800 whitespace-normal min-w-[260px]">{{ l.descricao }}</td>
                  <td class="px-3 py-2 text-xs text-slate-500">{{ l.categoria }}</td>
                  <td class="px-3 py-2"><span class="px-2 py-0.5 rounded-md text-[11px] font-medium border" :class="estiloChip(l.conta)">{{ l.conta }}</span></td>
                  <td class="px-3 py-2 text-right font-semibold text-emerald-600">{{ l.entrada != null ? moeda(l.entrada) : '' }}</td>
                  <td class="px-3 py-2 text-right font-semibold text-red-600">{{ l.saida != null ? '− ' + moeda(l.saida) : '' }}</td>
                  <td class="pl-3 pr-5 py-2 text-right font-semibold" :class="l.saldo < 0 ? 'text-red-600' : 'text-slate-900'">{{ moeda(l.saldo) }}</td>
                </tr>
                <tr v-if="!dados.extrato.items.length">
                  <td colspan="7" class="px-5 py-10 text-center text-sm text-slate-400">Nenhum lançamento neste período.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </div>
  </DashboardLayout>
</template>
