<script setup>
import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue';
import DashboardLayout from '../layouts/DashboardLayout.vue';
import { 
  Plus, Trash2, Save, ArrowLeft, Printer, Calculator, 
  AlertTriangle, CheckCircle, Wallet, Loader2, Building2 
} from 'lucide-vue-next';
import { useRouter } from 'vue-router';
import operationService from '../services/operationService';
import ClientSelect from '../components/inputs/ClientSelect.vue';

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
  diasCompensacao: 2,
  bancoPadrao: '', 
  contaSaida: 'Dinheiro',
  observacao: ''
});

const gerador = reactive({
  modo: 'valor_mao', 
  valorAlvo: 0, 
  qtdParcelas: 1,
  primeiroVencimento: '',
  intervaloTipo: 'mensal',
  diasIntervalo: 30
});


onMounted(() => {
  const hoje = new Date();
  hoje.setDate(hoje.getDate() + 30);
  gerador.primeiroVencimento = hoje.toISOString().split('T')[0];
  
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
    acc.liquido += Number(item.liquido || 0); 
    return acc;
  }, { bruto: 0, juros: 0, liquido: 0 });
});

const arredondar = (valor) => Math.round((valor + Number.EPSILON) * 100) / 100;

const getDataLimpa = (dataStr) => {
  if (!dataStr) return null;
  const [ano, mes, dia] = dataStr.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0));
};

const calcularDias = (dataBase, dataVencimento, diasComp) => {
  if (!dataBase || !dataVencimento) return 0;
  const d1 = getDataLimpa(dataBase);
  const d2 = getDataLimpa(dataVencimento);
  const diffTime = d2.getTime() - d1.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + Number(diasComp);
};


const recalcularLinha = (item) => {
  item.dias = calcularDias(header.dataOperacao, item.vencimento, header.diasCompensacao);
  if (!item.valor || item.dias <= 0) { 
    item.juros = 0; item.liquido = Number(item.valor) || 0; return; 
  }
  
  const valorFace = Number(item.valor);
  const taxaDecimal = Number(header.taxaMensal) / 100;
  const totalMes = item.dias / 30.0;
  

  const fator = Math.pow(1 + taxaDecimal, totalMes);
  

  const jurosCalculado = valorFace * (fator - 1);
  
  item.juros = arredondar(jurosCalculado);
  item.liquido = arredondar(valorFace - item.juros);
};

const recalcularTudo = () => { itens.value.forEach(recalcularLinha); };
watch(() => [header.dataOperacao, header.taxaMensal, header.diasCompensacao], () => recalcularTudo());



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

  let valorParcelaBruta = 0;
  if (gerador.modo === 'valor_mao') {
    let somaDivisores = 0;
    const taxaDecimal = Number(header.taxaMensal) / 100;
    datas.forEach(dataVenc => {
      const dias = calcularDias(header.dataOperacao, dataVenc, header.diasCompensacao);
      const tempoMeses = dias / 30.0;
      const fator = Math.pow(1 + taxaDecimal, tempoMeses);
      const divisor = 2 - fator;
      somaDivisores += divisor;
    });
    valorParcelaBruta = gerador.valorAlvo / somaDivisores;
    valorParcelaBruta = arredondar(valorParcelaBruta);
  } else {
    valorParcelaBruta = gerador.valorAlvo / gerador.qtdParcelas;
    valorParcelaBruta = arredondar(valorParcelaBruta);
  }

  for (let i = 0; i < gerador.qtdParcelas; i++) {
    const novoItem = {
      id: Date.now() + i,
      vencimento: datas[i],
      valor: valorParcelaBruta,
      dias: 0, juros: 0, liquido: 0, banco: '', num_doc: `${i + 1}/${gerador.qtdParcelas}`
    };
    itens.value.push(novoItem);
  }
  recalcularTudo();
};

