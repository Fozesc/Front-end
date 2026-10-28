<script setup>
import { ref, onMounted, computed } from 'vue';
import { AJUDA } from '../utils/ajuda';
import { avisar, avisarErro } from '../utils/avisos';
import { useRoute, useRouter } from 'vue-router';
import DashboardLayout from '../layouts/DashboardLayout.vue';
import { 
  ArrowLeft, Printer, CreditCard, AlertTriangle, 
  FileText, CheckCircle, Clock, Check, ChevronDown, ChevronUp, Loader2, MapPin, StickyNote, FileDown, Award
} from 'lucide-vue-next';
import ClienteNotas from '../components/layout/ClienteNotas.vue';
import RecebimentoModal from '../components/layout/finance/RecebimentoModal.vue';
import StatusChequeModal from '../components/layout/finance/StatusChequeModal.vue';
import api from '../services/api';
import { baixarRelatorioClientePdf } from '../utils/relatorioClientePdf';
import { baixarFichaClientePdf } from '../utils/fichaClientePdf';
import { LINHAS_REPUTACAO, REGRA_REPUTACAO } from '../utils/reputacao';
import MedidorReputacao from '../components/common/MedidorReputacao.vue';

// --- SERVIÇOS ---
import clientService from '../services/clientService';
import operationService from '../services/operationService';
import checkService from '../services/checkService';

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const aba = ref('operacoes');
const totalNotas = ref(null);

const openStatusMenuId = ref(null); 
const expandedOps = ref([]); 

const statusOptions = ['Aguardando', 'Pago', 'Devolvido', 'Atrasado', 'Juridico'];
// mudar status passa pelas mesmas telas da lista de Titulos: Receber (conta, imposto, partes)
// e a de status (multa da devolucao e conta) - senao o dinheiro caia sempre no Dinheiro
const chequeParaReceber = ref(null);
const mudancaStatus = ref(null);
const taxaMulta = ref(2);
const empresa = ref({ nome: 'Fozesc', cnpj: null });
const gerandoPdf = ref(false);

const cliente = ref({
  id: null,
  nome: 'Carregando...',
  documento: '',
  telefone: '',
  limite: 0,
  taxa: 0,
  obs: '',
  endereco: '',
  // --- ADICIONEI PARA TER CERTEZA QUE NÃO VAI DAR UNDEFINED ---
  bairro: '',
  cidade: '',
  estado: '',
  cep: ''
});

const operacoesDoCliente = ref([]); 
const reputacao = ref(null);


// um borderô do servidor no formato da tela (e dos PDFs)
const formatarOperacao = (op, hoje) => {
  const chequesFormatados = (Array.isArray(op.cheques) ? op.cheques : []).map(c => ({
    id: c.id,
    tipo: c.type,
    vencimento: c.due_date,
    valor: Number(c.amount || 0),
    status: c.status || 'Aguardando',
    banco: c.bank || 'Manual',
    num_doc: c.number || 'S/N',
    emitente: c.issuer_name || 'Titular',
    juros: Number(c.interest_amount || 0),
    pagamento: c.payment_date,
    isAtrasado: (c.status === 'Atrasado') || (c.status === 'Aguardando' && c.due_date < hoje)
  }));
  const todosPagos = chequesFormatados.length > 0 && chequesFormatados.every(c => ['Pago', 'Compensado'].includes(c.status));
  return {
    id: op.id,
    data: op.date,
    total: chequesFormatados.reduce((sum, c) => sum + c.valor, 0),
    face: Number(op.total_face_value || 0),
    juros: Number(op.total_interest || 0),
    iof: Number(op.iof_amount || 0),
    comissao: Number(op.comissao_valor || 0),
    liquido: Number(op.total_net_value || 0),
    taxa: op.monthly_rate,
    statusGeral: todosPagos ? 'Concluída' : 'Em Aberto',
    temAtraso: chequesFormatados.some(c => c.isAtrasado),
    cheques: chequesFormatados
  };
};
const hojeIso = () => new Date().toLocaleDateString('en-CA');

