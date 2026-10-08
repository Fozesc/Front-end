<script setup>
import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue';
import DashboardLayout from '../layouts/DashboardLayout.vue';
import {
  Plus, Trash2, Save, ArrowLeft, Printer, Calculator,
  AlertTriangle, CheckCircle, Loader2, Building2, CalendarClock, X
} from 'lucide-vue-next';
import { useRouter } from 'vue-router';
import operationService from '../services/operationService';
import checkService from '../services/checkService';
import ClientSelect from '../components/inputs/ClientSelect.vue';
import api from '../services/api';
import { motivoNaoUtil, proximoDiaUtil } from '../utils/diasUteis';
import { CONTAS } from '../utils/contasCaixa';
import {
  arredondar, calcularDias, calcularLinha, calcularComissao, divisorInverso, iofDasConfiguracoes,
  IOF_BASE_PADRAO, IOF_DIARIO_PADRAO, DIAS_COMPENSACAO_PADRAO
} from '../utils/calculoBordero';

const router = useRouter();

// Estilo dos campos da tela num lugar so (todos com a mesma altura).
const rotulo = 'block text-[13px] font-medium text-slate-700 mb-1.5';
const campo = 'h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-xs outline-none transition-shadow placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 disabled:bg-slate-50 disabled:text-slate-400';
const campoTabela = 'h-8 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none transition-shadow placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15';
const segmento = (ativo) => ['flex-1 px-3 rounded-[5px] text-[13px] font-medium transition-colors whitespace-nowrap',
  ativo ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800'];

const emitidoEm = ref(new Date());
const loading = ref(false);

const selectedCompany = ref('Fozesc');
const lastOperationId = ref(null); 
const nextOperationId = ref('...'); 

const limitModal = reactive({ visible: false, message: '', overAmount: 0, onConfirm: null });
const modalState = reactive({ visible: false, title: '', message: '', type: 'success' });

const showPopup = (title, message, type = 'success') => {
  modalState.title = title;
  modalState.message = message;
  modalState.type = type;
  modalState.visible = true;
};

const itens = ref([]);

const header = reactive({
  clienteId: null,
  clienteNome: '',
  clienteDocumento: '',
  clienteTelefone: '',
  clienteLimite: 0,      
  clienteDivida: 0,      
  emitenteNome: '',
  dataOperacao: new Date().toISOString().split('T')[0],
  taxaMensal: 4.00,
  diasCompensacao: DIAS_COMPENSACAO_PADRAO,
  comissao: 0,
  contaSaida: 'Dinheiro',
  observacao: '',
  // --- CAMPOS IOF ---
  iofEnabled: true,
  iofBase: IOF_BASE_PADRAO,   // IOF Adicional Fixo (%)
  iofDiario: IOF_DIARIO_PADRAO // IOF Diário (%)
});

// Cheque nao compensa em fim de semana nem feriado. Por padrao a parcela que cai
// nesses dias e adiada para o proximo dia util, mas da para recusar e manter a data.
const ajustarDiaUtil = ref(true);
const avisoDiaUtil = ref(null);

const gerador = reactive({
  modo: 'valor_mao', 
  valorAlvo: 0, 
  qtdParcelas: 1,
  primeiroVencimento: '',
  intervaloTipo: 'mensal',
  diasIntervalo: 30
});

// Sugestao de emitente: o nome vem do que ja existe no banco, os mais usados
// primeiro. E' `<datalist>` nativo - nao precisa de componente de autocomplete.
// Motivo: nome digitado diferente do mesmo emitente foi o que deu todo o trabalho
// na importacao da planilha (nome curto x a mesma pessoa com o nome completo).
const emitentesSugeridos = ref([]);
const emitenteNovo = ref(false);
let timeoutEmitente = null;

const buscarEmitentes = () => {
  emitenteNovo.value = false;   // enquanto digita nao avisa nada
  clearTimeout(timeoutEmitente);
  timeoutEmitente = setTimeout(async () => {
    try {
      emitentesSugeridos.value = await checkService.emitentes((header.emitenteNome || '').trim());
    } catch (e) {
      emitentesSugeridos.value = [];
    }
  }, 300);
};

// O aviso de "nome novo" so aparece quando ele SAI do campo - avisar a cada tecla
// seria chato e apareceria em todo nome pela metade.
const conferirEmitente = async () => {
  const termo = (header.emitenteNome || '').trim();
  if (termo.length < 3) { emitenteNovo.value = false; return; }
  try {
    const achados = await checkService.emitentes(termo);
    emitenteNovo.value = !achados.some(n => n.toLowerCase() === termo.toLowerCase());
  } catch (e) {
    emitenteNovo.value = false;
  }
};

const fetchSettings = async () => {
  try {
    const { data } = await api.get('/settings/');
    if (data) {
      const { iofBase, iofDiario } = iofDasConfiguracoes(data);
      header.iofBase = iofBase;
      header.iofDiario = iofDiario;
    }
  } catch (error) {
    console.error("Usando IOF padrão (Fixo: 0.38% / Diário: 0.0041%)");
  }
};

onMounted(async () => {
  const hoje = new Date();
  hoje.setDate(hoje.getDate() + 30);
  gerador.primeiroVencimento = hoje.toISOString().split('T')[0];
  
  await fetchSettings(); 
  adicionarLinha(); 
});

const fetchNextId = async () => {
  try {
    const res = await operationService.getAll({ 
      page: 1, per_page: 1, sort_by: 'id', sort_order: 'desc' 
    });
    if (res.items && res.items.length > 0) {
      nextOperationId.value = res.items[0].id + 1;
    } else {
      nextOperationId.value = res.total ? res.total + 1 : 1;
    }
  } catch (e) {
    nextOperationId.value = '---';
  }
};

const selecionarCliente = (cliente) => {
  if (!cliente) {
    header.clienteId = null; header.clienteNome = '';
    header.clienteDocumento = ''; header.clienteTelefone = '';
    header.clienteLimite = 0; header.clienteDivida = 0;
    return;
  }
  header.clienteId = cliente.id;
  header.clienteNome = cliente.name;
  header.clienteDocumento = cliente.document || '';
  header.clienteTelefone = cliente.phone || '';
  if (cliente.standard_rate) header.taxaMensal = cliente.standard_rate;
  header.clienteLimite = cliente.credit_limit || 0;
  header.clienteDivida = cliente.valor_em_aberto || 0; 
  if (!header.emitenteNome) header.emitenteNome = cliente.name;
  recalcularTudo();
};

const totais = computed(() => {
  return itens.value.reduce((acc, item) => {
    acc.bruto += Number(item.valor || 0); 
    acc.juros += Number(item.juros || 0); 
    acc.iof += Number(item.iof || 0); 
    acc.liquido += Number(item.liquido || 0); 
    return acc;
  }, { bruto: 0, juros: 0, iof: 0, liquido: 0 });
});

// prazo medio ponderado pelo valor de cada cheque (vai no documento impresso)
const prazoMedio = computed(() => {
  const bruto = totais.value.bruto;
  return bruto > 0 ? Math.round(itens.value.reduce((t, i) => t + Number(i.valor || 0) * Number(i.dias || 0), 0) / bruto) : 0;
});
const nomeConta = (id) => CONTAS.find(c => c.id === id)?.nome || id;
const emissao = computed(() => emitidoEm.value.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }));