const adicionarLinha = () => { itens.value.push({ id: Date.now(), vencimento: '', valor: 0, dias: 0, juros: 0, liquido: 0, banco: header.bancoPadrao, num_doc: '' }); };
const removerLinha = (index) => { itens.value.splice(index, 1); recalcularTudo(); };
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
      checks: itens.value.map(item => ({
        valor: item.valor, vencimento: item.vencimento,
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
        <div class="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle class="w-8 h-8 text-amber-600" /></div>
        <h3 class="text-xl font-bold text-slate-900 mb-2">Limite de Crédito Excedido</h3>
        <p class="text-slate-600 mb-4">{{ limitModal.message }}</p>
        <div class="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div class="flex justify-between text-sm mb-1"><span class="text-amber-800">Limite Atual:</span><span class="font-bold text-amber-900">{{ formatCurrency(header.clienteLimite) }}</span></div>
          <div class="flex justify-between text-sm mb-1"><span class="text-amber-800">Dívida + Atual:</span><span class="font-bold text-amber-900">{{ formatCurrency(header.clienteDivida + totais.bruto) }}</span></div>
          <div class="border-t border-amber-200 my-2"></div>
          <div class="flex justify-between text-base font-bold text-red-600"><span>Excesso:</span><span>+ {{ formatCurrency(limitModal.overAmount) }}</span></div>
        </div>
        <div class="flex gap-3 justify-center">
          <button @click="limitModal.visible = false" class="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200">Cancelar</button>
          <button @click="limitModal.onConfirm" class="px-5 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 shadow-md">Efetivar</button>
        </div>
      </div>
    </div>

    <div v-if="modalState.visible" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 transition-opacity">
      <div class="bg-white p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center transform scale-100">
        <div :class="`mx-auto flex items-center justify-center h-16 w-16 rounded-full mb-6 ${modalState.type === 'error' ? 'bg-red-100' : 'bg-emerald-100'}`">
          <CheckCircle v-if="modalState.type === 'success'" class="h-10 w-10 text-emerald-600" /><AlertTriangle v-else class="h-10 w-10 text-red-600" />
        </div>
        <h3 class="text-xl font-bold text-slate-900 mb-2">{{ modalState.title }}</h3>
        <p class="text-slate-500 mb-8">{{ modalState.message }}</p>
        <button @click="modalState.visible = false" :class="`w-full py-3 px-4 rounded-xl text-white font-bold text-lg shadow-lg ${modalState.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`">Entendido</button>
      </div>
    </div>

    <div class="print:hidden">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div class="flex items-center gap-3">
          <button @click="router.back()" class="p-2 hover:bg-slate-100 rounded-full text-slate-500"><ArrowLeft class="w-6 h-6" /></button>
          <div><h1 class="text-3xl font-bold text-slate-900">Cálculo de Borderô</h1><p class="text-slate-500 text-sm">Novo borderô de cheques ou antecipação.</p></div>
        </div>
        <div class="flex gap-3 items-center">
          
          <div class="relative">
            <select v-model="selectedCompany" class="appearance-none bg-slate-100 border border-slate-300 text-slate-700 font-bold py-2.5 pl-4 pr-8 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm">
              <option value="Fozesc">Fozesc</option>
              <option value="PQ">PQ</option>
            </select>
            <Building2 class="w-4 h-4 absolute right-3 top-3 text-slate-500 pointer-events-none" />
          </div>

          <button @click="exportarBordero" class="bg-white border border-slate-300 text-slate-700 px-5 py-2.5 rounded-lg font-bold shadow-sm flex items-center"><Printer class="w-5 h-5 mr-2" /> Simular</button>
          <button @click="verificarLimiteESalvar" class="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg font-bold shadow-md flex items-center"><Save class="w-5 h-5 mr-2" /> Efetivar</button>
        </div>
      </div>

      <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8 relative z-30">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          
          <div class="relative group">
            <ClientSelect 
              v-model="header.clienteId" 
              @select="selecionarCliente"
            />
            
            <div v-if="header.clienteId && header.clienteLimite > 0" class="absolute right-0 top-0 text-[10px] font-bold mt-1 mr-1">
               Disp: <span :class="header.clienteLimite - header.clienteDivida < 0 ? 'text-red-600' : 'text-emerald-600'">{{ formatCurrency(header.clienteLimite - header.clienteDivida) }}</span>
            </div>
          </div>

          <div class="relative group">
            <label class="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Emitente do Cheque</label>
            <input type="text" v-model="header.emitenteNome" placeholder="Quem assinou o cheque..." class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 h-[42px]" />
          </div>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div class="col-span-2 md:col-span-1">
            <label class="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Data</label>
            <input type="date" v-model="header.dataOperacao" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium" />
          </div>
          <div class="col-span-1 md:col-span-1">
            <label class="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Taxa (%)</label>
            <input type="number" step="0.01" v-model="header.taxaMensal" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800" />
          </div>
          <div class="col-span-1 md:col-span-1">
            <label class="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Compensação</label>
            <input type="number" v-model="header.diasCompensacao" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800" />
          </div>
          <div class="col-span-2 md:col-span-1">
            <label class="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Banco Padrão</label>
            <input type="text" v-model="header.bancoPadrao" placeholder="Ex: BB" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
           <div class="col-span-2 md:col-span-2">
            <label class="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Conta de Saída</label>
            <div class="flex bg-slate-50 p-1 rounded-lg border border-slate-200">
              <button @click="header.contaSaida = 'Dinheiro'" :class="`flex-1 py-1.5 text-xs font-bold rounded ${header.contaSaida === 'Dinheiro' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-400'}`"><Wallet class="w-3 h-3 inline mr-1" /> Dinheiro</button>
              <button @click="header.contaSaida = 'BB'" :class="`flex-1 py-1.5 text-xs font-bold rounded ${header.contaSaida === 'BB' ? 'bg-blue-100 text-blue-700' : 'text-slate-400'}`"><Calculator class="w-3 h-3 inline mr-1" /> BB</button>
              <button @click="header.contaSaida = 'Caixa'" :class="`flex-1 py-1.5 text-xs font-bold rounded ${header.contaSaida === 'Caixa' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400'}`"><Wallet class="w-3 h-3 inline mr-1" /> Caixa</button>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-indigo-100 mb-8 overflow-hidden relative z-10">
        <div class="bg-slate-50/80 px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <div class="flex bg-slate-200/60 p-1 rounded-xl">
            <button @click="gerador.modo = 'valor_mao'" :class="['px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2', gerador.modo === 'valor_mao' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500']"><div class="w-2 h-2 rounded-full bg-purple-500" v-if="gerador.modo === 'valor_mao'"></div> Líquido (Inverso)</button>
            <button @click="gerador.modo = 'valor_bruto'" :class="['px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2', gerador.modo === 'valor_bruto' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500']"><div class="w-2 h-2 rounded-full bg-indigo-500" v-if="gerador.modo === 'valor_bruto'"></div> Bruto (Padrão)</button>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex bg-slate-200/60 p-1 rounded-lg">
              <button @click="gerador.intervaloTipo = 'mensal'" :class="['px-3 py-1.5 text-xs font-bold rounded-md', gerador.intervaloTipo === 'mensal' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400']">Mensal</button>
              <button @click="gerador.intervaloTipo = 'dias'" :class="['px-3 py-1.5 text-xs font-bold rounded-md', gerador.intervaloTipo === 'dias' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400']">Dias</button>
            </div>
          </div>
        </div>

        <div class="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
          <div class="md:col-span-4">
            <label class="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Valor</label>
            <div class="relative group">
              <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><span class="text-indigo-500 font-bold text-lg">R$</span></div>
              <input type="number" v-model="gerador.valorAlvo" class="w-full pl-12 pr-4 h-12 bg-indigo-50/30 border border-indigo-100 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 font-bold text-lg text-slate-800" placeholder="0,00" />
            </div>
          </div>
          <div class="md:col-span-2">
            <label class="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Qtd</label>
            <input type="number" v-model="gerador.qtdParcelas" class="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 font-bold text-center text-slate-800" />
          </div>
          <div class="md:col-span-3">
            <label class="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">1º Vencimento</label>
            <input type="date" v-model="gerador.primeiroVencimento" class="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 font-medium text-slate-600" />
          </div>
          <div class="md:col-span-3">
            <button @click="gerarParcelas" class="w-full h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-transform"><Calculator class="w-5 h-5" /> Gerar Parcelas</button>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left whitespace-nowrap">
            <thead class="bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="px-4 py-3 text-xs font-bold text-slate-500 uppercase w-10">#</th>
                <th class="px-4 py-3 text-xs font-bold text-slate-500 uppercase w-40">Vencimento</th>
                <th class="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-center w-20">Dias</th>
                <th class="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-right">Valor Cheque</th>
                <th class="px-4 py-3 text-xs font-bold text-red-500 bg-red-50 uppercase text-right">Juros</th>
                <th class="px-4 py-3 text-xs font-bold text-emerald-600 bg-emerald-50 uppercase text-right">Líquido</th>
                <th class="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Banco / Doc</th>
                <th class="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="(item, index) in itens" :key="item.id" class="hover:bg-slate-50">
                <td class="px-4 py-3 text-xs font-bold text-slate-400">{{ index + 1 }}</td>
                <td class="px-4 py-3"><input type="date" v-model="item.vencimento" @change="recalcularLinha(item)" class="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-sm outline-none focus:border-indigo-500 text-slate-600 font-medium" /></td>
                <td class="px-4 py-3 text-center"><span class="inline-block bg-slate-200 text-slate-700 text-xs font-bold px-2 py-1 rounded min-w-[3rem]">{{ item.dias }}</span></td>
                <td class="px-4 py-3"><input type="number" step="0.01" v-model="item.valor" @input="recalcularLinha(item)" class="w-full text-right bg-white border border-slate-200 rounded px-2 py-1.5 text-sm font-bold text-slate-800 outline-none focus:border-indigo-500" /></td>
                <td class="px-4 py-3 text-right font-bold text-red-600 bg-red-50/30 text-sm">-{{ formatCurrency(item.juros) }}</td>
                <td class="px-4 py-3 text-right font-bold text-emerald-600 bg-emerald-50/30 text-sm">-{{ formatCurrency(item.liquido) }}</td>
                <td class="px-4 py-3"><div class="flex gap-2"><input type="text" v-model="item.banco" placeholder="Banco" class="w-20 bg-white border border-slate-200 rounded px-2 py-1.5 text-xs" /><input type="text" v-model="item.num_doc" placeholder="Doc" class="w-20 bg-white border border-slate-200 rounded px-2 py-1.5 text-xs" /></div></td>
                <td class="px-4 py-3 text-center"><button @click="removerLinha(index)" class="text-slate-300 hover:text-red-500"><Trash2 class="w-4 h-4" /></button></td>
              </tr>
            </tbody>
          </table>
          <div class="p-3 bg-slate-50 border-t border-slate-200"><button @click="adicionarLinha" class="w-full py-2 border border-dashed border-slate-300 rounded-lg text-slate-500 text-xs font-bold hover:bg-white hover:text-indigo-600 transition-all flex items-center justify-center gap-2"><Plus class="w-4 h-4" /> Adicionar Cheque</button></div>
        </div>
      </div>
    </div>
    
    <div class="print:hidden fixed bottom-0 left-0 right-0 bg-slate-900 text-white p-4 z-40 border-t border-slate-700 md:pl-64 shadow-lg">
      <div class="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
        <div class="flex gap-8 text-sm">
          <div><span class="block text-slate-400 text-[10px] uppercase font-bold tracking-wider">Bruto</span><span class="font-bold text-xl">-{{ formatCurrency(totais.bruto) }}</span></div>
          <div><span class="block text-slate-400 text-[10px] uppercase font-bold tracking-wider">Juros</span><span class="font-bold text-xl text-red-400">-{{ formatCurrency(totais.juros) }}</span></div>
        </div>
        <div class="flex items-center gap-4 bg-slate-800 px-6 py-2 rounded-xl border border-slate-700"><span class="text-xs font-bold text-indigo-300 uppercase tracking-widest text-right">Líquido<br>a Pagar</span><span class="text-3xl font-extrabold text-white">{{ formatCurrency(totais.liquido) }}</span></div>
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
        <div><p><strong class="uppercase text-gray-500 text-xs">Taxa:</strong></p><p class="font-mono">{{ header.taxaMensal }}% a.m.</p></div>
      </div>
      
      <table class="w-full text-left text-xs mb-8 border-collapse">
        <thead><tr class="border-b-2 border-black"><th class="py-2">Vencimento</th><th class="py-2 text-center">Dias</th><th class="py-2 text-right">Valor Face</th><th class="py-2 text-right">Juros</th><th class="py-2 text-right">Líquido</th></tr></thead>
        <tbody>
          <tr v-for="item in itens" :key="item.id" class="border-b border-gray-200">
            <td class="py-2 font-mono">{{ item.vencimento.split('-').reverse().join('/') }}</td>
            <td class="py-2 text-center">{{ item.dias }}</td>
            <td class="py-2 text-right font-bold">{{ formatCurrency(item.valor) }}</td>
            <td class="py-2 text-right">{{ formatCurrency(item.juros) }}</td>
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