<script setup>
// Despesas recorrentes (igual ao Smaug): contas que se repetem. Debito automatico lanca
// sozinho no caixa no vencimento; o manual fica aguardando alguem lancar o valor do mes.
import { ref, computed, watch, onMounted } from 'vue';
import { Plus, Loader2, Bot, Hand, PlayCircle, CalendarClock, Pencil, Trash2, X, Repeat, AlertTriangle, CalendarDays, Wallet, Split } from 'lucide-vue-next';
import DashboardLayout from '../layouts/DashboardLayout.vue';
import BaseDateInput from '../components/common/BaseDateInput.vue';
import recorrenteService from '../services/recorrenteService';
import PartesPagamento from '../components/layout/finance/PartesPagamento.vue';
import { CONTAS, FORMAS, ESTILO, arred, partesFecham, partesParaEnviar } from '../utils/contasCaixa';
import { AJUDA } from '../utils/ajuda';
import { avisar, avisarErro, confirmar } from '../utils/avisos';

const FREQUENCIA = { mensal: 'Todo mês', semanal: 'Toda semana', anual: 'Todo ano' };
const POR_MES = { mensal: 1, semanal: 52 / 12, anual: 1 / 12 };

const itens = ref([]);
const carregando = ref(true);
const moeda = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const dataBR = (d) => (d ? d.split('-').reverse().join('/') : '');
const iso = (d) => d.toLocaleDateString('en-CA');
const hoje = () => iso(new Date());
const maisDias = (d, n) => { const [a, m, dia] = d.split('-').map(Number); return iso(new Date(a, m - 1, dia + n)); };

const carregar = async () => {
  try {
    itens.value = await recorrenteService.listar();
  } catch (e) {
    avisarErro(e, 'Não foi possível carregar as despesas recorrentes.');
  } finally {
    carregando.value = false;
  }
};
onMounted(carregar);

const ativas = computed(() => itens.value.filter(i => i.ativo));
const aguardando = computed(() => ativas.value.filter(i => !i.automatico && i.vencimento <= hoje()));
const semana = computed(() => ativas.value.filter(i => i.vencimento > hoje() && i.vencimento <= maisDias(hoje(), 7)));
const porMes = computed(() => ativas.value.filter(i => i.tipo === 'saida').reduce((t, i) => t + i.valor * POR_MES[i.frequencia], 0));
const soma = (lista) => lista.reduce((t, i) => t + i.falta, 0);
const categorias = computed(() => [...new Set(['Despesas fixas', ...itens.value.map(i => i.categoria)])]);

// ------------------------------------------------------------ cadastro
const form = ref(null);
const salvando = ref(false);
const novo = () => {
  form.value = { tipo: 'saida', descricao: '', valor: '', proximo: hoje(), frequencia: 'mensal', conta: null,
                 categoria: 'Despesas fixas', automatico: true, obs: '' };
};
const editar = (i) => { form.value = { ...i }; };
const salvar = async () => {
  const f = form.value;
  if (!f.descricao.trim() || !(Number(f.valor) > 0) || !f.proximo) return avisar('Preencha a descrição, o valor e o próximo vencimento.');
  if (f.automatico && !f.conta) return avisar(`Escolha a conta de onde o débito automático ${f.tipo === 'entrada' ? 'entra' : 'sai'}.`);
  salvando.value = true;
  const dados = { tipo: f.tipo, descricao: f.descricao, valor: Number(f.valor), proximo: f.proximo, frequencia: f.frequencia,
                  conta: f.conta, categoria: f.categoria, automatico: f.automatico, obs: f.obs };
  try {
    if (f.id) await recorrenteService.editar(f.id, dados);
    else await recorrenteService.criar(dados);
    form.value = null;
    avisar(f.id ? 'Despesa atualizada.' : 'Despesa cadastrada.', 'ok');
    await carregar();
  } catch (e) {
    avisarErro(e, 'Não foi possível salvar. Nada foi gravado.');
  } finally {
    salvando.value = false;
  }
};
const alternar = async (i, campo) => {
  // virar debito automatico pede a conta de onde ele sai: abre o cadastro para escolher
  if (campo === 'automatico' && !i.automatico) return editar({ ...i, automatico: true });
  try {
    await recorrenteService.editar(i.id, { [campo]: !i[campo] });
    await carregar();
  } catch (e) {
    avisarErro(e, 'Não foi possível mudar.');
  }
};
const apagar = async (i) => {
  const ok = await confirmar({
    titulo: 'Apagar despesa recorrente?', mensagem: `"${i.descricao}" deixa de ser lançada.`,
    consequencias: ['O que ela já lançou continua no caixa.', 'Para só parar por um tempo, use "Pausar" em vez de apagar.'],
    botao: 'Apagar', perigo: true,
  });
  if (!ok) return;
  try {
    await recorrenteService.apagar(i.id);
    await carregar();
  } catch (e) {
    avisarErro(e, 'Não foi possível apagar.');
  }
};