// borderôs em paginas de 10: cliente antigo tem centenas e a ficha ficava pesada
const paginaOps = ref(1);
const totalPaginasOps = ref(1);
const totalOps = ref(0);
const carregandoOps = ref(false);
const carregarOperacoes = async (pagina = 1) => {
  carregandoOps.value = true;
  try {
    const res = await operationService.getByClient(Number(route.params.id), pagina);
    operacoesDoCliente.value = (res.items || []).map(op => formatarOperacao(op, hojeIso()));
    paginaOps.value = res.page || 1;
    totalPaginasOps.value = res.pages || 1;
    totalOps.value = res.total || 0;
    const primeira = operacoesDoCliente.value[0]?.id;
    if (primeira && !expandedOps.value.includes(primeira)) expandedOps.value.push(primeira);
  } catch (error) {
    console.error('Erro ao carregar borderôs:', error);
  } finally {
    carregandoOps.value = false;
  }
};

const carregarTudo = async () => {
  loading.value = true;
  const idCliente = Number(route.params.id);
  try {
    const [dadosCliente] = await Promise.all([clientService.getById(idCliente), carregarOperacoes(paginaOps.value)]);
    if (dadosCliente) {
      cliente.value = {
        id: dadosCliente.id,
        nome: dadosCliente.name || 'Sem Nome',
        documento: dadosCliente.document || '-',
        telefone: dadosCliente.phone || '-',
        limite: Number(dadosCliente.credit_limit || 0),
        taxa: Number(dadosCliente.standard_rate || 4.00),
        obs: dadosCliente.notes || '',
        endereco: dadosCliente.address || '',
        bairro: dadosCliente.neighborhood || '',
        cidade: dadosCliente.city || '',
        estado: dadosCliente.state || '',
        cep: dadosCliente.zip_code || ''
      };
      reputacao.value = dadosCliente.reputacao || null;
      totalEmAbertoGlobal.value = Number(dadosCliente.valor_em_aberto || 0);
      totalDevolvido.value = Number(dadosCliente.valor_devolvido || 0);
    }
  } catch (error) {
    console.error("Erro ao carregar ficha:", error);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  carregarTudo();
  api.get('/settings/').then(({ data }) => {
    taxaMulta.value = Number(data?.fine_rate ?? 2);
    empresa.value = { nome: data?.nomeEmpresa || 'Fozesc', cnpj: data?.cnpj || null };
  }).catch(() => {});
  document.addEventListener('click', closeStatusMenu);
});


const toggleOp = (id) => {
  if (expandedOps.value.includes(id)) expandedOps.value = expandedOps.value.filter(opId => opId !== id); 
  else expandedOps.value.push(id); 
};

const toggleStatusMenu = (id, event) => {
  event.stopPropagation();
  openStatusMenuId.value = openStatusMenuId.value === id ? null : id;
};

const closeStatusMenu = () => {
  openStatusMenuId.value = null;
};

const alterarStatus = async (cheque, novoStatus) => {
  openStatusMenuId.value = null;
  if (cheque.status === novoStatus) return;
  try {
    const completo = await checkService.detalhes(cheque.id);
    if (novoStatus === 'Pago') chequeParaReceber.value = completo;
    else mudancaStatus.value = { cheque: completo, status: novoStatus };
  } catch (error) {
    avisarErro(error, 'Não foi possível abrir o título. Tente de novo.');
  }
};


// vem do servidor (todos os borderôs, nao so a pagina na tela): o mesmo em aberto que o limite
// do borderô confere
const totalEmAbertoGlobal = ref(0);
const totalDevolvido = ref(0);

// Computed para formatar o endereço completo em uma linha (se existir)
const enderecoCompleto = computed(() => {
  const c = cliente.value;
  if (!c.endereco && !c.cidade) return '-';
  
  let end = c.endereco || '';
  if (c.bairro) end += `, ${c.bairro}`;
  if (c.cidade) end += ` - ${c.cidade}`;
  if (c.estado) end += `/${c.estado}`;
  if (c.cep) end += ` (CEP: ${c.cep})`;
  
  return end || '-';
});


const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
const formatDate = (iso) => {
  if (!iso) return '-';
  try { return iso.split('-').reverse().join('/'); } catch (e) { return iso; }
};

