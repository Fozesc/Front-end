<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router';
import DashboardLayout from '../layouts/DashboardLayout.vue';
import ClientSelect from '../components/inputs/ClientSelect.vue';
import { AJUDA } from '../utils/ajuda';
import { avisar, avisarErro, confirmar } from '../utils/avisos';
import contratoService from '../services/contratoService';
import operationService from '../services/operationService';
import { documentosDoContrato, documentoCobranca } from '../utils/documentosBordero';
import { documentoValido } from '../utils/documento';
import { CONDICOES_MODELO } from '../utils/contratoPdf';
import VisualizadorDocumentos from '../components/common/VisualizadorDocumentos.vue';
import { FileSignature, Loader2, Save, FileDown, RotateCcw, Plus, X, Search, Mail, CheckCircle2 } from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();

const PARTES = [
  { chave: 'contratada', titulo: 'Contratada', sub: 'a empresa do borderô (Ajustes > Empresas)', rotuloDoc: 'cnpj' },
  { chave: 'contratante', titulo: 'Contratante', sub: 'o cliente', rotuloDoc: 'documento' },
];
const CAMPOS_REP = [['nome', 'Nome'], ['cpf', 'CPF'], ['rg', 'RG / órgão emissor'], ['nacionalidade', 'Nacionalidade'], ['estadoCivil', 'Estado civil']];
// juros moratorios do Quadro 03 vem das condicoes do contrato (abaixo)
const ENCARGOS = [['valorAntecipado', 'Valor antecipado'], ['taxaJuros', 'Taxa de juros'],
  ['iofAdicionalPct', '% IOF adicional'], ['iofDiarioPct', '% IOF saldo devedor diário'], ['iofAdicional', 'Valor IOF adicional'],
  ['iofDiario', 'Valor IOF saldo devedor'], ['iofTotal', 'Valor total IOF']];

const CONDICOES = [['jurosMora', 'Juros de mora', '% a.m.', '0.01'], ['multa', 'Multa contratual', '%', '0.01'],
  ['honorarios', 'Honorários advocatícios', '%', '0.01'], ['prazoReembolso', 'Prazo de reembolso', 'dias', '1'], ['vias', 'Vias', 'vias', '1']];

const numeroBusca = ref('');
const filtroAssinado = ref(['nao', 'sim', 'atraso'].includes(route.query.filtro) ? route.query.filtro : '');
const clienteId = ref(null);
const borderosCliente = ref([]);
const recentes = ref({ items: [], pages: 1, page: 1, total: 0 });
const buscaLista = ref('');
const carregandoLista = ref(false);
const editor = ref(null);
const carregando = ref(false);
const salvando = ref(false);
const aberto = ref(null);
const dados = ref(null);
let original = '';

const mudou = computed(() => !!dados.value && JSON.stringify(dados.value) !== original);

// o contrato guardado ficou diferente do que o sistema monta hoje (borderô mudou de empresa, titulo apagado ou
// prorrogado no cadastro, cliente juntado, Ajustes mudaram): avisa o que mudou, sem trocar nada sozinho
const desatualizado = computed(() => {
  const d = dados.value, s = aberto.value?.sugestao;
  if (!d || !s || !aberto.value.salvo) return [];
  const titulos = (x) => (x.titulos || []).map(t => `${t.valor}|${t.vencimento}`).join(';');
  return [
    [(d.contratada || {}).nome !== s.contratada.nome || (d.contratada || {}).cnpj !== s.contratada.cnpj, 'a empresa contratada'],
    [(d.contratante || {}).nome !== s.contratante.nome || (d.contratante || {}).documento !== s.contratante.documento, 'o cliente'],
    [titulos(d) !== titulos(s), 'os títulos'],
    [d.valorAntecipado !== s.valorAntecipado || (d.encargos || {}).valorAntecipado !== s.encargos.valorAntecipado, 'os valores'],
  ].filter(([dif]) => dif).map(([, nome]) => nome);
});

// todos os contratos (os da Fozesc sao gerados sozinhos), os mais recentes primeiro
const carregarRecentes = async (pagina = 1) => {
  carregandoLista.value = true;
  try { recentes.value = await contratoService.listar(pagina, buscaLista.value.trim(), filtroAssinado.value); } catch (e) { avisarErro(e, 'Não foi possível carregar os contratos.'); }
  finally { carregandoLista.value = false; }
};