// ------------------------------------------------------------ debito manual (como o Receber)
// A conta (ou as partes) e' escolhida aqui. Pagando menos do que falta, o resto fica para
// depois e o vencimento so anda quando quitar.
const lancando = ref(null);
const abrirLancar = (i) => {
  const conta = i.conta || 'Dinheiro';
  lancando.value = { item: i, valorConta: i.valor_atual, pagar: i.falta, data: hoje(), modo: 'unica',
                     conta, forma: FORMAS[conta][0], partes: [] };
};
const falta = computed(() => (lancando.value ? arred(Number(lancando.value.valorConta) - lancando.value.item.pago_atual) : 0));
watch(() => lancando.value?.valorConta, () => { if (lancando.value) lancando.value.pagar = Math.max(falta.value, 0); });
const trocarConta = (conta) => {
  lancando.value.conta = conta;
  if (!FORMAS[conta].includes(lancando.value.forma)) lancando.value.forma = FORMAS[conta][0];
};
const lancar = async () => {
  const l = lancando.value;
  const pagar = arred(l.pagar);
  if (!(Number(l.valorConta) > 0) || !l.data) return avisar('Preencha o valor da conta e a data.');
  if (!(pagar > 0)) return avisar('Preencha quanto está sendo pago agora.');
  if (pagar > falta.value + 0.005) return avisar(`O pagamento passa do que falta desta conta (${moeda(falta.value)}).`);
  if (l.modo === 'dividido' && !partesFecham(l.partes, pagar)) return avisar('A soma das partes tem que fechar com o valor pago agora.');
  salvando.value = true;
  try {
    await recorrenteService.lancar(l.item.id, {
      valor_conta: Number(l.valorConta), data: l.data,
      partes: l.modo === 'unica' ? [{ conta: l.conta, forma: l.forma, valor: pagar }] : partesParaEnviar(l.partes),
    });
    const resto = arred(falta.value - pagar);
    avisar(`${l.item.descricao}: ${moeda(pagar)} lançado no caixa${resto > 0 ? ` (falta ${moeda(resto)})` : ''}.`, 'ok');
    lancando.value = null;
    await carregar();
  } catch (e) {
    avisarErro(e, 'Não foi possível lançar. Nada foi gravado.');
  } finally {
    salvando.value = false;
  }
};

// ------------------------------------------------------------ adiamento
const adiando = ref(null);
const abrirAdiar = (i) => { adiando.value = { item: i, ate: i.adiado_ate || maisDias(i.proximo, 7) }; };
const adiar = async (ate) => {
  salvando.value = true;
  try {
    await recorrenteService.adiar(adiando.value.item.id, ate);
    adiando.value = null;
    await carregar();
  } catch (e) {
    avisarErro(e, 'Não foi possível adiar.');
  } finally {
    salvando.value = false;
  }
};