const getStatusColor = (s, isAtrasado) => {
  if (s === 'Juridico') return 'bg-purple-50 text-purple-700 border-purple-200';
  
  if (isAtrasado) return 'bg-red-50 text-red-700 border-red-200';
  
  switch(s) {
    case 'Pago': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Devolvido': return 'bg-orange-50 text-orange-700 border-orange-200';
    default: return 'bg-blue-50 text-blue-700 border-blue-200';
  }
};

// o PDF leva TODOS os borderôs: busca as paginas de 50 so na hora de gerar
const todasOperacoes = async () => {
  const lista = [];
  for (let pagina = 1, paginas = 1; pagina <= paginas; pagina++) {
    const res = await operationService.getByClient(Number(route.params.id), pagina, 50);
    paginas = res.pages || 1;
    lista.push(...(res.items || []).map(op => formatarOperacao(op, hojeIso())));
  }
  return lista;
};
const dadosDoPdf = async () => ({
  empresa: empresa.value.nome,
  cnpj: empresa.value.cnpj,
  cliente: { ...cliente.value, enderecoCompleto: enderecoCompleto.value },
  operacoes: await todasOperacoes(),
  emAberto: totalEmAbertoGlobal.value,
});

const gerarRelatorioPdf = async () => {
  gerandoPdf.value = true;
  try {
    await baixarRelatorioClientePdf(await dadosDoPdf());
  } catch (e) {
    console.error(e);
    avisar('Não foi possível gerar o PDF do relatório. Tente de novo.');
  } finally {
    gerandoPdf.value = false;
  }
};

// Ficha em PDF com o cabecalho padrao (antes era a impressao da tela)
const gerandoFicha = ref(false);
const exportarFicha = async () => {
  gerandoFicha.value = true;
  try {
    await baixarFichaClientePdf(await dadosDoPdf());
  } catch (e) {
    console.error(e);
    avisar('Não foi possível gerar a ficha em PDF. Tente de novo.');
  } finally {
    gerandoFicha.value = false;
  }
};
</script>