const abrir = async (opId) => {
  if (!opId) return;
  if (mudou.value && !(await confirmar({ titulo: 'Trocar de contrato sem salvar?', mensagem: 'O que você mudou neste contrato vai se perder.', botao: 'Trocar', perigo: true }))) return;
  carregando.value = true;
  try {
    const r = await contratoService.abrir(opId);
    aberto.value = r;
    dados.value = JSON.parse(JSON.stringify(r.dados));
    // contrato salvo antes da aba de padroes: comeca com os numeros do modelo (os que estao no texto dele)
    dados.value.condicoes = { ...CONDICOES_MODELO, ...(dados.value.condicoes || {}) };
    original = JSON.stringify(dados.value);
    if (String(route.query.bordero) !== String(opId)) router.replace({ query: { bordero: opId } });
    await nextTick();
    editor.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    avisarErro(e, e?.response?.status === 404 ? `Borderô #${opId} não encontrado.` : 'Não foi possível abrir o contrato.');
  } finally {
    carregando.value = false;
  }
};

const abrirPeloNumero = () => {
  const n = Number(String(numeroBusca.value).replace(/\D/g, ''));
  if (!n) return avisar('Digite o número do borderô.');
  abrir(n);
};

watch(clienteId, async (id) => {
  borderosCliente.value = [];
  if (!id) return;
  try { borderosCliente.value = (await operationService.getByClient(id, 1, 20)).items; } catch (e) { avisarErro(e, 'Não foi possível carregar os borderôs do cliente.'); }
});

const salvar = async () => {
  salvando.value = true;
  try {
    const r = await contratoService.salvar(aberto.value.bordero.id, dados.value);
    Object.assign(aberto.value, { salvo: true, atualizado_por: r.atualizado_por, atualizado_em: r.atualizado_em });
    dados.value = JSON.parse(JSON.stringify(r.dados));
    original = JSON.stringify(dados.value);
    carregarRecentes(recentes.value.page);
    return true;
  } catch (e) {
    avisarErro(e, 'Não foi possível salvar o contrato. Nada foi gravado.');
    return false;
  } finally {
    salvando.value = false;
  }
};

const salvarSoAviso = async () => { if (await salvar()) avisar('Contrato salvo.', 'ok'); };

// salva e mostra os dois documentos (contrato e borderô da operação) antes de baixar
const visualizador = ref(null);
const visualizar = async () => {
  if (!(await salvar())) return;
  const atual = { dados: JSON.parse(JSON.stringify(dados.value)), operacao: aberto.value.operacao, bordero: aberto.value.bordero };
  visualizador.value = { titulo: `Contrato do borderô #${aberto.value.bordero.id}`,
    documentos: documentosDoContrato(async () => atual, String(dados.value.numero || aberto.value.bordero.id).replace(/[^\w-]+/g, '-')) };
};

const refazer = async () => {
  const ok = await confirmar({
    titulo: 'Montar de novo com os dados do sistema?',
    mensagem: 'Os campos voltam a ser os do cadastro do cliente, dos Ajustes e do borderô. O que foi digitado à mão some (só depois de salvar).',
    botao: 'Montar de novo',
  });
  if (ok) dados.value = JSON.parse(JSON.stringify(aberto.value.sugestao));
};

const novoTitulo = () => dados.value.titulos.push({ tipo: 'Nota promissória', numero: '', emitente: '', documento: '', vencimento: '', valor: '' });

onBeforeRouteLeave(async () => !mudou.value
  || confirmar({ titulo: 'Sair sem salvar?', mensagem: 'O que você mudou neste contrato vai se perder.', botao: 'Sair sem salvar', perigo: true }));

let esperaBusca = null;
watch(buscaLista, () => { clearTimeout(esperaBusca); esperaBusca = setTimeout(() => carregarRecentes(1), 350); });
watch(filtroAssinado, () => carregarRecentes(1));

