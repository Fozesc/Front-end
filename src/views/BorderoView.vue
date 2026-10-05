<script setup>
import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue';
import DashboardLayout from '../layouts/DashboardLayout.vue';
import { 
  Plus, Trash2, Save, ArrowLeft, Printer, Calculator, 
  AlertTriangle, CheckCircle, Wallet, Loader2, Building2, CalendarClock, X
} from 'lucide-vue-next';
import { useRouter } from 'vue-router';
import operationService from '../services/operationService';
import checkService from '../services/checkService';
import ClientSelect from '../components/inputs/ClientSelect.vue';
import api from '../services/api';
import { motivoNaoUtil, proximoDiaUtil } from '../utils/diasUteis';
import {
  arredondar, calcularDias, calcularLinha, divisorInverso, iofDasConfiguracoes,
  IOF_BASE_PADRAO, IOF_DIARIO_PADRAO, DIAS_COMPENSACAO_PADRAO
} from '../utils/calculoBordero';

const router = useRouter();

const isPrinting = ref(false);
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
  clienteLimite: 0,      
  clienteDivida: 0,      
  emitenteNome: '',
  dataOperacao: new Date().toISOString().split('T')[0],
  taxaMensal: 4.00,
  diasCompensacao: DIAS_COMPENSACAO_PADRAO,
  bancoPadrao: '', 
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
    header.clienteLimite = 0; header.clienteDivida = 0;
    return;
  }
  header.clienteId = cliente.id;
  header.clienteNome = cliente.name;
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
  if (gerador.valorAlvo <= 0 || gerador.qtdParcelas <= 0) return;
  itens.value = [];
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
  avisoDiaUtil.value = ajustes.length
    ? { ajustado: ajustarDiaUtil.value, itens: ajustes }
    : null;
  const ajustePorParcela = new Map(ajustes.map(a => [a.parcela, a]));

  let valorParcelaBruta = 0;
  if (gerador.modo === 'valor_mao') {
    let somaDivisores = 0;
    datas.forEach(dataVenc => {
      const dias = calcularDias(header.dataOperacao, dataVenc, header.diasCompensacao);
      somaDivisores += divisorInverso({
        dias, taxaMensal: header.taxaMensal,
        iofEnabled: header.iofEnabled, iofBase: header.iofBase, iofDiario: header.iofDiario
      });
    });
    valorParcelaBruta = gerador.valorAlvo / somaDivisores;
    valorParcelaBruta = arredondar(valorParcelaBruta);
  } else {
    valorParcelaBruta = gerador.valorAlvo / gerador.qtdParcelas;
    valorParcelaBruta = arredondar(valorParcelaBruta);
  }

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

const adicionarLinha = () => { itens.value.push({ id: Date.now(), vencimento: '', valor: 0, dias: 0, juros: 0, iof: 0, liquido: 0, banco: header.bancoPadrao, num_doc: '', ajuste: null }); };
const removerLinha = (index) => { itens.value.splice(index, 1); avisoDiaUtil.value = null; recalcularTudo(); };
const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

const exportarBordero = async () => { 
  isPrinting.value = true; 
  await nextTick(); 
  window.print(); 
  isPrinting.value = false; 
};