const comissaoInvalida = computed(() => {
  const c = Number(header.comissao || 0);
  return !(c >= 0 && c <= Number(header.taxaMensal || 0));
});
// invalida conta como zero: totais e impressao nao mostram numero que nao vai ser gravado
const comissao = computed(() => (comissaoInvalida.value ? { valor: 0, parte: 0 } : calcularComissao({
  juros: totais.value.juros, comissao: header.comissao, taxaMensal: header.taxaMensal
})));
const parteDosJuros = computed(() =>
  `${comissao.value.parte.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);

const recalcularLinha = (item) => {
  item.dias = calcularDias(header.dataOperacao, item.vencimento, header.diasCompensacao);
  const { juros, iof, liquido } = calcularLinha({
    valor: item.valor, dias: item.dias, taxaMensal: header.taxaMensal,
    iofEnabled: header.iofEnabled, iofBase: header.iofBase, iofDiario: header.iofDiario
  });
  item.juros = juros;
  item.iof = iof;
  item.liquido = liquido;
};

const recalcularTudo = () => { itens.value.forEach(recalcularLinha); };
watch(() => [header.dataOperacao, header.taxaMensal, header.diasCompensacao, header.iofEnabled, header.iofBase], () => recalcularTudo());

const gerarParcelas = () => {
  if (!(Number(gerador.valorAlvo) > 0) || !(Number(gerador.qtdParcelas) >= 1)) {
    return showPopup('Atenção', 'Informe o valor e a quantidade de parcelas.', 'error');
  }
  if (!gerador.primeiroVencimento) return showPopup('Atenção', 'Informe o 1º vencimento.', 'error');
  if (gerador.intervaloTipo === 'dias' && !(Number(gerador.diasIntervalo) >= 1)) {
    return showPopup('Atenção', 'Informe de quantos em quantos dias são as parcelas.', 'error');
  }
  const datas = [];
  let [anoInicial, mesInicial, diaInicial] = gerador.primeiroVencimento.split('-').map(Number);
  
  for (let i = 0; i < gerador.qtdParcelas; i++) {
    let ano = anoInicial;
    let mes = mesInicial;
    let dia = diaInicial;

    if (gerador.intervaloTipo === 'mensal') {
      mes = mesInicial + i;
      while (mes > 12) { mes -= 12; ano++; }
      const ultimoDiaMes = new Date(ano, mes, 0).getDate();
      if (dia > ultimoDiaMes) dia = ultimoDiaMes;
    } else {
      const d = new Date(Date.UTC(anoInicial, mesInicial - 1, diaInicial));
      d.setUTCDate(d.getUTCDate() + (i * Number(gerador.diasIntervalo)));
      ano = d.getUTCFullYear(); mes = d.getUTCMonth() + 1; dia = d.getUTCDate();
    }
    const dataIso = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    datas.push(dataIso);
  }

  // O ajuste de dia util entra AQUI, antes de calcular o valor da parcela: no modo
  // Liquido o valor sai dos dias de cada data (somaDivisores logo abaixo), entao
  // mudar a data depois faria o liquido nao bater com o valor pedido pelo cliente.
  const ajustes = [];
  datas.forEach((data, i) => {
    const motivo = motivoNaoUtil(data);
    if (!motivo) return;
    const novaData = ajustarDiaUtil.value ? proximoDiaUtil(data) : null;
    if (novaData) datas[i] = novaData;
    ajustes.push({ parcela: i + 1, de: data, para: novaData, motivo });
  });
  const ajustePorParcela = new Map(ajustes.map(a => [a.parcela, a]));

  // liquido de cada cheque = valor x divisor da data: divisor <= 0 e' juros + IOF maior que
  // o proprio cheque (prazo longo demais para a taxa). Antes isso gerava cheque negativo.
  const diasAte = (dataVenc) => calcularDias(header.dataOperacao, dataVenc, header.diasCompensacao);
  const divisores = datas.map(dataVenc => divisorInverso({
    dias: diasAte(dataVenc), taxaMensal: header.taxaMensal,
    iofEnabled: header.iofEnabled, iofBase: header.iofBase, iofDiario: header.iofDiario
  }));
  const longe = divisores.findIndex(d => !(d > 0));
  if (longe >= 0) {
    return showPopup('Prazo longo demais',
      `Com ${virgula(header.taxaMensal)}% a.m., o cheque de ${dataBR(datas[longe])} (${diasAte(datas[longe])} dias) `
      + 'teria juros e IOF maiores que o próprio valor. Use menos parcelas ou um prazo menor.', 'error');
  }

  const valorParcelaBruta = gerador.modo === 'valor_mao'
    ? arredondar(gerador.valorAlvo / divisores.reduce((soma, d) => soma + d, 0))
    : arredondar(gerador.valorAlvo / gerador.qtdParcelas);

  avisoDiaUtil.value = ajustes.length
    ? { ajustado: ajustarDiaUtil.value, itens: ajustes }
    : null;
  itens.value = [];
  for (let i = 0; i < gerador.qtdParcelas; i++) {
    const a = ajustePorParcela.get(i + 1);
    const novoItem = {
      id: Date.now() + i,
      vencimento: datas[i],
      valor: valorParcelaBruta,
      dias: 0, juros: 0, iof: 0, liquido: 0, banco: '', num_doc: `${i + 1}/${gerador.qtdParcelas}`,
      // de onde a data veio, quando foi adiada (a linha mostra "era 25/12 - Natal")
      ajuste: a && a.para ? { de: a.de, motivo: a.motivo } : null
    };
    itens.value.push(novoItem);
  }
  recalcularTudo();
};

// Liga/desliga o adiamento e gera as parcelas de novo - tem que regerar porque o
// valor da parcela depende dos dias ate o vencimento.
const trocarAjusteDiaUtil = () => {
  ajustarDiaUtil.value = !ajustarDiaUtil.value;
  gerarParcelas();
};

// Data escolhida a mao manda: o aviso do gerador deixa de valer.
const alterarVencimento = (item) => {
  item.ajuste = null;
  avisoDiaUtil.value = null;
  recalcularLinha(item);
};

const dataBR = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
const virgula = (n) => String(n ?? '').replace('.', ',');

const adicionarLinha = () => { itens.value.push({ id: Date.now(), vencimento: '', valor: 0, dias: 0, juros: 0, iof: 0, liquido: 0, banco: '', num_doc: '', ajuste: null }); };
const removerLinha = (index) => { itens.value.splice(index, 1); avisoDiaUtil.value = null; recalcularTudo(); };
const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

const exportarBordero = async () => {
  emitidoEm.value = new Date();
  await nextTick();
  window.print();
};

const verificarLimiteESalvar = () => {
  if (!header.clienteId) return showPopup('Atenção', 'Selecione um cliente válido.', 'error');
  if (!header.emitenteNome) return showPopup('Atenção', 'Informe o emitente.', 'error');
  if (itens.value.length === 0 || totais.value.bruto <= 0) return showPopup('Atenção', 'Borderô vazio.', 'error');
  if (itens.value.some(i => !i.vencimento)) return showPopup('Erro', 'Datas inválidas.', 'error');
  const zerado = itens.value.findIndex(i => !(Number(i.valor) > 0) || !(Number(i.liquido) > 0));
  if (zerado >= 0) return showPopup('Atenção', `O cheque ${zerado + 1} está com valor ou líquido zerado/negativo (juros maiores que o cheque). Corrija antes de efetivar.`, 'error');
  if (comissaoInvalida.value) return showPopup('Atenção', `A comissão tem que ficar entre 0 e a taxa (${header.taxaMensal}%).`, 'error');

  const novoRisco = totais.value.bruto;
  const dividaTotalFutura = header.clienteDivida + novoRisco;
  const limite = header.clienteLimite;

  if (limite > 0 && dividaTotalFutura > limite) {
    limitModal.message = `Esta operação fará o cliente exceder o limite de crédito.`;
    limitModal.overAmount = dividaTotalFutura - limite;
    limitModal.visible = true;
    limitModal.onConfirm = processarSalvamento;
    return;
  }
  processarSalvamento();
};

const processarSalvamento = async () => {
  limitModal.visible = false;
  loading.value = true;
  try {
    const payload = {
      client_id: header.clienteId,
      operation_date: header.dataOperacao,
      taxa_mensal: header.taxaMensal,
      dias_compensacao: header.diasCompensacao,
      account_source: header.contaSaida,
      iof_amount: totais.value.iof,
      total_net: totais.value.liquido, // valor realmente emprestado (o que sai do caixa) = face - juros - IOF
      notes: header.observacao,
      comissao: Number(header.comissao) || 0,
      // o servidor grava exatamente estes centavos (depois de conferir com a mesma conta)
      iof_enabled: header.iofEnabled,
      iof_base: header.iofBase,
      iof_diario: header.iofDiario,
      checks: itens.value.map(item => ({
        valor: item.valor, vencimento: item.vencimento,
        juros: item.juros, iof: item.iof, liquido: item.liquido,
        banco: item.banco || '', num_doc: item.num_doc || '', emitente: header.emitenteNome
      }))
    };
    const resposta = await operationService.create(payload);

    lastOperationId.value = resposta.id; 

    await exportarBordero(); 
    
    showPopup('Sucesso!', `Operação #${resposta.id} realizada!\nLíquido: ${formatCurrency(resposta.total_net)}`
      + (resposta.comissao_valor > 0 ? `\nComissão: ${formatCurrency(resposta.comissao_valor)}` : ''));
    
    itens.value = [];
    adicionarLinha();
    gerador.valorAlvo = 0;
    header.clienteId = null; header.clienteNome = '';
    header.clienteDocumento = ''; header.clienteTelefone = '';
    header.clienteLimite = 0; header.clienteDivida = 0;
    header.comissao = 0;

    lastOperationId.value = null; 
    fetchNextId(); 

  } catch (error) {
    showPopup('Erro', error.response?.data?.error || "Erro ao salvar.", 'error');
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <DashboardLayout>

    <div v-if="limitModal.visible" class="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"></div>
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-md relative z-10 p-6 text-center animate-scale-in">
        <div class="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle class="w-6 h-6 text-amber-600" /></div>
        <h3 class="text-lg font-semibold text-slate-900 mb-1">Limite de crédito excedido</h3>
        <p class="text-slate-600 text-sm mb-4">{{ limitModal.message }}</p>
        <div class="bg-amber-50 border border-amber-200/80 rounded-lg p-4 mb-6 text-left">
          <div class="flex justify-between text-sm mb-1"><span class="text-amber-800">Limite atual</span><span class="font-bold text-amber-900 tabular-nums">{{ formatCurrency(header.clienteLimite) }}</span></div>
          <div class="flex justify-between text-sm mb-1"><span class="text-amber-800">Dívida + este borderô</span><span class="font-bold text-amber-900 tabular-nums">{{ formatCurrency(header.clienteDivida + totais.bruto) }}</span></div>
          <div class="border-t border-amber-200 my-2"></div>
          <div class="flex justify-between text-base font-bold text-red-600"><span>Excesso</span><span class="tabular-nums">+ {{ formatCurrency(limitModal.overAmount) }}</span></div>
        </div>
        <div class="flex gap-3 justify-center">
          <button @click="limitModal.visible = false" class="flex-1 h-10 px-4 bg-white border border-slate-300 text-slate-700 font-semibold text-sm rounded-md shadow-xs hover:bg-slate-50">Cancelar</button>
          <button @click="limitModal.onConfirm" class="flex-1 h-10 px-4 bg-red-600 text-white font-semibold text-sm rounded-md hover:bg-red-700 shadow-xs">Efetivar mesmo assim</button>
        </div>
      </div>
    </div>

    <div v-if="modalState.visible" class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
      <div class="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full text-center animate-scale-in">
        <div :class="['mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4', modalState.type === 'error' ? 'bg-red-100' : 'bg-emerald-100']">
          <CheckCircle v-if="modalState.type === 'success'" class="h-6 w-6 text-emerald-600" /><AlertTriangle v-else class="h-6 w-6 text-red-600" />
        </div>
        <h3 class="text-lg font-semibold text-slate-900 mb-1">{{ modalState.title }}</h3>
        <p class="text-slate-500 text-sm mb-6 whitespace-pre-line">{{ modalState.message }}</p>
        <button @click="modalState.visible = false" :class="['w-full h-10 px-4 rounded-md text-white font-semibold text-sm shadow-xs', modalState.type === 'error' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700']">Entendido</button>
      </div>
    </div>

    <div class="print:hidden space-y-4">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div class="flex items-center gap-3">
          <button @click="router.back()" aria-label="Voltar" class="w-9 h-9 flex items-center justify-center bg-white border border-slate-300 shadow-xs hover:bg-slate-50 rounded-md text-slate-500"><ArrowLeft class="w-[18px] h-[18px]" /></button>
          <div>
            <h1 class="text-2xl font-semibold text-slate-900 tracking-tight">Cálculo de Borderô</h1>
            <p class="text-slate-500 text-sm mt-0.5">Novo borderô de cheques ou antecipação.</p>
          </div>
        </div>
        <div class="flex gap-2 items-center">
          <div class="relative">
            <select v-model="selectedCompany" aria-label="Empresa do borderô"
                    class="appearance-none h-9 pl-3 pr-9 bg-white border border-slate-300 rounded-md text-sm font-semibold text-slate-700 shadow-xs outline-none cursor-pointer focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15">
              <option value="Fozesc">Fozesc</option>
              <option value="PQ">PQ</option>
            </select>
            <Building2 class="w-4 h-4 absolute right-3 top-2.5 text-slate-400 pointer-events-none" />
          </div>
          <button @click="exportarBordero" class="h-9 px-3.5 bg-white border border-slate-300 rounded-md text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 flex items-center gap-2"><Printer class="w-4 h-4 text-slate-500" /> Simular</button>
          <button @click="verificarLimiteESalvar" :disabled="loading" class="h-9 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-semibold shadow-xs flex items-center gap-2 disabled:opacity-60">
            <Loader2 v-if="loading" class="w-4 h-4 animate-spin" /><Save v-else class="w-4 h-4" /> Efetivar
          </button>
        </div>
      </div>

      <section class="bg-white border border-slate-200 rounded-lg shadow-xs relative z-30">
        <header class="px-5 py-3 border-b border-slate-200">
          <h2 class="text-sm font-semibold text-slate-900">Dados da operação</h2>
          <p class="text-xs text-slate-500">Cliente, condições do borderô e de onde sai o dinheiro.</p>
        </header>
        <div class="p-5 space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-4">
            <div class="relative xl:col-span-5">
              <ClientSelect v-model="header.clienteId" @select="selecionarCliente" />
              <div v-if="header.clienteId && header.clienteLimite > 0" class="absolute right-0 top-0 text-xs font-medium text-slate-500">
                Disponível: <span class="tabular-nums" :class="header.clienteLimite - header.clienteDivida < 0 ? 'text-red-600' : 'text-emerald-600'">{{ formatCurrency(header.clienteLimite - header.clienteDivida) }}</span>
              </div>
            </div>
            <div class="xl:col-span-5">
              <label for="bordero-emitente" :class="rotulo">Emitente do cheque</label>
              <input id="bordero-emitente" type="text" v-model="header.emitenteNome" @input="buscarEmitentes" @focus="buscarEmitentes"
                     @blur="conferirEmitente" list="emitentes-ja-usados" autocomplete="off"
                     placeholder="Quem assinou o cheque..." :class="campo" />
              <datalist id="emitentes-ja-usados">
                <option v-for="nome in emitentesSugeridos" :key="nome" :value="nome" />
              </datalist>
              <p v-if="emitenteNovo" class="text-xs text-amber-700 font-medium mt-1.5 flex items-center gap-1">
                <AlertTriangle class="w-3 h-3 shrink-0" /> Emitente novo — confira se não é um já cadastrado escrito diferente.
              </p>
            </div>
            <div class="xl:col-span-2">
              <label for="bordero-data" :class="rotulo">Data da operação</label>
              <input id="bordero-data" type="date" v-model="header.dataOperacao" :class="campo" />
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 items-start">
            <div>
              <label for="bordero-taxa" :class="rotulo">Taxa</label>
              <div class="relative">
                <input id="bordero-taxa" type="number" step="0.01" min="0" v-model="header.taxaMensal" :class="[campo, 'pr-14 font-semibold tabular-nums']" />
                <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 pointer-events-none">% a.m.</span>
              </div>
            </div>
            <div>
              <label for="bordero-compensacao" :class="rotulo">Compensação</label>
              <div class="relative">
                <input id="bordero-compensacao" type="number" min="0" v-model="header.diasCompensacao" :class="[campo, 'pr-12 font-semibold tabular-nums']" />
                <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 pointer-events-none">dias</span>
              </div>
            </div>
            <div>
              <label for="bordero-comissao" :class="rotulo" title="Quantos pontos da taxa vão para a comissão. Ex.: 2 de 8% = 25% dos juros">Comissão</label>
              <div class="relative">
                <input id="bordero-comissao" type="number" step="0.01" min="0" :max="header.taxaMensal" v-model="header.comissao" placeholder="0"
                       data-campo="comissao" aria-describedby="bordero-comissao-ajuda" :aria-invalid="comissaoInvalida"
                       :class="[campo, 'pr-14 font-semibold tabular-nums', comissaoInvalida ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15' : '']" />
                <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 pointer-events-none">de {{ virgula(header.taxaMensal) }}%</span>
              </div>
              <p id="bordero-comissao-ajuda" class="text-[11px] font-medium mt-1" :class="comissaoInvalida ? 'text-red-600' : 'text-violet-700'">
                <template v-if="comissaoInvalida">Máximo {{ virgula(header.taxaMensal) }} (a taxa)</template>
                <template v-else-if="comissao.parte">{{ parteDosJuros }} dos juros · sai do caixa hoje</template>
              </p>
            </div>
            <div>
              <span id="bordero-iof" :class="rotulo">IOF</span>
              <button type="button" role="switch" :aria-checked="header.iofEnabled" aria-labelledby="bordero-iof" @click="header.iofEnabled = !header.iofEnabled"
                      :title="header.iofEnabled ? `Cobrando IOF de ${virgula(header.iofBase)}% + ${virgula(header.iofDiario)}% ao dia` : 'Sem IOF neste borderô'"
                      class="h-10 w-full flex items-center gap-2.5 px-3 rounded-md border shadow-xs text-sm font-medium transition-colors outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/15"
                      :class="header.iofEnabled ? 'border-orange-300 bg-orange-50/60 text-orange-800' : 'border-slate-300 bg-white text-slate-500 hover:bg-slate-50'">
                <span class="relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors" :class="header.iofEnabled ? 'bg-orange-500' : 'bg-slate-300'">
                  <span class="absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform" :class="header.iofEnabled ? 'translate-x-3' : ''"></span>
                </span>
                <span class="truncate tabular-nums">{{ header.iofEnabled ? `${virgula(header.iofBase)}%` : 'Não' }}</span>
              </button>
            </div>
            <div class="col-span-2">
              <span id="bordero-conta" :class="rotulo">Conta de saída</span>
              <div class="flex h-10 gap-0.5 p-0.5 rounded-md border border-slate-300 bg-slate-50" role="radiogroup" aria-labelledby="bordero-conta">
                <button v-for="c in CONTAS" :key="c.id" type="button" role="radio" :aria-checked="header.contaSaida === c.id" @click="header.contaSaida = c.id"
                        :class="[segmento(header.contaSaida === c.id), 'flex items-center justify-center gap-1.5']" :title="c.nome">
                  <component :is="c.icone" class="w-3.5 h-3.5" /> {{ c.curto }}
                </button>
              </div>
            </div>
          </div>

          <div>
            <label for="bordero-obs" :class="rotulo">Observações <span class="font-normal text-slate-400">(opcional)</span></label>
            <textarea id="bordero-obs" v-model="header.observacao" rows="2" placeholder="Notas sobre esta negociação..."
                      class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs outline-none resize-y transition-shadow placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"></textarea>
          </div>
        </div>
      </section>

      <section class="bg-white border border-slate-200 rounded-lg shadow-xs relative z-10">
        <header class="px-5 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold text-slate-900">Gerar parcelas</h2>
            <p class="text-xs text-slate-500">
              {{ gerador.modo === 'valor_mao'
                ? 'Pelo líquido: informe quanto o cliente recebe e o sistema calcula o valor dos cheques.'
                : 'Pelo bruto: informe a soma dos cheques e o sistema divide em parcelas iguais.' }}
            </p>
          </div>
          <div class="flex h-9 w-full sm:w-56 gap-0.5 p-0.5 rounded-md border border-slate-300 bg-slate-50" role="radiogroup" aria-label="Calcular pelo">
            <button type="button" role="radio" :aria-checked="gerador.modo === 'valor_mao'" @click="gerador.modo = 'valor_mao'" :class="segmento(gerador.modo === 'valor_mao')">Pelo líquido</button>
            <button type="button" role="radio" :aria-checked="gerador.modo === 'valor_bruto'" @click="gerador.modo = 'valor_bruto'" :class="segmento(gerador.modo === 'valor_bruto')">Pelo bruto</button>
          </div>
        </header>
        <div class="p-5 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-12 gap-4 items-end">
          <div class="col-span-2 xl:col-span-3">
            <label for="gerador-valor" :class="rotulo">{{ gerador.modo === 'valor_mao' ? 'Líquido para o cliente' : 'Soma dos cheques' }}</label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400 pointer-events-none">R$</span>
              <input id="gerador-valor" type="number" step="0.01" min="0" v-model="gerador.valorAlvo" @keyup.enter="gerarParcelas" placeholder="0,00" :class="[campo, 'pl-9 font-semibold tabular-nums']" />
            </div>
          </div>
          <div class="xl:col-span-1">
            <label for="gerador-qtd" :class="rotulo">Parcelas</label>
            <input id="gerador-qtd" type="number" min="1" v-model="gerador.qtdParcelas" @keyup.enter="gerarParcelas" :class="[campo, 'text-center font-semibold tabular-nums']" />
          </div>
          <div class="xl:col-span-2">
            <label for="gerador-venc" :class="rotulo">1º vencimento</label>
            <input id="gerador-venc" type="date" v-model="gerador.primeiroVencimento" @keyup.enter="gerarParcelas" :class="campo" />
          </div>
          <div class="col-span-2 xl:col-span-3">
            <span id="gerador-intervalo" :class="rotulo">Intervalo</span>
            <div class="flex gap-2">
              <div class="flex h-10 flex-1 gap-0.5 p-0.5 rounded-md border border-slate-300 bg-slate-50" role="radiogroup" aria-labelledby="gerador-intervalo">
                <button type="button" role="radio" :aria-checked="gerador.intervaloTipo === 'mensal'" @click="gerador.intervaloTipo = 'mensal'" :class="segmento(gerador.intervaloTipo === 'mensal')">Mensal</button>
                <button type="button" role="radio" :aria-checked="gerador.intervaloTipo === 'dias'" @click="gerador.intervaloTipo = 'dias'" :class="segmento(gerador.intervaloTipo === 'dias')">Dias</button>
              </div>
              <div v-if="gerador.intervaloTipo === 'dias'" class="relative w-20 shrink-0">
                <input type="number" min="1" v-model="gerador.diasIntervalo" @keyup.enter="gerarParcelas" aria-label="Dias entre as parcelas" data-campo="dias-intervalo" :class="[campo, 'pr-10 text-right font-semibold tabular-nums']" />
                <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 pointer-events-none">dias</span>
              </div>
            </div>
          </div>
          <div class="col-span-2 xl:col-span-3">
            <button type="button" @click="gerarParcelas" class="h-10 w-full rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-xs flex items-center justify-center gap-2 transition-colors active:scale-[0.99]">
              <Calculator class="w-4 h-4" /> Gerar parcelas
            </button>
          </div>
        </div>
      </section>

      <div v-if="avisoDiaUtil" class="rounded-lg border px-4 py-3 flex flex-col md:flex-row md:items-start gap-3"
           :class="avisoDiaUtil.ajustado ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'">
        <CalendarClock class="w-[18px] h-[18px] mt-0.5 shrink-0" :class="avisoDiaUtil.ajustado ? 'text-amber-600' : 'text-slate-500'" />
        <div class="flex-1 text-sm">
          <p class="font-semibold" :class="avisoDiaUtil.ajustado ? 'text-amber-900' : 'text-slate-800'">
            {{ avisoDiaUtil.itens.length === 1 ? '1 parcela caía' : avisoDiaUtil.itens.length + ' parcelas caíam' }}
            em dia sem compensação bancária.
            <span v-if="avisoDiaUtil.ajustado">Adiei para o próximo dia útil.</span>
            <span v-else>Mantive as datas originais.</span>
          </p>
          <ul class="mt-1 space-y-0.5 text-xs" :class="avisoDiaUtil.ajustado ? 'text-amber-800' : 'text-slate-600'">
            <li v-for="a in avisoDiaUtil.itens.slice(0, 4)" :key="a.parcela">
              <strong>Parcela {{ a.parcela }}:</strong> {{ dataBR(a.de) }} ({{ a.motivo }})
              <span v-if="a.para"> → <strong>{{ dataBR(a.para) }}</strong></span>
            </li>
            <li v-if="avisoDiaUtil.itens.length > 4" class="italic">e mais {{ avisoDiaUtil.itens.length - 4 }}...</li>
          </ul>
          <p class="mt-1.5 text-[11px]" :class="avisoDiaUtil.ajustado ? 'text-amber-700' : 'text-slate-500'">
            Trocar gera as parcelas de novo — o valor acompanha a mudança dos dias.
          </p>
        </div>
        <div class="flex gap-2 shrink-0">
          <button @click="trocarAjusteDiaUtil" class="h-8 px-3 rounded-md text-xs font-semibold border shadow-xs transition-colors"
                  :class="avisoDiaUtil.ajustado ? 'bg-white text-amber-800 border-amber-300 hover:bg-amber-100' : 'bg-amber-600 text-white border-amber-600 hover:bg-amber-700'">
            {{ avisoDiaUtil.ajustado ? 'Não adiar, manter as datas' : 'Adiar para o dia útil' }}
          </button>
          <button @click="avisoDiaUtil = null" aria-label="Fechar aviso" class="h-8 w-8 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-white/60">
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>

      <section class="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        <header class="px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-4">
          <div class="flex items-center gap-2">
            <h2 class="text-sm font-semibold text-slate-900">Cheques</h2>
            <span class="px-1.5 min-w-5 h-5 inline-flex items-center justify-center rounded bg-slate-100 text-[11px] font-semibold text-slate-600 tabular-nums">{{ itens.length }}</span>
          </div>
          <button @click="adicionarLinha" class="h-8 px-3 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 flex items-center gap-1.5">
            <Plus class="w-3.5 h-3.5" /> Adicionar cheque
          </button>
        </header>
        <div class="overflow-x-auto">
          <table class="w-full text-sm whitespace-nowrap">
            <thead class="bg-slate-50/80 border-b border-slate-200 text-xs font-medium text-slate-500">
              <tr>
                <th class="pl-5 pr-2 py-2 text-left w-10">#</th>
                <th class="px-2.5 py-2 text-left">Vencimento</th>
                <th class="px-2.5 py-2 text-right">Dias</th>
                <th class="px-2.5 py-2 text-right">Valor do cheque</th>
                <th class="px-2.5 py-2 text-right">Juros</th>
                <th v-if="header.iofEnabled" class="px-2.5 py-2 text-right">IOF</th>
                <th class="px-2.5 py-2 text-right">Líquido</th>
                <th class="px-2.5 py-2 text-left">Banco / Nº</th>
                <th class="pl-2 pr-5 py-2 w-10"><span class="sr-only">Remover</span></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="(item, index) in itens" :key="item.id" class="hover:bg-slate-50/60 align-top">
                <td class="pl-5 pr-2 py-2.5 text-xs text-slate-400 tabular-nums leading-8">{{ index + 1 }}</td>
                <td class="px-2.5 py-2">
                  <input type="date" v-model="item.vencimento" @change="alterarVencimento(item)" :aria-label="`Vencimento do cheque ${index + 1}`" :class="[campoTabela, 'w-[132px]']" />
                  <div v-if="item.ajuste" class="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-700" :title="`Adiado por: ${item.ajuste.motivo}`">
                    <CalendarClock class="w-3 h-3 shrink-0" /> era {{ dataBR(item.ajuste.de) }} · {{ item.ajuste.motivo }}
                  </div>
                  <div v-else-if="motivoNaoUtil(item.vencimento)" class="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-600">
                    <AlertTriangle class="w-3 h-3 shrink-0" /> cai em {{ motivoNaoUtil(item.vencimento) }}
                  </div>
                </td>
                <td class="px-2.5 py-2 text-right tabular-nums text-slate-600 leading-8">{{ item.dias }}</td>
                <td class="px-2.5 py-2 text-right">
                  <input type="number" step="0.01" v-model="item.valor" @input="recalcularLinha(item)" :aria-label="`Valor do cheque ${index + 1}`" :class="[campoTabela, 'w-28 text-right font-semibold tabular-nums']" />
                </td>
                <td class="px-2.5 py-2 text-right tabular-nums text-red-600 leading-8">− {{ formatCurrency(item.juros) }}</td>
                <td v-if="header.iofEnabled" class="px-2.5 py-2 text-right tabular-nums text-orange-600 leading-8">− {{ formatCurrency(item.iof) }}</td>
                <td class="px-2.5 py-2 text-right tabular-nums font-semibold text-slate-900 leading-8">{{ formatCurrency(item.liquido) }}</td>
                <td class="px-2.5 py-2">
                  <div class="flex gap-1.5">
                    <input type="text" v-model="item.banco" placeholder="Banco" :aria-label="`Banco do cheque ${index + 1}`" :class="[campoTabela, 'w-20']" />
                    <input type="text" v-model="item.num_doc" placeholder="Nº" :aria-label="`Número do cheque ${index + 1}`" :class="[campoTabela, 'w-16']" />
                  </div>
                </td>
                <td class="pl-2 pr-5 py-2 text-right">
                  <button @click="removerLinha(index)" :aria-label="`Remover o cheque ${index + 1}`" class="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 class="w-4 h-4" /></button>
                </td>
              </tr>
              <tr v-if="!itens.length">
                <td :colspan="header.iofEnabled ? 9 : 8" class="px-5 py-10 text-center text-sm text-slate-400">
                  Nenhum cheque. Use “Gerar parcelas” acima ou “Adicionar cheque”.
                </td>
              </tr>
            </tbody>
            <tfoot v-if="itens.length" class="bg-slate-50/80 border-t border-slate-200">
              <tr class="font-semibold tabular-nums">
                <td colspan="3" class="pl-5 pr-3 py-2.5 text-xs font-medium text-slate-500">Total · {{ itens.length }} cheque(s)</td>
                <td class="px-2.5 py-2.5 text-right text-slate-900">{{ formatCurrency(totais.bruto) }}</td>
                <td class="px-2.5 py-2.5 text-right text-red-600">− {{ formatCurrency(totais.juros) }}</td>
                <td v-if="header.iofEnabled" class="px-2.5 py-2.5 text-right text-orange-600">− {{ formatCurrency(totais.iof) }}</td>
                <td class="px-2.5 py-2.5 text-right text-slate-900">{{ formatCurrency(totais.liquido) }}</td>
                <td colspan="2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <div class="sticky bottom-0 z-20 pt-2">
        <div class="bg-white/95 backdrop-blur border border-slate-200 rounded-lg shadow-[0_-6px_20px_-10px_rgb(15_23_42/0.18)] px-5 py-3 flex flex-wrap items-center gap-x-5 gap-y-3">
          <dl class="flex flex-wrap items-center gap-x-5 gap-y-2">
            <div>
              <dt class="text-xs font-medium text-slate-500">Valor bruto</dt>
              <dd class="text-lg font-semibold tracking-tight tabular-nums text-slate-900">{{ formatCurrency(totais.bruto) }}</dd>
            </div>
            <div class="sm:border-l sm:border-slate-200 sm:pl-5">
              <dt class="text-xs font-medium text-slate-500">Juros</dt>
              <dd class="text-lg font-semibold tracking-tight tabular-nums text-red-600">− {{ formatCurrency(totais.juros) }}</dd>
            </div>
            <div v-if="header.iofEnabled" class="sm:border-l sm:border-slate-200 sm:pl-5">
              <dt class="text-xs font-medium text-slate-500">IOF</dt>
              <dd class="text-lg font-semibold tracking-tight tabular-nums text-orange-600">− {{ formatCurrency(totais.iof) }}</dd>
            </div>
            <div v-if="comissao.valor > 0" class="sm:border-l sm:border-slate-200 sm:pl-5" data-campo="total-comissao">
              <dt class="text-xs font-medium text-slate-500" :title="`${parteDosJuros} dos juros`">Comissão <span class="text-slate-400">({{ parteDosJuros }})</span></dt>
              <dd class="text-lg font-semibold tracking-tight tabular-nums text-violet-700">{{ formatCurrency(comissao.valor) }}</dd>
            </div>
          </dl>
          <div class="ml-auto flex items-center gap-3">
            <div class="bg-slate-900 rounded-md px-4 py-2 flex items-center gap-3">
              <span class="text-[11px] font-medium text-slate-400 text-right leading-tight">Líquido<br>a pagar</span>
              <span class="text-xl font-semibold tracking-tight tabular-nums text-white">{{ formatCurrency(totais.liquido) }}</span>
            </div>
            <button @click="verificarLimiteESalvar" :disabled="loading" class="h-11 px-4 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-xs flex items-center gap-2 disabled:opacity-60">
              <Loader2 v-if="loading" class="w-4 h-4 animate-spin" /><Save v-else class="w-4 h-4" /> Efetivar
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Documento impresso (Simular / Efetivar). A tabela de fora so serve para a margem de
         cima e de baixo se repetir em toda pagina quando o borderô passa de uma folha. -->
    <div class="hidden print:block bg-white text-black">
      <table class="w-full border-collapse">
        <thead><tr><td class="h-[10mm] p-0"></td></tr></thead>
        <tfoot><tr><td class="h-[10mm] p-0"></td></tr></tfoot>
        <tbody><tr><td class="px-[14mm] py-0 align-top">

          <div class="border-b-2 border-black pb-3 mb-4 flex justify-between items-end gap-6">
            <div>
              <h1 class="text-3xl font-bold uppercase leading-none">{{ selectedCompany }}</h1>
              <p class="text-sm text-gray-600 mt-1">Gestão de Ativos</p>
            </div>
            <div class="text-right">
              <h2 class="text-xl font-bold uppercase whitespace-nowrap">Demonstrativo de Borderô</h2>
              <p v-if="lastOperationId" class="text-base font-bold">Nº {{ lastOperationId }}</p>
              <p v-else class="text-sm font-bold text-gray-500 uppercase">Simulação</p>
              <p class="text-xs mt-0.5">Data da operação: <b>{{ dataBR(header.dataOperacao) }}</b></p>
              <p class="text-[10px] text-gray-500">Emitido em {{ emissao }}</p>
            </div>
          </div>

          <div class="border border-gray-400 rounded mb-4 text-sm">
            <div class="grid grid-cols-2 divide-x divide-gray-300">
              <div class="p-3">
                <p class="text-[10px] font-semibold uppercase text-gray-500">Cliente</p>
                <p class="text-lg font-bold leading-tight">{{ header.clienteNome || '—' }}</p>
                <p v-if="header.clienteDocumento || header.clienteTelefone" class="text-xs text-gray-700 mt-0.5">
                  <template v-if="header.clienteDocumento">CPF/CNPJ: {{ header.clienteDocumento }}</template>
                  <template v-if="header.clienteDocumento && header.clienteTelefone"> · </template>
                  <template v-if="header.clienteTelefone">Tel.: {{ header.clienteTelefone }}</template>
                </p>
              </div>
              <div class="p-3">
                <p class="text-[10px] font-semibold uppercase text-gray-500">Emitente dos cheques</p>
                <p class="font-semibold leading-tight">{{ header.emitenteNome || '—' }}</p>
              </div>
            </div>
            <div class="border-t border-gray-300 px-3 py-2 flex flex-wrap gap-x-5 gap-y-0.5 text-xs">
              <span><b>Taxa:</b> {{ virgula(header.taxaMensal) }}% a.m.</span>
              <span><b>Compensação:</b> {{ header.diasCompensacao }} dia(s)</span>
              <span><b>IOF:</b> <template v-if="header.iofEnabled">{{ virgula(header.iofBase) }}% fixo + {{ virgula(header.iofDiario) }}% a.d.</template><template v-else>não cobrado</template></span>
              <span><b>Pagamento:</b> {{ nomeConta(header.contaSaida) }}</span>
              <span v-if="comissao.valor > 0"><b>Comissão:</b> {{ virgula(header.comissao) }} de {{ virgula(header.taxaMensal) }}% ({{ parteDosJuros }} dos juros)</span>
            </div>
          </div>

          <p class="text-xs font-semibold uppercase text-gray-600 mb-1">
            Cheques ({{ itens.length }})<template v-if="prazoMedio"> · prazo médio de {{ prazoMedio }} dias</template>
          </p>
          <table class="w-full text-xs border-collapse mb-4">
            <thead>
              <tr class="border-b-2 border-black text-left">
                <th class="py-1.5 pr-2 w-6">#</th>
                <th class="py-1.5 pr-2">Vencimento</th>
                <th class="py-1.5 pr-2 text-right">Dias</th>
                <th class="py-1.5 pl-4 pr-2">Nº doc</th>
                <th class="py-1.5 pr-2 text-right">Valor face</th>
                <th class="py-1.5 pr-2 text-right">Juros</th>
                <th v-if="header.iofEnabled" class="py-1.5 pr-2 text-right">IOF</th>
                <th class="py-1.5 text-right">Líquido</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in itens" :key="item.id" class="border-b border-gray-300 break-inside-avoid">
                <td class="py-1.5 pr-2 text-gray-500">{{ index + 1 }}</td>
                <td class="py-1.5 pr-2 tabular-nums">{{ dataBR(item.vencimento) || '—' }}</td>
                <td class="py-1.5 pr-2 text-right tabular-nums">{{ item.dias }}</td>
                <td class="py-1.5 pl-4 pr-2">{{ item.num_doc || '—' }}</td>
                <td class="py-1.5 pr-2 text-right tabular-nums font-bold">{{ formatCurrency(item.valor) }}</td>
                <td class="py-1.5 pr-2 text-right tabular-nums">{{ formatCurrency(item.juros) }}</td>
                <td v-if="header.iofEnabled" class="py-1.5 pr-2 text-right tabular-nums">{{ formatCurrency(item.iof) }}</td>
                <td class="py-1.5 text-right tabular-nums font-bold">{{ formatCurrency(item.liquido) }}</td>
              </tr>
              <tr class="border-t-2 border-black font-bold break-inside-avoid">
                <td colspan="4" class="py-1.5 pr-2">Total</td>
                <td class="py-1.5 pr-2 text-right tabular-nums">{{ formatCurrency(totais.bruto) }}</td>
                <td class="py-1.5 pr-2 text-right tabular-nums">{{ formatCurrency(totais.juros) }}</td>
                <td v-if="header.iofEnabled" class="py-1.5 pr-2 text-right tabular-nums">{{ formatCurrency(totais.iof) }}</td>
                <td class="py-1.5 text-right tabular-nums">{{ formatCurrency(totais.liquido) }}</td>
              </tr>
            </tbody>
          </table>

          <!-- valores + assinatura juntos: nunca ficam separados em paginas diferentes -->
          <div class="break-inside-avoid">
            <div class="flex justify-between items-start gap-6">
              <div class="flex-1 text-xs">
                <p v-if="header.observacao" class="border border-gray-300 rounded p-2 whitespace-pre-line"><b>Observações:</b> {{ header.observacao }}</p>
              </div>
              <div class="w-[85mm] bg-gray-100 rounded p-3 text-sm">
                <div class="flex justify-between py-0.5"><span>Valor bruto</span><span class="tabular-nums">{{ formatCurrency(totais.bruto) }}</span></div>
                <div class="flex justify-between py-0.5"><span>(−) Juros</span><span class="tabular-nums">{{ formatCurrency(totais.juros) }}</span></div>
                <div v-if="header.iofEnabled" class="flex justify-between py-0.5"><span>(−) IOF</span><span class="tabular-nums">{{ formatCurrency(totais.iof) }}</span></div>
                <div v-if="comissao.valor > 0" class="flex justify-between py-0.5 text-xs text-gray-600"><span>Comissão ({{ parteDosJuros }} dos juros)</span><span class="tabular-nums">{{ formatCurrency(comissao.valor) }}</span></div>
                <div class="flex justify-between items-baseline mt-1.5 pt-1.5 border-t border-gray-400 text-lg font-bold">
                  <span>Líquido a Pagar</span><span class="tabular-nums">{{ formatCurrency(totais.liquido) }}</span>
                </div>
              </div>
            </div>

            <p class="text-xs mt-5">
              Declaro que conferi os cheques e os valores acima e estou de acordo com este borderô.
            </p>
            <div class="mt-14 w-[110mm] mx-auto text-center">
              <div class="border-t border-black pt-1.5">
                <p class="text-sm font-bold uppercase">{{ header.clienteNome || 'Nome do cliente' }}</p>
                <p v-if="header.clienteDocumento" class="text-xs">CPF/CNPJ: {{ header.clienteDocumento }}</p>
                <p class="text-xs text-gray-500">Assinatura do cliente</p>
              </div>
            </div>
          </div>

        </td></tr></tbody>
      </table>
    </div>
  </DashboardLayout>
</template>

<style scoped>
.animate-scale-in { animation: scaleIn 0.2s ease-out; }
@keyframes scaleIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@media print { @page { margin: 0; size: auto; } }
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
input[type="number"] { -moz-appearance: textfield; }
</style>