const rotulo = 'block text-[13px] font-medium text-slate-700 mb-1.5';
const campo = 'w-full h-10 px-3 border border-slate-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs';
const botaoIcone = 'p-1.5 rounded-lg text-slate-400 transition-colors align-middle';
</script>

<template>
  <DashboardLayout>
    <div class="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
      <div>
        <h1 class="text-2xl font-semibold text-slate-900 tracking-tight cursor-help" v-dica="AJUDA['/recorrentes']">Despesas recorrentes</h1>
        <p class="text-slate-500 text-sm mt-1">Contas que se repetem: o débito automático lança sozinho no caixa; a manual espera você lançar o valor do mês.</p>
      </div>
      <button @click="novo" data-campo="nova-recorrente"
              class="bg-indigo-600 hover:bg-indigo-700 text-white h-9 px-3.5 rounded-lg text-sm font-semibold shadow-xs flex items-center transition-colors">
        <Plus class="w-4 h-4 mr-2" /> Nova despesa
      </button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200/80" title="Soma das despesas ativas convertida para um mês (semanal × 4,3; anual ÷ 12)">
        <div class="flex items-center gap-2 text-sm font-medium text-slate-500"><Repeat class="w-4 h-4 text-indigo-500" /> Contas fixas por mês</div>
        <div class="mt-3 text-2xl font-semibold tracking-tight tabular-nums text-slate-900">{{ moeda(porMes) }}</div>
        <div class="text-xs text-slate-500 mt-0.5">{{ ativas.length }} ativa(s)</div>
      </div>
      <div class="p-5 rounded-xl shadow-sm border" :class="aguardando.length ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200/80'"
           title="Despesas manuais que já venceram e ainda não foram lançadas no caixa">
        <div class="flex items-center gap-2 text-sm font-medium" :class="aguardando.length ? 'text-amber-800' : 'text-slate-500'">
          <AlertTriangle class="w-4 h-4" /> Aguardando lançamento
        </div>
        <div class="mt-3 text-2xl font-semibold tracking-tight tabular-nums" :class="aguardando.length ? 'text-amber-700' : 'text-slate-900'">{{ moeda(soma(aguardando)) }}</div>
        <div class="text-xs mt-0.5" :class="aguardando.length ? 'text-amber-700' : 'text-slate-500'">{{ aguardando.length }} conta(s) vencida(s) sem lançar</div>
      </div>
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200/80" title="O que vence depois de hoje, até daqui a 7 dias">
        <div class="flex items-center gap-2 text-sm font-medium text-slate-500"><CalendarDays class="w-4 h-4 text-sky-500" /> Próximos 7 dias</div>
        <div class="mt-3 text-2xl font-semibold tracking-tight tabular-nums text-slate-900">{{ moeda(soma(semana)) }}</div>
        <div class="text-xs text-slate-500 mt-0.5">{{ semana.length }} conta(s)</div>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-50/80 text-slate-500 text-xs font-medium border-b border-slate-200">
            <tr>
              <th class="px-3 py-2.5">Descrição</th>
              <th class="px-3 py-2.5" title="No débito automático, a conta de onde ele sai">Repete</th>
              <th class="px-3 py-2.5" title="Embaixo da data: o último lançamento que esta despesa fez no caixa">Vencimento</th>
              <th class="px-3 py-2.5 text-right">Valor</th>
              <th class="px-3 py-2.5">Modo</th>
              <th class="px-3 py-2.5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="carregando"><td colspan="7" class="px-6 py-10 text-center"><Loader2 class="w-6 h-6 animate-spin mx-auto text-slate-400" /></td></tr>
            <tr v-else-if="!itens.length">
              <td colspan="7" class="px-6 py-10 text-center text-slate-400">Nenhuma despesa recorrente. Cadastre o aluguel, a luz, a internet...</td>
            </tr>
            <tr v-for="i in itens" v-show="!carregando" :key="i.id" :class="!i.ativo && 'opacity-50'">
              <td class="px-3 py-2.5 min-w-[170px]">
                <div class="font-medium text-slate-800">{{ i.descricao }}</div>
                <div class="text-xs text-slate-400 line-clamp-2" :title="i.obs || undefined">{{ i.categoria }}<template v-if="i.obs"> · {{ i.obs }}</template></div>
              </td>
              <td class="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">{{ FREQUENCIA[i.frequencia] }}<template v-if="i.automatico"> · {{ i.conta }}</template></td>
              <td class="px-3 py-2.5 whitespace-nowrap tabular-nums">
                <span :class="i.ativo && !i.automatico && i.vencimento <= hoje() ? 'font-semibold text-amber-700' : 'text-slate-600'">{{ dataBR(i.vencimento) }}</span>
                <span v-if="i.ativo && !i.automatico && i.vencimento <= hoje()" class="ml-1.5 text-[11px] text-amber-700">aguardando</span>
                <div v-if="i.pago_atual > 0" class="text-[11px] font-medium text-amber-700">pago {{ moeda(i.pago_atual) }} · falta {{ moeda(i.falta) }}</div>
                <div v-if="i.adiado_ate" class="text-[11px] text-slate-400">adiada · era {{ dataBR(i.proximo) }}</div>
                <div v-if="i.ultimo" class="text-[11px] text-slate-400">último {{ dataBR(i.ultimo.data) }} · {{ moeda(i.ultimo.valor) }}</div>
              </td>
              <td class="px-3 py-2.5 text-right font-semibold tabular-nums whitespace-nowrap" :class="i.tipo === 'entrada' ? 'text-emerald-600' : 'text-red-600'">
                {{ i.tipo === 'entrada' ? '+' : '-' }}{{ moeda(i.valor) }}
              </td>
              <td class="px-3 py-2.5">
                <div class="flex flex-col items-start gap-1">
                <button @click="alternar(i, 'automatico')"
                        :title="i.automatico ? 'Débito automático: lança sozinho no caixa no dia do vencimento. Clique para passar a manual.' : 'Manual: você lança o valor de cada mês. Clique para passar a débito automático.'"
                        class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap hover:opacity-80"
                        :class="i.automatico ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'">
                  <Bot v-if="i.automatico" class="w-3.5 h-3.5" /><Hand v-else class="w-3.5 h-3.5" />
                  {{ i.automatico ? 'Automático' : 'Manual' }}
                </button>
                <button @click="alternar(i, 'ativo')" :title="i.ativo ? 'Clique para pausar (não lança nem cobra até retomar)' : 'Clique para retomar'"
                        class="rounded-full px-2.5 py-0.5 text-[11px] font-medium hover:opacity-80"
                        :class="i.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">
                  {{ i.ativo ? 'Ativa' : 'Pausada' }}
                </button>
                </div>
              </td>
              <td class="px-3 py-2.5 text-right whitespace-nowrap">
                <button v-if="i.ativo && !i.automatico" @click="abrirLancar(i)" title="Lançar no caixa o valor deste mês"
                        class="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold align-middle transition-colors"
                        :class="i.vencimento <= hoje() ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'">
                  <PlayCircle class="w-4 h-4" /> Lançar
                </button>
                <button v-if="i.ativo" @click="abrirAdiar(i)" title="Adiar só este vencimento" aria-label="Adiar"
                        :class="[botaoIcone, 'hover:text-slate-700 hover:bg-slate-100']"><CalendarClock class="w-4 h-4" /></button>
                <button @click="editar(i)" title="Editar" aria-label="Editar"
                        :class="[botaoIcone, 'hover:text-indigo-600 hover:bg-indigo-50']"><Pencil class="w-4 h-4" /></button>
                <button @click="apagar(i)" title="Apagar" aria-label="Apagar"
                        :class="[botaoIcone, 'hover:text-red-600 hover:bg-red-50']"><Trash2 class="w-4 h-4" /></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- CADASTRO / EDICAO -->
    <div v-if="form" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="form = null"></div>
      <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div class="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 class="text-base font-semibold text-slate-900">{{ form.id ? 'Editar despesa recorrente' : 'Nova despesa recorrente' }}</h2>
          <button @click="form = null" aria-label="Fechar" class="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-lg"><X class="w-5 h-5" /></button>
        </div>
        <div class="p-6 space-y-3.5">
          <div class="flex bg-slate-100 p-1 rounded-lg">
            <button v-for="t in [{ id: 'saida', nome: 'Saída (conta a pagar)', cor: 'text-red-600' }, { id: 'entrada', nome: 'Entrada (a receber)', cor: 'text-emerald-600' }]"
                    :key="t.id" type="button" @click="form.tipo = t.id"
                    class="flex-1 py-2 text-sm font-semibold rounded-md transition-all"
                    :class="form.tipo === t.id ? `bg-white shadow-sm ${t.cor}` : 'text-slate-500 hover:text-slate-700'">{{ t.nome }}</button>
          </div>
          <div>
            <label :class="rotulo">Descrição</label>
            <input v-model="form.descricao" :class="campo" placeholder="Ex: Aluguel do escritório" data-campo="recorrente-descricao" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label :class="rotulo">Valor (R$)</label>
              <input v-model="form.valor" type="number" step="0.01" min="0" :class="campo" placeholder="0,00" data-campo="recorrente-valor" />
            </div>
            <div>
              <label :class="rotulo" title="O próximo dia em que esta conta vence. Os seguintes andam a partir dele.">Próximo vencimento</label>
              <BaseDateInput v-model="form.proximo" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label :class="rotulo">Repete</label>
              <select v-model="form.frequencia" :class="campo">
                <option v-for="(nome, id) in FREQUENCIA" :key="id" :value="id">{{ nome }}</option>
              </select>
            </div>
            <div>
              <label :class="rotulo" title="Agrupa no Relatório do Caixa e no Extrato">Categoria</label>
              <input v-model="form.categoria" list="categorias-recorrentes" :class="campo" />
              <datalist id="categorias-recorrentes"><option v-for="c in categorias" :key="c" :value="c" /></datalist>
            </div>
          </div>
          <div class="space-y-2">
            <label :class="rotulo">Como lança no caixa</label>
            <label v-for="m in [{ v: true, nome: 'Débito automático', sub: 'O banco debita sozinho: lança no caixa no dia do vencimento, com o valor de cima.' },
                                { v: false, nome: 'Manual', sub: 'Fica aguardando alguém lançar. A conta, a forma e se paga tudo ou uma parte são escolhidas na hora.' }]"
                   :key="String(m.v)" class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer"
                   :class="form.automatico === m.v ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 hover:bg-slate-50'">
              <input type="radio" :value="m.v" v-model="form.automatico" class="mt-1 accent-indigo-600" />
              <span><span class="block text-sm font-semibold text-slate-800">{{ m.nome }}</span><span class="block text-xs text-slate-500">{{ m.sub }}</span></span>
            </label>
          </div>
          <div v-if="form.automatico">
            <label :class="rotulo">{{ form.tipo === 'entrada' ? 'O débito automático entra em' : 'O débito automático sai de' }}</label>
            <div class="grid grid-cols-3 gap-2">
              <button v-for="c in CONTAS" :key="c.id" type="button" @click="form.conta = c.id" :data-campo="`conta-${c.id}`"
                      class="flex items-center justify-center gap-1.5 h-10 rounded-lg border text-xs font-semibold transition-all"
                      :class="form.conta === c.id ? ESTILO[c.id].ativo : 'border-slate-200 hover:bg-slate-50 text-slate-500'">
                <component :is="c.icone" class="w-4 h-4" /> {{ c.curto }}
              </button>
            </div>
          </div>
          <div>
            <label :class="rotulo">Anotação <span class="font-normal text-slate-400">(opcional)</span></label>
            <textarea v-model="form.obs" rows="2" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs"
                      placeholder="Ex: boleto chega por e-mail; código do cliente 12345"></textarea>
          </div>
        </div>
        <div class="sticky bottom-0 bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-200">
          <button @click="form = null" class="px-4 h-9 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold shadow-xs hover:bg-slate-50 text-sm">Cancelar</button>
          <button @click="salvar" :disabled="salvando" data-campo="salvar-recorrente"
                  class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 h-9 rounded-lg font-semibold shadow-xs text-sm disabled:opacity-60">
            {{ form.id ? 'Salvar alterações' : 'Cadastrar' }}
          </button>
        </div>
      </div>
    </div>

    <!-- DEBITO MANUAL (como o Receber) -->
    <div v-if="lancando" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="lancando = null"></div>
      <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div class="px-6 py-4 border-b border-slate-200 flex justify-between items-start">
          <div>
            <h2 class="text-base font-semibold text-slate-900">Lançar {{ lancando.item.descricao }}</h2>
            <p class="text-xs text-slate-500 mt-0.5">
              Vencimento {{ dataBR(lancando.item.vencimento) }}<template v-if="lancando.item.pago_atual > 0">
              · já pago {{ moeda(lancando.item.pago_atual) }}</template>
            </p>
          </div>
          <button @click="lancando = null" aria-label="Fechar" class="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 -mr-2 rounded-lg"><X class="w-5 h-5" /></button>
        </div>
        <div class="p-6 space-y-4">
          <div class="grid grid-cols-[1fr_1fr_11rem] gap-3">
            <div>
              <label :class="rotulo" title="O valor da conta deste período (a luz nunca vem igual)">Valor da conta</label>
              <input v-model="lancando.valorConta" type="number" step="0.01" min="0" :class="campo" data-campo="lancar-valor-conta" />
            </div>
            <div>
              <label :class="rotulo" title="Pode ser menos do que falta: o resto fica para depois">{{ lancando.item.tipo === 'entrada' ? 'Recebendo agora' : 'Pagando agora' }}</label>
              <input v-model="lancando.pagar" type="number" step="0.01" min="0" :class="campo" data-campo="lancar-valor" />
            </div>
            <div>
              <label :class="rotulo">Data</label>
              <BaseDateInput v-model="lancando.data" />
            </div>
          </div>

          <div class="flex bg-slate-100 p-1 rounded-lg gap-0.5">
            <button @click="lancando.modo = 'unica'" class="flex-1 py-2 text-[13px] font-semibold rounded-md flex items-center justify-center gap-2 transition-all"
                    :class="lancando.modo === 'unica' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'">
              <Wallet class="w-4 h-4" /> Uma conta só
            </button>
            <button @click="lancando.modo = 'dividido'" data-campo="lancar-dividir" class="flex-1 py-2 text-[13px] font-semibold rounded-md flex items-center justify-center gap-2 transition-all"
                    :class="lancando.modo === 'dividido' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'">
              <Split class="w-4 h-4" /> Dividir em partes
            </button>
          </div>

          <div v-if="lancando.modo === 'unica'" class="space-y-4">
            <div>
              <label :class="rotulo">{{ lancando.item.tipo === 'entrada' ? 'Onde o dinheiro entra' : 'De onde o dinheiro sai' }}</label>
              <div class="grid grid-cols-3 gap-2">
                <button v-for="c in CONTAS" :key="c.id" @click="trocarConta(c.id)" type="button"
                        class="border rounded-xl p-3 text-left transition-all"
                        :class="lancando.conta === c.id ? ESTILO[c.id].ativo : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white'">
                  <component :is="c.icone" class="w-5 h-5 mb-1.5" />
                  <div class="text-xs font-semibold leading-tight">{{ c.nome }}</div>
                  <div class="text-[11px] opacity-70">{{ c.sub }}</div>
                </button>
              </div>
            </div>
            <div>
              <label :class="rotulo">{{ lancando.item.tipo === 'entrada' ? 'Como recebeu' : 'Como pagou' }}</label>
              <div class="flex flex-wrap gap-2">
                <button v-for="f in FORMAS[lancando.conta]" :key="f" @click="lancando.forma = f" type="button"
                        class="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                        :class="lancando.forma === f ? ESTILO[lancando.conta].chip : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'">{{ f }}</button>
              </div>
            </div>
          </div>
          <PartesPagamento v-else v-model="lancando.partes" :total="arred(lancando.pagar)" compacto />

          <p class="text-xs rounded-lg p-3 border" data-campo="previa-lancamento"
             :class="arred(lancando.pagar) > falta + 0.005 ? 'bg-red-50 border-red-200 text-red-700'
               : arred(lancando.pagar) < falta - 0.005 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-slate-50 border-slate-200 text-slate-600'">
            <template v-if="arred(lancando.pagar) > falta + 0.005">
              Passa do que falta desta conta: falta <strong>{{ moeda(falta) }}</strong>. Se a conta deste mês veio maior, mude o valor da conta.
            </template>
            <template v-else-if="arred(lancando.pagar) < falta - 0.005">
              Pagamento parcial: {{ moeda(lancando.pagar) }} de {{ moeda(falta) }}. Fica <strong>{{ moeda(falta - lancando.pagar) }}</strong>
              para depois, e o vencimento continua até quitar.
            </template>
            <template v-else>Quita a conta deste período: o vencimento passa para o próximo.</template>
          </p>
        </div>
        <div class="sticky bottom-0 bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-200">
          <button @click="lancando = null" class="px-4 h-9 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold shadow-xs hover:bg-slate-50 text-sm">Cancelar</button>
          <button @click="lancar" :disabled="salvando" data-campo="confirmar-lancamento"
                  class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 h-9 rounded-lg font-semibold shadow-xs text-sm disabled:opacity-60">Lançar no caixa</button>
        </div>
      </div>
    </div>

    <!-- ADIAMENTO -->
    <div v-if="adiando" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="adiando = null"></div>
      <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div>
          <h2 class="text-base font-semibold text-slate-900">Adiar {{ adiando.item.descricao }}</h2>
          <p class="text-sm text-slate-500 mt-1">
            Vale só para este vencimento ({{ dataBR(adiando.item.proximo) }}).
            {{ adiando.item.automatico ? 'O débito automático só lança na nova data.' : 'Ela só volta a aparecer como aguardando na nova data.' }}
            Depois de lançada, a próxima segue o calendário normal.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button v-for="n in [3, 7, 15, 30]" :key="n" type="button" @click="adiando.ate = maisDias(adiando.item.proximo, n)"
                  class="h-8 px-3 rounded-lg border text-[13px] font-medium"
                  :class="adiando.ate === maisDias(adiando.item.proximo, n) ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'">+{{ n }} dias</button>
        </div>
        <div>
          <label :class="rotulo">Nova data</label>
          <BaseDateInput v-model="adiando.ate" />
        </div>
        <div class="flex flex-wrap justify-end gap-3 pt-1">
          <button v-if="adiando.item.adiado_ate" @click="adiar(null)" :disabled="salvando"
                  class="px-4 h-9 rounded-lg text-slate-600 font-semibold hover:bg-slate-100 text-sm mr-auto">Desfazer adiamento</button>
          <button @click="adiando = null" class="px-4 h-9 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold shadow-xs hover:bg-slate-50 text-sm">Cancelar</button>
          <button @click="adiar(adiando.ate)" :disabled="salvando || !adiando.ate" data-campo="confirmar-adiamento"
                  class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 h-9 rounded-lg font-semibold shadow-xs text-sm disabled:opacity-60">Adiar</button>
        </div>
      </div>
    </div>
  </DashboardLayout>
</template>