<template>
  <DashboardLayout>
    <RecebimentoModal v-if="chequeParaReceber" :cheque="chequeParaReceber"
                      @close="chequeParaReceber = null" @confirmado="carregarTudo" />
    <StatusChequeModal v-if="mudancaStatus" :cheque="mudancaStatus.cheque" :novoStatus="mudancaStatus.status"
                       :taxaMulta="taxaMulta" @close="mudancaStatus = null" @confirmado="carregarTudo" />
    <div class="print:hidden">
      
      <div class="flex justify-between items-center mb-6">
        <div class="flex items-center gap-3">
          <button @click="router.back()" class="w-9 h-9 flex items-center justify-center bg-white border border-slate-200 shadow-xs hover:bg-slate-50 rounded-lg text-slate-500 transition-colors">
            <ArrowLeft class="w-[18px] h-[18px]" />
          </button>
          <div>
            <h1 class="text-2xl font-semibold text-slate-900 tracking-tight cursor-help" v-dica="AJUDA['/clientes/detalhe']">{{ cliente.nome }}</h1>
            <p class="text-slate-500 text-sm mt-0.5">Ficha cadastral e operacional</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button @click="exportarFicha" :disabled="loading || gerandoFicha" data-campo="ficha-cliente"
                  class="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-60 h-9 px-3.5 rounded-lg text-sm font-semibold shadow-xs flex items-center transition-colors">
            <Loader2 v-if="gerandoFicha" class="w-4 h-4 mr-2 animate-spin text-slate-500" />
            <Printer v-else class="w-4 h-4 mr-2 text-slate-500" />
            {{ gerandoFicha ? 'Gerando...' : 'Ficha PDF' }}
          </button>
          <button @click="gerarRelatorioPdf" :disabled="loading || gerandoPdf" data-campo="relatorio-cliente"
                  class="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white h-9 px-3.5 rounded-lg text-sm font-semibold shadow-xs flex items-center transition-colors">
            <Loader2 v-if="gerandoPdf" class="w-4 h-4 mr-2 animate-spin" />
            <FileDown v-else class="w-4 h-4 mr-2" />
            {{ gerandoPdf ? 'Gerando...' : 'Relatório PDF' }}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200/80">
          <div class="flex items-center gap-2.5 mb-4 text-sm font-semibold text-slate-900">
            <span class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100 flex items-center justify-center"><FileText class="w-4 h-4" /></span> Dados cadastrais
          </div>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between"><span class="text-slate-500">Documento</span> <span class="font-medium text-slate-900 tabular-nums">{{ cliente.documento }}</span></div>
            <div class="flex justify-between"><span class="text-slate-500">Telefone</span> <span class="text-slate-900">{{ cliente.telefone }}</span></div>
            <div class="flex justify-between"><span class="text-slate-500">Taxa</span> <span class="font-semibold text-indigo-600">{{ cliente.taxa }}%</span></div>
            
            <div class="pt-2 mt-2 border-t border-slate-100">
              <div class="text-slate-500 text-xs mb-1 flex items-center gap-1"><MapPin class="w-3 h-3"/> Endereço</div>
              <div class="text-slate-800 leading-tight text-xs">{{ enderecoCompleto }}</div>
            </div>
            
            <div class="pt-2 mt-2 border-t border-slate-100">
              <div class="text-slate-500 text-xs mb-1">Observações</div>
              <div class="text-slate-800 leading-tight text-xs italic">{{ cliente.obs || '-' }}</div>
            </div>
            </div>
        </div>

        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200/80">
          <div class="flex items-center gap-2.5 mb-4 text-sm font-semibold text-slate-900">
            <span class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100 flex items-center justify-center"><CreditCard class="w-4 h-4" /></span> Limite e crédito
          </div>
          <div class="mb-2">
            <span class="text-2xl font-semibold tracking-tight text-slate-900">{{ formatMoney(cliente.limite) }}</span>
            <span class="text-xs text-slate-400 ml-2">Limite</span>
          </div>
          <div class="w-full bg-slate-100 h-2.5 rounded-full mb-3 overflow-hidden">
            <div class="bg-emerald-500 h-2.5 rounded-full transition-all duration-500" 
                 :class="{'bg-red-500': cliente.limite > 0 && (totalEmAbertoGlobal/cliente.limite) > 0.9}"
                 :style="{ width: cliente.limite > 0 ? Math.min((totalEmAbertoGlobal / cliente.limite) * 100, 100) + '%' : '0%' }">
            </div>
          </div>
          <div class="flex justify-between text-xs font-medium border-t border-slate-100 pt-2.5">
            <span class="text-slate-500">Utilizado: {{ formatMoney(totalEmAbertoGlobal) }}</span>
            <span class="text-emerald-600">Disp: {{ formatMoney(cliente.limite - totalEmAbertoGlobal) }}</span>
          </div>
        </div>

        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200/80">
          <div class="flex items-center gap-2.5 mb-4 text-sm font-semibold text-slate-900">
            <span class="w-8 h-8 rounded-lg bg-red-50 text-red-600 ring-1 ring-inset ring-red-100 flex items-center justify-center"><AlertTriangle class="w-4 h-4" /></span> Pendências
          </div>
          <div v-if="totalDevolvido > 0" class="p-3 bg-red-50 rounded-lg border border-red-100 text-center">
            <div class="text-red-600 font-semibold tracking-tight text-xl">{{ formatMoney(totalDevolvido) }}</div>
            <div class="text-xs text-red-500">em devolvidos</div>
          </div>
          <div v-else class="text-emerald-700 text-sm font-medium bg-emerald-50 border border-emerald-100 rounded-lg p-3 flex items-center gap-2">
            <CheckCircle class="w-5 h-5" /> Nenhuma pendência
          </div>
        </div>

        <div v-if="reputacao" class="bg-white p-5 rounded-xl shadow-sm border border-slate-200/80" data-campo="reputacao">
          <div class="flex items-center gap-2.5 mb-2 text-sm font-semibold text-slate-900 cursor-help w-fit" v-dica="REGRA_REPUTACAO">
            <span class="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 ring-1 ring-inset ring-violet-100 flex items-center justify-center"><Award class="w-4 h-4" /></span> Reputação
          </div>
          <MedidorReputacao :reputacao="reputacao" class="mb-3" />
          <p v-if="reputacao.nota === null" class="text-xs text-slate-500 mb-3 text-center">Poucos títulos vencidos para dar uma nota ({{ reputacao.avaliados }} de 3).</p>
          <div class="space-y-1 text-xs border-t border-slate-100 pt-2.5">
            <template v-for="l in LINHAS_REPUTACAO" :key="l.id">
              <div v-if="reputacao.contagem[l.id]" class="flex justify-between">
                <span class="text-slate-500">{{ l.nome }}<template v-if="l.id === 'atrasado' && reputacao.atraso_medio_dias"> (média {{ reputacao.atraso_medio_dias }} dias)</template></span>
                <span class="font-semibold tabular-nums" :class="l.cor">{{ reputacao.contagem[l.id] }}</span>
              </div>
            </template>
            <div v-if="reputacao.contagem.a_vencer" class="flex justify-between"><span class="text-slate-400">A vencer (não contam)</span><span class="text-slate-500 tabular-nums">{{ reputacao.contagem.a_vencer }}</span></div>
          </div>
        </div>
      </div>

      <div class="flex bg-slate-100 p-1 rounded-lg gap-0.5 w-fit mb-4" role="tablist">
        <button @click="aba = 'operacoes'" role="tab" :aria-selected="aba === 'operacoes'"
                class="px-4 py-1.5 text-[13px] font-semibold rounded-md flex items-center gap-2 transition-all"
                :class="aba === 'operacoes' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'">
          <FileText class="w-4 h-4" /> Operações
        </button>
        <button @click="aba = 'notas'" role="tab" :aria-selected="aba === 'notas'" data-campo="aba-notas"
                class="px-4 py-1.5 text-[13px] font-semibold rounded-md flex items-center gap-2 transition-all"
                :class="aba === 'notas' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'">
          <StickyNote class="w-4 h-4" /> Notas
          <span v-if="totalNotas" class="px-1.5 min-w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold inline-flex items-center justify-center tabular-nums">{{ totalNotas }}</span>
        </button>
      </div>

      <ClienteNotas v-if="cliente.id" v-show="aba === 'notas'" :cliente-id="cliente.id" @total="totalNotas = $event" />

      <div v-show="aba === 'operacoes'" class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="font-semibold text-slate-900 text-base">Histórico de operações</h3>
          <span v-if="totalOps" class="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium tabular-nums">{{ totalOps }} borderô{{ totalOps === 1 ? '' : 's' }}</span>
        </div>

        <div v-if="loading" class="text-center py-10 text-slate-400 flex flex-col items-center">
          <Loader2 class="w-8 h-8 animate-spin mb-2 text-indigo-500" />
          Carregando dados...
        </div>

        <div v-else-if="operacoesDoCliente.length === 0" class="text-center py-10 bg-white rounded-xl border border-dashed border-slate-300 text-slate-400 text-sm">
          Nenhuma operação registrada para este cliente.
        </div>

        <div v-for="op in operacoesDoCliente" :key="op.id" class="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-visible transition-all duration-300">
          
          <div @click="toggleOp(op.id)" class="px-5 py-4 flex items-center justify-between cursor-pointer rounded-xl hover:bg-slate-50/70 transition-colors">
            
            <div class="flex items-center gap-4">
              <div class="p-2 rounded-lg" :class="op.statusGeral === 'Concluída' ? 'bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100' : (op.temAtraso ? 'bg-red-50 text-red-600 ring-1 ring-inset ring-red-100' : 'bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100')">
                <FileText class="w-5 h-5" />
              </div>
              <div>
                <h4 class="font-semibold text-slate-900">Operação #{{ op.id }}</h4>
                <div class="text-xs text-slate-500 flex gap-2">
                  <span class="flex items-center gap-1"><Clock class="w-3 h-3" /> {{ formatDate(op.data) }}</span>
                  <span>•</span>
                  <span>{{ op.cheques ? op.cheques.length : 0 }} Cheques</span>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-4">
              <div class="text-right mr-2">
                <div class="text-xs text-slate-500">Total da operação</div>
                <div class="font-semibold text-slate-900 tabular-nums">{{ formatMoney(op.total) }}</div>
              </div>
              
              <div v-if="op.temAtraso && op.statusGeral !== 'Concluída'" class="px-2 py-0.5 rounded-md text-xs font-medium border bg-red-50 text-red-700 border-red-200 flex items-center gap-1">
                <AlertTriangle class="w-3 h-3" /> Atraso
              </div>

              <div class="px-2 py-0.5 rounded-md text-xs font-medium border" 
                   :class="op.statusGeral === 'Concluída' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'">
                {{ op.statusGeral }}
              </div>

              <div class="text-slate-400">
                <ChevronUp v-if="expandedOps.includes(op.id)" class="w-5 h-5" />
                <ChevronDown v-else class="w-5 h-5" />
              </div>
            </div>
          </div>

          <div v-if="expandedOps.includes(op.id)" class="border-t border-slate-100 bg-slate-50/60 p-4 animate-fade-in-down">
            <table class="w-full text-left text-sm bg-white rounded-lg shadow-xs overflow-visible border border-slate-200">
              <thead class="bg-slate-50 text-slate-500 text-xs font-medium border-b border-slate-200">
                <tr>
                  <th class="px-4 py-2">Vencimento</th>
                  <th class="px-4 py-2">Banco / Doc</th>
                  <th class="px-4 py-2">Emitente</th>
                  <th class="px-4 py-2 text-right">Valor</th>
                  <th class="px-4 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="cheque in op.cheques" :key="cheque.id" class="hover:bg-slate-50 transition-colors">
                  <td class="px-4 py-3 tabular-nums" :class="cheque.isAtrasado ? 'text-red-600 font-semibold' : 'text-slate-600'">
                    {{ formatDate(cheque.vencimento) }}
                    <span v-if="cheque.isAtrasado" class="text-[10px] ml-1">(!)</span>
                  </td>
                  <td class="px-4 py-3 text-slate-600">{{ cheque.banco }} - {{ cheque.num_doc }}</td>
                  <td class="px-4 py-3 text-slate-900 font-medium">{{ cheque.emitente }}</td>
                  <td class="px-4 py-3 text-right font-semibold text-slate-900 tabular-nums">{{ formatMoney(cheque.valor) }}</td>
                  
                  <td class="px-4 py-3 text-center relative">
                    <button 
                      @click="toggleStatusMenu(cheque.id, $event)"
                      :class="['pl-2 pr-1.5 py-0.5 rounded-md text-xs font-medium border flex items-center gap-1.5 mx-auto transition-all w-fit before:w-1.5 before:h-1.5 before:rounded-full before:bg-current before:opacity-80', getStatusColor(cheque.status, cheque.isAtrasado)]"
                    >
                      {{ cheque.isAtrasado ? 'Atrasado' : cheque.status }} <ChevronDown class="w-3 h-3 opacity-50" />
                    </button>

                    <div v-if="openStatusMenuId === cheque.id" class="absolute right-0 mt-1.5 w-36 bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden text-left animate-scale-in p-1">
                      <div v-for="opt in statusOptions" :key="opt" 
                           @click.stop="alterarStatus(cheque, opt)"
                           class="px-2.5 py-1.5 text-[13px] font-medium rounded-md hover:bg-slate-100 cursor-pointer text-slate-700 flex justify-between items-center">
                        {{ opt }}
                        <Check v-if="cheque.status === opt" class="w-3 h-3 text-emerald-500" />
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>

        <div v-if="totalPaginasOps > 1" class="flex items-center justify-between text-xs text-slate-500 pt-1" data-campo="paginas-borderos">
          <span class="tabular-nums">Página {{ paginaOps }} de {{ totalPaginasOps }}</span>
          <div class="flex items-center gap-1.5">
            <Loader2 v-if="carregandoOps" class="w-4 h-4 animate-spin text-slate-400" />
            <button @click="carregarOperacoes(paginaOps - 1)" :disabled="paginaOps <= 1 || carregandoOps"
                    class="h-8 px-3 bg-white border border-slate-300 rounded-lg shadow-xs text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-40">Mais novos</button>
            <button @click="carregarOperacoes(paginaOps + 1)" :disabled="paginaOps >= totalPaginasOps || carregandoOps"
                    class="h-8 px-3 bg-white border border-slate-300 rounded-lg shadow-xs text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-40">Mais antigos</button>
          </div>
        </div>
      </div>
    </div>

  </DashboardLayout>
</template>

<style scoped>
.animate-fade-in-down { animation: fadeInDown 0.3s ease-out forwards; }
.animate-scale-in { animation: scaleIn 0.15s ease-out forwards; }

@keyframes fadeInDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }


</style>