const verificarLimiteESalvar = () => {
  if (!header.clienteId) return showPopup('Atenção', 'Selecione um cliente válido.', 'error');
  if (!header.emitenteNome) return showPopup('Atenção', 'Informe o emitente.', 'error');
  if (itens.value.length === 0 || totais.value.bruto <= 0) return showPopup('Atenção', 'Borderô vazio.', 'error');
  if (itens.value.some(i => !i.vencimento)) return showPopup('Erro', 'Datas inválidas.', 'error');

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
    
    showPopup('Sucesso!', `Operação #${resposta.id} realizada!\nLíquido: ${formatCurrency(resposta.total_net)}`);
    
    itens.value = [];
    adicionarLinha();
    gerador.valorAlvo = 0;
    header.clienteId = null; header.clienteNome = ''; 
    header.clienteLimite = 0; header.clienteDivida = 0;
    
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
    
    <div v-if="limitModal.visible" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"></div>
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-md relative z-10 p-6 text-center animate-scale-in">
        <div class="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle class="w-6 h-6 text-amber-600" /></div>
        <h3 class="text-lg font-semibold text-slate-900 mb-1">Limite de crédito excedido</h3>
        <p class="text-slate-600 text-sm mb-4">{{ limitModal.message }}</p>
        <div class="bg-amber-50 border border-amber-200/80 rounded-xl p-4 mb-6 text-left">
          <div class="flex justify-between text-sm mb-1"><span class="text-amber-800">Limite Atual:</span><span class="font-bold text-amber-900">{{ formatCurrency(header.clienteLimite) }}</span></div>
          <div class="flex justify-between text-sm mb-1"><span class="text-amber-800">Dívida + Atual:</span><span class="font-bold text-amber-900">{{ formatCurrency(header.clienteDivida + totais.bruto) }}</span></div>
          <div class="border-t border-amber-200 my-2"></div>
          <div class="flex justify-between text-base font-bold text-red-600"><span>Excesso:</span><span>+ {{ formatCurrency(limitModal.overAmount) }}</span></div>
        </div>
        <div class="flex gap-3 justify-center">
          <button @click="limitModal.visible = false" class="flex-1 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 font-semibold text-sm rounded-lg shadow-xs hover:bg-slate-50">Cancelar</button>
          <button @click="limitModal.onConfirm" class="flex-1 px-4 py-2.5 bg-red-600 text-white font-semibold text-sm rounded-lg hover:bg-red-700 shadow-xs">Efetivar mesmo assim</button>
        </div>
      </div>
    </div>

    <div v-if="modalState.visible" class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm transition-opacity p-4">
      <div class="bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full text-center animate-scale-in">
        <div :class="`mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 ${modalState.type === 'error' ? 'bg-red-100' : 'bg-emerald-100'}`">
          <CheckCircle v-if="modalState.type === 'success'" class="h-6 w-6 text-emerald-600" /><AlertTriangle v-else class="h-6 w-6 text-red-600" />
        </div>
        <h3 class="text-lg font-semibold text-slate-900 mb-1">{{ modalState.title }}</h3>
        <p class="text-slate-500 text-sm mb-6">{{ modalState.message }}</p>
        <button @click="modalState.visible = false" :class="`w-full py-2.5 px-4 rounded-lg text-white font-semibold text-sm shadow-xs ${modalState.type === 'error' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`">Entendido</button>
      </div>
    </div>

    <div class="print:hidden">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div class="flex items-center gap-3">
          <button @click="router.back()" class="w-9 h-9 flex items-center justify-center bg-white border border-slate-200 shadow-xs hover:bg-slate-50 rounded-lg text-slate-500"><ArrowLeft class="w-[18px] h-[18px]" /></button>
          <div><h1 class="text-2xl font-semibold text-slate-900 tracking-tight">Cálculo de Borderô</h1><p class="text-slate-500 text-sm mt-0.5">Novo borderô de cheques ou antecipação.</p></div>
        </div>
        <div class="flex gap-2.5 items-center">
          
          <div class="relative">
            <select v-model="selectedCompany" class="appearance-none bg-white border border-slate-300 text-slate-700 font-semibold h-9 pl-3.5 pr-9 rounded-lg cursor-pointer text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 outline-none shadow-xs transition-shadow">
              <option value="Fozesc">Fozesc</option>
              <option value="PQ">PQ</option>
            </select>
            <Building2 class="w-4 h-4 absolute right-3 top-2.5 text-slate-400 pointer-events-none" />
          </div>

          <button @click="exportarBordero" class="bg-white border border-slate-300 text-slate-700 h-9 px-3.5 rounded-lg text-sm font-semibold shadow-xs hover:bg-slate-50 flex items-center transition-colors"><Printer class="w-4 h-4 mr-2 text-slate-500" /> Simular</button>
          <button @click="verificarLimiteESalvar" class="bg-emerald-600 hover:bg-emerald-700 text-white h-9 px-3.5 rounded-lg text-sm font-semibold shadow-xs ring-1 ring-inset ring-white/10 flex items-center transition-colors"><Save class="w-4 h-4 mr-2" /> Efetivar</button>
        </div>
      </div>

      <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200/80 mb-6 relative z-30">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          
          <div class="relative group">
            <ClientSelect 
              v-model="header.clienteId" 
              @select="selecionarCliente"
            />
            
            <div v-if="header.clienteId && header.clienteLimite > 0" class="absolute right-0 top-0 text-xs font-medium text-slate-500">
               Disp: <span :class="header.clienteLimite - header.clienteDivida < 0 ? 'text-red-600' : 'text-emerald-600'">{{ formatCurrency(header.clienteLimite - header.clienteDivida) }}</span>
            </div>
          </div>

          <div class="relative group">
            <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Emitente do Cheque</label>
            <input type="text" v-model="header.emitenteNome" @input="buscarEmitentes" @focus="buscarEmitentes"
                   @blur="conferirEmitente" list="emitentes-ja-usados" autocomplete="off"
                   placeholder="Quem assinou o cheque..." class="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none font-medium text-slate-700 h-[42px] focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" />
            <datalist id="emitentes-ja-usados">
              <option v-for="nome in emitentesSugeridos" :key="nome" :value="nome" />
            </datalist>
            <p v-if="emitenteNovo" class="text-xs text-amber-700 font-medium mt-1.5 flex items-center gap-1">
              <AlertTriangle class="w-3 h-3 shrink-0" /> Emitente novo — confira se não é um já cadastrado escrito diferente.
            </p>
          </div>
        </div>

      <div class="md:col-span-2 relative group mb-5">
        <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Observações do Borderô</label>
        <textarea v-model="header.observacao" rows="2" placeholder="Notas sobre esta negociação..." class="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none font-medium text-slate-700 resize-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow"></textarea>
      </div>

        <div class="grid grid-cols-2 md:grid-cols-7 gap-4">
          <div class="col-span-2 md:col-span-1">
            <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Data</label>
            <input type="date" v-model="header.dataOperacao" class="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm outline-none font-medium focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" />
          </div>
          <div class="col-span-1 md:col-span-1">
            <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Taxa (%)</label>
            <input type="number" step="0.01" v-model="header.taxaMensal" class="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm outline-none font-bold text-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" />
          </div>
          <div class="col-span-1 md:col-span-1">
            <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Compensação</label>
            <input type="number" v-model="header.diasCompensacao" class="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm outline-none font-bold text-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" />
          </div>
          <div class="col-span-2 md:col-span-1">
            <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Banco Padrão</label>
            <input type="text" v-model="header.bancoPadrao" placeholder="Ex: BB" class="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" />
          </div>

          <div class="col-span-1 md:col-span-1 flex flex-col justify-center">
             <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Cobrar IOF?</label>
             <button @click="header.iofEnabled = !header.iofEnabled" :class="['px-2 py-2.5 rounded-lg text-sm font-semibold transition-colors w-full border truncate shadow-xs', header.iofEnabled ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50']">
               {{ header.iofEnabled ? `Sim (${header.iofBase}%)` : 'Não' }}
             </button>
          </div>

           <div class="col-span-1 md:col-span-2">
            <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Conta de Saída</label>
            <div class="flex bg-slate-100 p-1 rounded-lg gap-0.5">
              <button @click="header.contaSaida = 'Dinheiro'" :class="`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${header.contaSaida === 'Dinheiro' ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`"><Wallet class="w-3 h-3 inline mr-1" /> Dinheiro</button>
              <button @click="header.contaSaida = 'BB'" :class="`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${header.contaSaida === 'BB' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`"><Calculator class="w-3 h-3 inline mr-1" /> BB</button>
              <button @click="header.contaSaida = 'Caixa'" :class="`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${header.contaSaida === 'Caixa' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`"><Wallet class="w-3 h-3 inline mr-1" /> Caixa</button>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-200/80 mb-6 overflow-hidden relative z-10">
        <div class="px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <div class="flex bg-slate-100 p-1 rounded-lg gap-0.5">
            <button @click="gerador.modo = 'valor_mao'" :class="['px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition-all', gerador.modo === 'valor_mao' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700']"><div class="w-2 h-2 rounded-full bg-purple-500" v-if="gerador.modo === 'valor_mao'"></div> Líquido (Inverso)</button>
            <button @click="gerador.modo = 'valor_bruto'" :class="['px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition-all', gerador.modo === 'valor_bruto' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700']"><div class="w-2 h-2 rounded-full bg-indigo-500" v-if="gerador.modo === 'valor_bruto'"></div> Bruto (Padrão)</button>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex bg-slate-100 p-1 rounded-lg gap-0.5">
              <button @click="gerador.intervaloTipo = 'mensal'" :class="['px-3 py-1.5 text-xs font-semibold rounded-md transition-all', gerador.intervaloTipo === 'mensal' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700']">Mensal</button>
              <button @click="gerador.intervaloTipo = 'dias'" :class="['px-3 py-1.5 text-xs font-semibold rounded-md transition-all', gerador.intervaloTipo === 'dias' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700']">Dias</button>
            </div>
          </div>
        </div>

        <div class="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
          <div class="md:col-span-4">
            <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Valor</label>
            <div class="relative group">
              <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><span class="text-slate-400 font-semibold text-base">R$</span></div>
              <input type="number" v-model="gerador.valorAlvo" class="w-full pl-12 pr-4 h-12 bg-white border border-slate-300 rounded-lg outline-none font-bold text-lg text-slate-800 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/15 shadow-xs transition-shadow" placeholder="0,00" />
            </div>
          </div>
          <div class="md:col-span-2">
            <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Qtd</label>
            <input type="number" v-model="gerador.qtdParcelas" class="w-full h-12 px-4 bg-white border border-slate-300 rounded-lg outline-none font-bold text-center text-slate-800 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/15 shadow-xs transition-shadow" />
          </div>
          <div class="md:col-span-3">
            <label class="block text-[13px] font-medium text-slate-700 mb-1.5">1º Vencimento</label>
            <input type="date" v-model="gerador.primeiroVencimento" class="w-full h-12 px-4 bg-white border border-slate-300 rounded-lg outline-none font-medium text-slate-600 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/15 shadow-xs transition-shadow" />
          </div>
          <div class="md:col-span-3">
            <button @click="gerarParcelas" class="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-xs ring-1 ring-inset ring-white/10 flex items-center justify-center gap-2 active:scale-[0.98] transition-all text-[15px]"><Calculator class="w-[18px] h-[18px]" /> Gerar parcelas</button>
          </div>
        </div>
      </div>

      <div v-if="avisoDiaUtil" class="mb-6 rounded-xl border p-4 flex flex-col md:flex-row md:items-start gap-4 shadow-xs"
           :class="avisoDiaUtil.ajustado ? 'bg-amber-50 border-amber-200/80' : 'bg-white border-slate-200'">
        <CalendarClock class="w-5 h-5 mt-0.5 shrink-0" :class="avisoDiaUtil.ajustado ? 'text-amber-600' : 'text-slate-500'" />
        <div class="flex-1 text-sm">
          <p class="font-semibold" :class="avisoDiaUtil.ajustado ? 'text-amber-900' : 'text-slate-800'">
            {{ avisoDiaUtil.itens.length === 1 ? '1 parcela caía' : avisoDiaUtil.itens.length + ' parcelas caíam' }}
            em dia sem compensação bancária.
            <span v-if="avisoDiaUtil.ajustado">Adiei para o próximo dia útil.</span>
            <span v-else>Mantive as datas originais.</span>
          </p>
          <ul class="mt-1.5 space-y-0.5 text-xs" :class="avisoDiaUtil.ajustado ? 'text-amber-800' : 'text-slate-600'">
            <li v-for="a in avisoDiaUtil.itens.slice(0, 4)" :key="a.parcela">
              <strong>Parcela {{ a.parcela }}:</strong> {{ dataBR(a.de) }} ({{ a.motivo }})
              <span v-if="a.para"> → <strong>{{ dataBR(a.para) }}</strong></span>
            </li>
            <li v-if="avisoDiaUtil.itens.length > 4" class="italic">
              e mais {{ avisoDiaUtil.itens.length - 4 }}...
            </li>
          </ul>
          <p class="mt-2 text-[11px]" :class="avisoDiaUtil.ajustado ? 'text-amber-700' : 'text-slate-500'">
            Trocar gera as parcelas de novo — o valor acompanha a mudança dos dias.
          </p>
        </div>
        <div class="flex gap-2 shrink-0">
          <button @click="trocarAjusteDiaUtil"
                  class="px-3.5 py-2 rounded-lg text-xs font-semibold border shadow-xs transition-colors"
                  :class="avisoDiaUtil.ajustado
                    ? 'bg-white text-amber-800 border-amber-300 hover:bg-amber-100'
                    : 'bg-amber-600 text-white border-amber-600 hover:bg-amber-700'">
            {{ avisoDiaUtil.ajustado ? 'Não adiar, manter as datas' : 'Adiar para o dia útil' }}
          </button>
          <button @click="avisoDiaUtil = null" class="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/60">
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left whitespace-nowrap">
            <thead class="bg-slate-50/80 border-b border-slate-200">
              <tr>
                <th class="px-4 py-2.5 text-xs font-medium text-slate-500 w-10">#</th>
                <th class="px-4 py-2.5 text-xs font-medium text-slate-500 w-40">Vencimento</th>
                <th class="px-4 py-2.5 text-xs font-medium text-slate-500 text-center w-20">Dias</th>
                <th class="px-4 py-2.5 text-xs font-medium text-slate-500 text-right">Valor Cheque</th>
                <th class="px-4 py-2.5 text-xs font-medium text-red-600 bg-red-50/60 text-right">Juros</th>
                
                <th v-if="header.iofEnabled" class="px-4 py-2.5 text-xs font-medium text-orange-600 bg-orange-50/60 text-right">IOF</th>
                
                <th class="px-4 py-2.5 text-xs font-medium text-emerald-700 bg-emerald-50/60 text-right">Líquido</th>
                <th class="px-4 py-2.5 text-xs font-medium text-slate-500">Banco / Doc</th>
                <th class="px-4 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="(item, index) in itens" :key="item.id" class="hover:bg-slate-50/60">
                <td class="px-4 py-3 text-xs font-medium text-slate-400 tabular-nums">{{ index + 1 }}</td>
                <td class="px-4 py-3">
                  <input type="date" v-model="item.vencimento" @change="alterarVencimento(item)" class="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-sm outline-none text-slate-600 font-medium focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" />
                  <div v-if="item.ajuste" class="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-700" :title="`Adiado por: ${item.ajuste.motivo}`">
                    <CalendarClock class="w-3 h-3 shrink-0" /> era {{ dataBR(item.ajuste.de) }} · {{ item.ajuste.motivo }}
                  </div>
                  <div v-else-if="motivoNaoUtil(item.vencimento)" class="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-600">
                    <AlertTriangle class="w-3 h-3 shrink-0" /> cai em {{ motivoNaoUtil(item.vencimento) }}
                  </div>
                </td>
                <td class="px-4 py-3 text-center"><span class="inline-block bg-slate-100 ring-1 ring-inset ring-slate-200 text-slate-700 text-xs font-semibold px-2 py-1 rounded-md min-w-[3rem] tabular-nums">{{ item.dias }}</span></td>
                <td class="px-4 py-3"><input type="number" step="0.01" v-model="item.valor" @input="recalcularLinha(item)" class="w-full text-right bg-white border border-slate-300 rounded px-2 py-1.5 text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" /></td>
                <td class="px-4 py-3 text-right font-semibold text-red-600 bg-red-50/30 text-sm tabular-nums">-{{ formatCurrency(item.juros) }}</td>
                
                <td v-if="header.iofEnabled" class="px-4 py-3 text-right font-semibold text-orange-600 bg-orange-50/30 text-sm tabular-nums">-{{ formatCurrency(item.iof) }}</td>

                <td class="px-4 py-3 text-right font-semibold text-emerald-700 bg-emerald-50/30 text-sm tabular-nums">{{ formatCurrency(item.liquido) }}</td>
                <td class="px-4 py-3"><div class="flex gap-2"><input type="text" v-model="item.banco" placeholder="Banco" class="w-20 bg-white border border-slate-300 rounded px-2 py-1.5 text-xs focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 outline-none shadow-xs transition-shadow" /><input type="text" v-model="item.num_doc" placeholder="Doc" class="w-20 bg-white border border-slate-300 rounded px-2 py-1.5 text-xs focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 outline-none shadow-xs transition-shadow" /></div></td>
                <td class="px-4 py-3 text-center"><button @click="removerLinha(index)" class="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 class="w-4 h-4" /></button></td>
              </tr>
            </tbody>
          </table>
          <div class="p-3 border-t border-slate-100"><button @click="adicionarLinha" class="w-full py-2.5 border border-dashed border-slate-300 rounded-lg text-slate-500 text-sm font-medium hover:border-indigo-300 hover:bg-indigo-50/40 hover:text-indigo-700 transition-all flex items-center justify-center gap-2"><Plus class="w-4 h-4" /> Adicionar cheque</button></div>
        </div>
      </div>
    </div>
    
    <div class="print:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md text-slate-900 px-4 py-3 z-40 border-t border-slate-200 md:pl-64 shadow-[0_-8px_24px_-12px_rgb(16_24_40/0.12)]">
      <div class="max-w-7xl mx-auto md:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <div class="flex gap-8 text-sm">
          <div><span class="block text-slate-500 text-xs font-medium">Bruto</span><span class="font-semibold text-xl tracking-tight tabular-nums">{{ formatCurrency(totais.bruto) }}</span></div>
          <div><span class="block text-slate-500 text-xs font-medium">Juros</span><span class="font-semibold text-xl tracking-tight tabular-nums text-red-600">-{{ formatCurrency(totais.juros) }}</span></div>
          
          <div v-if="header.iofEnabled"><span class="block text-slate-500 text-xs font-medium">IOF</span><span class="font-semibold text-xl tracking-tight tabular-nums text-orange-600">-{{ formatCurrency(totais.iof) }}</span></div>
        </div>
        <div class="flex items-center gap-4 bg-slate-900 px-5 py-2.5 rounded-xl shadow-md"><span class="text-xs font-medium text-slate-400 text-right leading-tight">Líquido<br>a pagar</span><span class="text-2xl font-semibold tracking-tight tabular-nums text-white">{{ formatCurrency(totais.liquido) }}</span></div>
      </div>
    </div>

    <div class="hidden print:block bg-white text-black p-8 max-w-[210mm] mx-auto min-h-screen relative">
      <div class="border-b-2 border-black pb-4 mb-6 flex justify-between items-end">
        <div>
          <h1 class="text-3xl font-bold uppercase">{{ selectedCompany }}</h1>
          <p class="text-sm text-gray-600">Gestão de Ativos</p>
        </div>
        <div class="text-right">
          <h2 class="text-xl font-bold uppercase">Demonstrativo de Borderô</h2>
          <p v-if="lastOperationId" class="text-base font-bold text-gray-700">Nº {{ lastOperationId }}</p>
          <p class="text-sm mt-1">Data: {{ new Date().toLocaleDateString('pt-BR') }}</p>
        </div>
      </div>
      
      <div class="grid grid-cols-2 gap-8 mb-6 text-sm border border-gray-300 p-4 rounded-lg">
        <div><p><strong class="uppercase text-gray-500 text-xs">Cliente:</strong></p><p class="text-lg font-bold">{{ header.clienteNome || '---' }}</p></div>
        <div>
          <p><strong class="uppercase text-gray-500 text-xs">Taxa:</strong> <span class="font-mono ml-2">{{ header.taxaMensal }}% a.m.</span></p>
          <p v-if="header.iofEnabled"><strong class="uppercase text-gray-500 text-xs">IOF:</strong> <span class="font-mono ml-2">{{ header.iofBase }}% Fixo + {{ header.iofDiario }}% a.d.</span></p>
        </div>
      </div>
      
      <table class="w-full text-left text-xs mb-8 border-collapse">
        <thead>
          <tr class="border-b-2 border-black">
            <th class="py-2">Vencimento</th>
            <th class="py-2 text-center">Dias</th>
            <th class="py-2 text-right">Valor Face</th>
            <th class="py-2 text-right">Juros</th>
            <th class="py-2 text-right" v-if="header.iofEnabled">IOF</th>
            <th class="py-2 text-right">Líquido</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in itens" :key="item.id" class="border-b border-gray-200">
            <td class="py-2 font-mono">{{ item.vencimento.split('-').reverse().join('/') }}</td>
            <td class="py-2 text-center">{{ item.dias }}</td>
            <td class="py-2 text-right font-bold">{{ formatCurrency(item.valor) }}</td>
            <td class="py-2 text-right">{{ formatCurrency(item.juros) }}</td>
            <td class="py-2 text-right" v-if="header.iofEnabled">{{ formatCurrency(item.iof) }}</td>
            <td class="py-2 text-right font-bold">{{ formatCurrency(item.liquido) }}</td>
          </tr>
        </tbody>
      </table>
      
      <div class="flex justify-end mb-12">
        <div class="w-1/2 bg-gray-100 p-4 rounded-lg">
          <div class="flex justify-between text-xl font-bold">
            <span>Líquido a Pagar:</span>
            <span>{{ formatCurrency(totais.liquido) }}</span>
          </div>
        </div>
      </div>

      <div class="mt-20 pt-8 border-t border-black w-2/3 mx-auto text-center">
         <p class="text-sm font-bold uppercase mb-1">{{ header.clienteNome }}</p>
         <p class="text-xs text-gray-500">Assinatura do Cliente</p>
      </div>

    </div>
  </DashboardLayout>
</template>

<style scoped>
.animate-scale-in { animation: scaleIn 0.2s ease-out; }
@keyframes scaleIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@media print { @page { margin: 0; size: auto; } body { margin: 0 !important; background: white !important; } }
</style>