// assinado / nao assinado: pede a senha (fica na auditoria)
const assinatura = ref(null);
const pedirAssinatura = (id, cliente, assinadoAgora) => {
  assinatura.value = { id, cliente, novo: !assinadoAgora, senha: '', erro: '', salvando: false };
};
const confirmarAssinatura = async () => {
  const a = assinatura.value;
  if (!a.senha) { a.erro = 'Digite sua senha para confirmar.'; return; }
  a.salvando = true;
  try {
    const r = await contratoService.marcarAssinado(a.id, a.novo, a.senha);
    const linha = recentes.value.items.find(c => c.id === a.id);
    if (linha) Object.assign(linha, r);
    if (aberto.value?.bordero.id === a.id) Object.assign(aberto.value, r);
    avisar(a.novo ? `Contrato do borderô #${a.id} marcado como assinado.` : `Contrato do borderô #${a.id} voltou para não assinado.`, 'ok');
    assinatura.value = null;
    if (filtroAssinado.value) carregarRecentes(recentes.value.page);
  } catch (e) {
    a.erro = e?.response?.data?.error || 'Não foi possível mudar. Tente de novo.';
    a.senha = '';
  } finally {
    a.salvando = false;
  }
};

// notificacao de cobranca (titulos vencidos do contrato, juros de mora e multa ate hoje)
const verCobranca = (c) => {
  visualizador.value = { titulo: `Notificação de cobrança · borderô #${c.id} · ${c.cliente}`, documentos: [documentoCobranca(c.id)] };
};

// CPF/CNPJ com digito errado no contrato: so avisa (o contrato e' texto livre)
const docsInvalidos = computed(() => {
  const d = dados.value;
  if (!d) return [];
  return [['CNPJ da contratada', d.contratada?.cnpj], ['CPF do representante da contratada', d.contratada?.rep?.cpf],
    ['CPF/CNPJ do contratante', d.contratante?.documento], ['CPF do representante do contratante', d.contratante?.rep?.cpf],
    ...(d.testemunhas || []).map((t, i) => [`CPF da testemunha ${i + 1}`, t.cpf]),
    ...(d.titulos || []).map((t, i) => [`CPF/CNPJ do título ${i + 1}`, t.documento])]
    .filter(([, v]) => !documentoValido(v)).map(([nome]) => nome);
});

// ver os PDFs de um contrato da lista sem abrir o formulario
const verDaLista = (c) => {
  let carregado = null;
  visualizador.value = { titulo: `Contrato do borderô #${c.id} · ${c.cliente}`,
    documentos: documentosDoContrato(() => (carregado ||= contratoService.abrir(c.id)), c.id) };
};

onMounted(() => {
  carregarRecentes();
  if (route.query.bordero) abrir(Number(route.query.bordero));
});

const moeda = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBR = (d) => (d ? d.split('-').reverse().join('/') : '');
const CAMPO = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow';
const ROTULO = 'block text-xs font-medium text-slate-600 mb-1';
const CARTAO = 'bg-white rounded-xl border border-slate-200/80 shadow-sm p-5';
</script>

<template>
  <DashboardLayout>
    <Teleport to="body">
      <div v-if="assinatura" class="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true" data-campo="modal-assinatura">
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="assinatura = null"></div>
        <form @submit.prevent="confirmarAssinatura" class="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
          <h3 class="text-base font-semibold text-slate-900">{{ assinatura.novo ? 'Marcar como assinado?' : 'Voltar para não assinado?' }}</h3>
          <p class="text-sm text-slate-500 mt-1">Contrato do borderô #{{ assinatura.id }} · {{ assinatura.cliente }}. Fica registrado na Auditoria.</p>
          <label for="senha-assinatura" class="block text-[13px] font-medium text-slate-700 mt-4 mb-1.5">Sua senha</label>
          <input id="senha-assinatura" v-model="assinatura.senha" type="password" autocomplete="current-password" autofocus data-campo="senha-assinatura" :class="CAMPO" />
          <p v-if="assinatura.erro" class="text-sm text-red-600 mt-2">{{ assinatura.erro }}</p>
          <div class="flex gap-3 mt-5">
            <button type="button" @click="assinatura = null" class="flex-1 h-10 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50">Cancelar</button>
            <button type="submit" :disabled="assinatura.salvando" data-campo="confirmar-assinatura"
                    class="flex-1 h-10 rounded-lg text-white text-sm font-semibold disabled:opacity-60" :class="assinatura.novo ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-700 hover:bg-slate-800'">
              {{ assinatura.salvando ? 'Conferindo...' : (assinatura.novo ? 'Marcar assinado' : 'Desmarcar') }}
            </button>
          </div>
        </form>
      </div>
      <VisualizadorDocumentos v-if="visualizador" :titulo="visualizador.titulo" :documentos="visualizador.documentos" @close="visualizador = null" />
    </Teleport>
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5">
      <div>
        <h1 class="text-2xl font-semibold text-slate-900 tracking-tight cursor-help" v-dica="AJUDA['/contratos']">Contratos</h1>
        <p class="text-slate-500 text-sm mt-1">Contrato de desconto de título de crédito de cada borderô, montado com os dados do cliente, da empresa e dos títulos.</p>
      </div>
    </div>


    <section class="bg-white rounded-xl border border-slate-200/80 shadow-sm mb-6" data-campo="contratos-recentes">
      <div class="px-5 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold text-slate-900">Todos os contratos <span class="text-slate-400 font-normal">· {{ recentes.total }}</span></h2>
          <p class="text-xs text-slate-500">Os borderôs da Fozesc já entram aqui com o contrato montado. Os mais recentes primeiro.</p>
        </div>
        <div class="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <select v-model="filtroAssinado" data-campo="filtro-assinado" :class="CAMPO" class="sm:w-44" aria-label="Assinatura">
            <option value="">Todos</option>
            <option value="nao">Não assinados</option>
            <option value="sim">Assinados</option>
            <option value="atraso">Com título vencido</option>
          </select>
          <div class="relative w-full md:w-72">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input v-model="buscaLista" type="search" placeholder="Buscar por cliente ou nº" data-campo="contratos-busca" :class="CAMPO" class="pl-9" />
          </div>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm min-w-[960px]">
          <thead class="bg-slate-50/80 text-slate-500 text-xs font-medium border-b border-slate-200">
            <tr><th class="px-5 py-2.5 text-left">Borderô</th><th class="px-3 py-2.5 text-left">Cliente</th><th class="px-3 py-2.5 text-left">Empresa</th>
              <th class="px-3 py-2.5 text-left">Data</th><th class="px-3 py-2.5 text-right">Valor</th><th class="px-3 py-2.5 text-left">Assinado</th>
              <th class="px-3 py-2.5 text-left">Atualizado</th><th class="px-5 py-2.5"></th></tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="carregandoLista && !recentes.items.length"><td colspan="8" class="px-5 py-8 text-center text-slate-400"><Loader2 class="w-5 h-5 animate-spin mx-auto" /></td></tr>
            <tr v-else-if="!recentes.items.length"><td colspan="8" class="px-5 py-8 text-center text-slate-400">{{ buscaLista || filtroAssinado ? 'Nenhum contrato com essa busca.' : 'Nenhum contrato ainda. Os borderôs da Fozesc aparecem aqui sozinhos.' }}</td></tr>
            <tr v-for="c in recentes.items" :key="c.id" class="hover:bg-slate-50" :class="aberto?.bordero.id === c.id ? 'bg-indigo-50/60' : ''" data-campo="contrato-linha">
              <td class="px-5 py-2.5 font-semibold text-slate-800 tabular-nums">#{{ c.id }}</td>
              <td class="px-3 py-2.5 text-slate-800 max-w-[260px] truncate">{{ c.cliente }}</td>
              <td class="px-3 py-2.5"><span class="px-1.5 py-px rounded-md text-[11px] font-semibold" :class="c.empresa === 'Fozesc' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'">{{ c.empresa }}</span></td>
              <td class="px-3 py-2.5 text-slate-600 tabular-nums">{{ dataBR(c.data) }}</td>
              <td class="px-3 py-2.5 text-right font-semibold text-slate-900 tabular-nums">{{ moeda(c.valor) }}</td>
              <td class="px-3 py-2.5">
                <label class="inline-flex items-center gap-2 cursor-pointer select-none" :title="c.assinado ? `Assinado · marcado por ${c.assinado_por} em ${c.assinado_em}` : 'Ainda não assinado'">
                  <input type="checkbox" :checked="c.assinado" @click.prevent="pedirAssinatura(c.id, c.cliente, c.assinado)" data-campo="contrato-assinado"
                         class="w-4 h-4 rounded border-slate-300 text-emerald-600 cursor-pointer" />
                  <span class="text-xs font-medium" :class="c.assinado ? 'text-emerald-700' : 'text-slate-400'">{{ c.assinado ? 'Assinado' : 'Pendente' }}</span>
                </label>
              </td>
              <td class="px-3 py-2.5 text-xs text-slate-500">{{ c.atualizado_por }} · {{ c.atualizado_em }}</td>
              <td class="px-5 py-2.5">
                <div class="flex justify-end gap-1.5">
                  <button @click="verDaLista(c)" data-campo="contrato-ver" class="h-8 px-3 rounded-md bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5"><FileDown class="w-3.5 h-3.5" /> Ver</button>
                  <button @click="verCobranca(c)" data-campo="contrato-cobranca" title="Notificação de cobrança dos títulos vencidos" class="h-8 px-3 rounded-md bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5"><Mail class="w-3.5 h-3.5" /> Notificação</button>
                  <button @click="abrir(c.id)" data-campo="contrato-editar" class="h-8 px-3 rounded-md bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50">Editar</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="recentes.pages > 1" class="px-5 py-3 border-t border-slate-100 flex justify-end items-center gap-2 text-xs">
        <button :disabled="recentes.page <= 1" @click="carregarRecentes(recentes.page - 1)" class="px-2.5 py-1 rounded border border-slate-300 disabled:opacity-40">Anterior</button>
        <span class="text-slate-500">{{ recentes.page }} de {{ recentes.pages }}</span>
        <button :disabled="recentes.page >= recentes.pages" @click="carregarRecentes(recentes.page + 1)" class="px-2.5 py-1 rounded border border-slate-300 disabled:opacity-40">Próxima</button>
      </div>
    </section>

    <h2 class="text-sm font-semibold text-slate-700 mb-3">Abrir o contrato de outro borderô</h2>
    <section class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      <div :class="CARTAO">
        <h2 class="text-sm font-semibold text-slate-900 mb-3">Pelo número do borderô</h2>
        <form @submit.prevent="abrirPeloNumero" class="flex gap-2">
          <input v-model="numeroBusca" inputmode="numeric" placeholder="Nº do borderô" data-campo="contrato-numero" :class="CAMPO" />
          <button type="submit" class="h-[38px] px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold flex items-center gap-1.5 shrink-0"><Search class="w-4 h-4" /> Abrir</button>
        </form>
      </div>
      <div :class="CARTAO" class="lg:col-span-2">
        <h2 class="text-sm font-semibold text-slate-900 mb-3">Pelo cliente</h2>
        <ClientSelect v-model="clienteId" />
        <div v-if="borderosCliente.length" class="mt-3 flex flex-wrap gap-2" data-campo="contrato-borderos">
          <button v-for="b in borderosCliente" :key="b.id" @click="abrir(b.id)"
                  class="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors"
                  :class="aberto?.bordero.id === b.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'">
            #{{ b.id }} · {{ dataBR(b.date) }} · {{ moeda(b.total_face_value) }}
          </button>
        </div>
        <p v-else-if="clienteId" class="mt-3 text-sm text-slate-400">Este cliente ainda não tem borderô.</p>
      </div>
    </section>

    <div v-if="carregando" class="flex items-center text-slate-400 py-12 justify-center"><Loader2 class="w-5 h-5 animate-spin mr-2" /> Montando o contrato...</div>

    <template v-else-if="dados">
      <div ref="editor" class="scroll-mt-4"></div>
      <div class="sticky top-0 z-20 -mx-1 px-1 py-3 mb-4 bg-slate-50/95 backdrop-blur flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200">
        <div class="flex items-center gap-3 min-w-0">
          <span class="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100 flex items-center justify-center shrink-0"><FileSignature class="w-[18px] h-[18px]" /></span>
          <div class="min-w-0">
            <div class="font-semibold text-slate-900 truncate">Contrato do borderô #{{ aberto.bordero.id }} · {{ aberto.bordero.cliente }}</div>
            <div class="text-xs text-slate-500" data-campo="contrato-status">
              <span v-if="aberto.salvo" class="font-semibold" :class="aberto.assinado ? 'text-emerald-700' : 'text-amber-700'">{{ aberto.assinado ? `Assinado (marcado por ${aberto.assinado_por} em ${aberto.assinado_em})` : 'Ainda não assinado' }} · </span>
              <template v-if="aberto.salvo">Salvo por {{ aberto.atualizado_por }} em {{ aberto.atualizado_em }}</template>
              <template v-else>Ainda não salvo · montado com os dados do sistema</template>
              <span v-if="mudou" class="text-amber-700 font-medium"> · alterações não salvas</span>
            </div>
          </div>
        </div>
        <div class="flex flex-wrap gap-2 shrink-0">
          <button v-if="aberto.salvo" @click="pedirAssinatura(aberto.bordero.id, aberto.bordero.cliente, aberto.assinado)" data-campo="editor-assinado"
                  class="h-9 px-3 rounded-lg border text-sm font-semibold flex items-center gap-1.5"
                  :class="aberto.assinado ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'">
            <CheckCircle2 class="w-4 h-4" /> {{ aberto.assinado ? 'Assinado' : 'Marcar assinado' }}
          </button>
          <button @click="refazer" class="h-9 px-3 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 flex items-center gap-1.5"><RotateCcw class="w-4 h-4" /> Montar de novo</button>
          <button @click="salvarSoAviso" :disabled="salvando" data-campo="contrato-salvar" class="h-9 px-3 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 flex items-center gap-1.5 disabled:opacity-60"><Save class="w-4 h-4" /> Salvar</button>
          <button @click="visualizar" :disabled="salvando" data-campo="contrato-visualizar" class="h-9 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold flex items-center gap-1.5 disabled:opacity-60">
            <Loader2 v-if="salvando" class="w-4 h-4 animate-spin" /><FileDown v-else class="w-4 h-4" /> Salvar e ver (contrato + borderô)
          </button>
        </div>
      </div>

      <div v-if="docsInvalidos.length" class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" data-campo="contrato-docs-invalidos">
        Dígitos não conferem em: <b>{{ docsInvalidos.join(', ') }}</b>. Confira antes de imprimir.
      </div>
      <div v-if="desatualizado.length" class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex flex-col sm:flex-row sm:items-center gap-3" data-campo="contrato-desatualizado">
        <span class="flex-1">Este contrato está diferente do borderô e do cadastro de hoje em: <b>{{ desatualizado.join(', ') }}</b>. Se mudou algo no borderô (empresa, títulos) ou no cadastro, use "Montar de novo" (o que foi digitado à mão some).</span>
        <button @click="refazer" class="h-8 px-3 rounded-md bg-white border border-amber-300 text-amber-900 text-xs font-semibold hover:bg-amber-100 shrink-0">Montar de novo</button>
      </div>
      <div class="space-y-5" data-campo="contrato-form">
        <section :class="CARTAO">
          <h3 class="text-sm font-semibold text-slate-900 mb-3">Contrato</h3>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><label :class="ROTULO">Nº do contrato</label><input v-model="dados.numero" :class="CAMPO" /></div>
            <div><label :class="ROTULO">Valor antecipado</label><input v-model="dados.valorAntecipado" :class="CAMPO" /></div>
            <div><label :class="ROTULO">Cidade</label><input v-model="dados.local" :class="CAMPO" /></div>
            <div><label :class="ROTULO">Data</label><input v-model="dados.data" type="date" :class="CAMPO" /></div>
          </div>
        </section>

        <div class="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <section v-for="p in PARTES" :key="p.chave" :class="CARTAO" :data-campo="`contrato-${p.chave}`">
            <h3 class="text-sm font-semibold text-slate-900">{{ p.titulo }} <span class="font-normal text-slate-400">· {{ p.sub }}</span></h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div class="sm:col-span-2"><label :class="ROTULO">Nome / Razão social</label><input v-model="dados[p.chave].nome" :class="CAMPO" /></div>
              <div><label :class="ROTULO">CPF / CNPJ</label><input v-model="dados[p.chave][p.rotuloDoc]" :class="CAMPO" /></div>
              <div><label :class="ROTULO">Telefone</label><input v-model="dados[p.chave].telefone" :class="CAMPO" /></div>
              <div class="sm:col-span-2"><label :class="ROTULO">E-mail</label><input v-model="dados[p.chave].email" type="email" :class="CAMPO" /></div>
              <div class="sm:col-span-2"><label :class="ROTULO">Endereço</label><textarea v-model="dados[p.chave].endereco" rows="2" :class="CAMPO" class="resize-y"></textarea></div>
            </div>
            <h4 class="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-5 mb-2">Representante</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div v-for="[campo, rotulo] in CAMPOS_REP" :key="campo" :class="campo === 'nome' ? 'sm:col-span-2' : ''">
                <label :class="ROTULO">{{ rotulo }}</label>
                <input v-model="dados[p.chave].rep[campo]" :data-campo="`rep-${p.chave}-${campo}`" :class="CAMPO" />
              </div>
              <div class="sm:col-span-2"><label :class="ROTULO">Endereço</label><textarea v-model="dados[p.chave].rep.endereco" rows="2" :class="CAMPO" class="resize-y"></textarea></div>
            </div>
          </section>
        </div>

        <section :class="CARTAO">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-slate-900">Títulos <span class="font-normal text-slate-400">· Quadro 02</span></h3>
            <button @click="novoTitulo" class="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"><Plus class="w-4 h-4" /> Adicionar título</button>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm min-w-[720px]">
              <thead class="text-xs text-slate-500 text-left"><tr><th class="pb-2 pr-2">Tipo</th><th class="pb-2 pr-2">Nº</th><th class="pb-2 pr-2">Emitente</th><th class="pb-2 pr-2">CPF / CNPJ</th><th class="pb-2 pr-2">Vencimento</th><th class="pb-2 pr-2">Valor</th><th></th></tr></thead>
              <tbody>
                <tr v-for="(t, i) in dados.titulos" :key="i">
                  <td class="pr-2 pb-2 w-36"><input v-model="t.tipo" :class="CAMPO" /></td>
                  <td class="pr-2 pb-2 w-20"><input v-model="t.numero" :class="CAMPO" /></td>
                  <td class="pr-2 pb-2"><input v-model="t.emitente" :class="CAMPO" /></td>
                  <td class="pr-2 pb-2 w-44"><input v-model="t.documento" :class="CAMPO" /></td>
                  <td class="pr-2 pb-2 w-32"><input v-model="t.vencimento" placeholder="dd/mm/aaaa" :class="CAMPO" /></td>
                  <td class="pr-2 pb-2 w-32"><input v-model="t.valor" :class="CAMPO" /></td>
                  <td class="pb-2 w-8"><button @click="dados.titulos.splice(i, 1)" aria-label="Tirar este título" class="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"><X class="w-4 h-4" /></button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section :class="CARTAO" data-campo="contrato-condicoes">
          <h3 class="text-sm font-semibold text-slate-900">Condições do contrato <span class="font-normal text-slate-400">· cláusulas 7ª e 8ª e o fecho</span></h3>
          <p class="text-xs text-slate-500 mb-3">Vêm de Ajustes &gt; Contratos. Mudar aqui vale só para este contrato (e para a notificação de cobrança dele).</p>
          <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div v-for="[campo, rotulo, un, passo] in CONDICOES" :key="campo">
              <label :class="ROTULO">{{ rotulo }}</label>
              <div class="relative"><input v-model.number="dados.condicoes[campo]" type="number" min="0" :step="passo" :data-campo="`condicao-${campo}`" :class="CAMPO" class="pr-14" />
                <span class="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">{{ un }}</span></div>
            </div>
          </div>
        </section>

        <section :class="CARTAO">
          <h3 class="text-sm font-semibold text-slate-900 mb-3">Encargos financeiros <span class="font-normal text-slate-400">· Quadro 03</span></h3>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div v-for="[campo, rotulo] in ENCARGOS" :key="campo"><label :class="ROTULO">{{ rotulo }}</label><input v-model="dados.encargos[campo]" :data-campo="`encargo-${campo}`" :class="CAMPO" /></div>
          </div>
        </section>

        <section :class="CARTAO">
          <h3 class="text-sm font-semibold text-slate-900 mb-3">Testemunhas</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div v-for="(t, i) in dados.testemunhas" :key="i" class="grid grid-cols-3 gap-2">
              <div class="col-span-3"><label :class="ROTULO">Testemunha {{ i + 1 }}</label><input v-model="t.nome" placeholder="Nome" :data-campo="`testemunha-${i}`" :class="CAMPO" /></div>
              <input v-model="t.cpf" placeholder="CPF" :class="CAMPO" class="col-span-2" />
              <input v-model="t.rg" placeholder="RG" :class="CAMPO" />
            </div>
          </div>
          <p class="text-xs text-slate-400 mt-3">Em branco, saem linhas para preencher à mão.</p>
        </section>
      </div>
    </template>

  </DashboardLayout>
</template>
