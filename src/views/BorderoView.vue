<script setup>
import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue';
import DashboardLayout from '../layouts/DashboardLayout.vue';
import { Plus, Trash2, Save, ArrowLeft, User, RefreshCw, Sparkles, Target, Printer, Wallet } from 'lucide-vue-next';
import { useRouter } from 'vue-router';
import BaseDateInput from '../components/common/BaseDateInput.vue';

const router = useRouter();

// --- ESTADO DE IMPRESSÃO ---
const isPrinting = ref(false); // Controla se o papel de impressão existe no DOM

// --- HEADER ---
const header = reactive({
  cliente: '',
  dataOperacao: new Date().toISOString().split('T')[0],
  taxaMensal: 4.00,
  diasCompensacao: 2,
  observacao: ''
});

// --- GERADOR ---
const gerador = reactive({
  modo: 'valor_mao', 
  valorAlvo: 4286.60, 
  qtdParcelas: 4,
  primeiroVencimento: '',
  intervaloTipo: 'mensal',
  diasIntervalo: 30
});

const itens = ref([]);

// Utils
const arredondar = (valor) => Math.round((valor + Number.EPSILON) * 100) / 100;

const getDataLimpa = (dataStr) => {
  if (!dataStr) return null;
  const [ano, mes, dia] = dataStr.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0));
};

const formatDateBr = (isoDate) => {
  if (!isoDate) return '-';
  const [ano, mes, dia] = isoDate.split('-');
  return `${dia}/${mes}/${ano}`;
};

const getCurrentDateTime = () => {
  const now = new Date();
  return now.toLocaleString('pt-BR');
};

onMounted(() => {
  const hoje = new Date();
  hoje.setDate(hoje.getDate() + 30);
  gerador.primeiroVencimento = hoje.toISOString().split('T')[0];
  adicionarLinha(); 
});

// --- CÁLCULO ---
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
  if (!item.valor || item.dias <= 0) { item.juros = 0; item.liquido = item.valor || 0; return; }
  const valorPresente = Number(item.valor);
  const taxaDecimal = Number(header.taxaMensal) / 100;
  const totalMes = item.dias / 30.0;
  const fator = Math.pow(1 + taxaDecimal, totalMes);
  const valorFuturo = valorPresente * fator; 
  item.juros = arredondar(valorFuturo - valorPresente);
  item.liquido = valorPresente - item.juros;
};

const recalcularTudo = () => { itens.value.forEach(recalcularLinha); };

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

watch(() => [header.dataOperacao, header.taxaMensal, header.diasCompensacao], () => recalcularTudo());
const adicionarLinha = () => { itens.value.push({ id: Date.now(), vencimento: '', valor: 0, dias: 0, juros: 0, liquido: 0, banco: '', num_doc: '' }); };
const removerLinha = (index) => { itens.value.splice(index, 1); recalcularTudo(); };
const totais = computed(() => {
  return itens.value.reduce((acc, item) => {
    acc.bruto += Number(item.valor || 0); acc.juros += Number(item.juros || 0); acc.liquido += Number(item.liquido || 0); return acc;
  }, { bruto: 0, juros: 0, liquido: 0 });
});
const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

const salvarBordero = () => {
  if (!header.cliente) return alert("Selecione um cliente.");
  if (totais.value.bruto <= 0) return alert("O borderô está vazio.");
  alert(`Operação Salva!\nLíquido: ${formatCurrency(totais.value.liquido)}`);
};

// --- NOVA LÓGICA DE IMPRESSÃO (SEM SOMBRA / SEM SIDEBAR) ---
const exportarBordero = async () => {
  // 1. Ativa o "Modo Impressão" (Isso renderiza o Teleport)
  isPrinting.value = true;
  
  // 2. Espera o Vue desenhar o papel na tela
  await nextTick();
  
  // 3. Abre a janela de impressão
  window.print();
  
  // 4. (Opcional) Desliga o modo impressão depois que a janela fecha
  // O navegador pausa o JS enquanto imprime, então isso roda depois
  isPrinting.value = false;
};
</script>

<template>
  <DashboardLayout>
    
    <div>
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div class="flex items-center gap-3">
          <button @click="router.back()" class="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"><ArrowLeft class="w-6 h-6" /></button>
          <div><h1 class="text-3xl font-bold text-slate-900 tracking-tight">Cálculo de Borderô</h1><p class="text-slate-500 text-sm">Cálculo Exato (Fórmula Planilha).</p></div>
        </div>
        <div class="flex gap-3">
          <button @click="exportarBordero" class="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2.5 rounded-lg font-bold shadow-sm flex items-center transition-all">
            <Printer class="w-5 h-5 mr-2" /> Imprimir Relatório
          </button>
          <button @click="salvarBordero" class="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg font-bold shadow-md flex items-center transition-all">
            <Save class="w-5 h-5 mr-2" /> Efetivar Operação
          </button>
        </div>
      </div>

      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 mb-6 grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
        <div class="md:col-span-4"><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Cliente</label><div class="relative"><User class="w-4 h-4 absolute left-3 top-3 text-slate-400" /><input v-model="header.cliente" type="text" class="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:border-emerald-500 outline-none font-medium" placeholder="Nome do cliente..." /></div></div>
        <div class="md:col-span-3"><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Data Operação</label><BaseDateInput v-model="header.dataOperacao" /></div>
        <div class="md:col-span-2"><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Taxa Mensal</label><div class="relative"><input v-model="header.taxaMensal" type="number" step="0.01" class="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:border-emerald-500 outline-none font-bold text-slate-800 text-right" /><span class="absolute right-3 top-2 text-slate-500 font-bold">%</span></div></div>
        <div class="md:col-span-3"><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Compensação (Dias)</label><input v-model="header.diasCompensacao" type="number" class="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:border-emerald-500 outline-none font-bold text-slate-800" /></div>
      </div>

      <div class="bg-indigo-50 border border-indigo-100 p-5 rounded-xl mb-6 relative overflow-hidden transition-all" :class="gerador.modo === 'valor_mao' ? 'bg-purple-50 border-purple-100' : ''">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <div class="p-1.5 rounded-md" :class="gerador.modo === 'valor_mao' ? 'bg-purple-200' : 'bg-indigo-100'">
              <Target v-if="gerador.modo === 'valor_mao'" class="w-4 h-4 text-purple-700" />
              <Sparkles v-else class="w-4 h-4 text-indigo-600" />
            </div>
            <h3 class="text-sm font-bold uppercase tracking-wide" :class="gerador.modo === 'valor_mao' ? 'text-purple-800' : 'text-indigo-800'">{{ gerador.modo === 'valor_mao' ? 'Inverso (Empréstimo)' : 'Padrão (Troca)' }}</h3>
          </div>
          <div class="flex bg-white/50 p-1 rounded-lg border border-slate-200">
            <button @click="gerador.modo = 'valor_face'" :class="gerador.modo === 'valor_face' ? 'bg-white shadow-sm text-indigo-700 font-bold' : 'text-slate-500 hover:text-slate-700'" class="px-3 py-1 text-xs rounded-md transition-all">Padrão</button>
            <button @click="gerador.modo = 'valor_mao'" :class="gerador.modo === 'valor_mao' ? 'bg-white shadow-sm text-purple-700 font-bold' : 'text-slate-500 hover:text-slate-700'" class="px-3 py-1 text-xs rounded-md transition-all">Inverso</button>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-end relative z-10">
          <div class="md:col-span-3">
            <label class="block text-xs font-bold uppercase mb-1" :class="gerador.modo === 'valor_mao' ? 'text-purple-600' : 'text-indigo-400'">{{ gerador.modo === 'valor_mao' ? 'Valor Líquido Desejado' : 'Valor Total dos Cheques' }}</label>
            <input v-model="gerador.valorAlvo" type="number" class="w-full px-3 py-2 bg-white border rounded-lg focus:ring-2 outline-none font-bold text-slate-800 text-lg" :class="gerador.modo === 'valor_mao' ? 'border-purple-200 focus:ring-purple-300' : 'border-indigo-200 focus:ring-indigo-300'" />
          </div>
          <div class="md:col-span-2"><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Nº Parcelas</label><input v-model="gerador.qtdParcelas" type="number" min="1" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-300 outline-none font-bold text-slate-800" /></div>
          <div class="md:col-span-3"><label class="block text-xs font-bold text-slate-500 uppercase mb-1">1º Vencimento</label><BaseDateInput v-model="gerador.primeiroVencimento" /></div>
          <div class="md:col-span-2">
            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Intervalo</label>
            <div class="flex rounded-lg border border-slate-300 bg-white overflow-hidden">
              <button @click="gerador.intervaloTipo = 'mensal'" class="flex-1 py-2 text-xs font-bold transition-colors border-r border-slate-200" :class="gerador.intervaloTipo === 'mensal' ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:bg-slate-50'">Mensal</button>
              <button @click="gerador.intervaloTipo = 'dias'" class="flex-1 py-2 text-xs font-bold transition-colors" :class="gerador.intervaloTipo === 'dias' ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:bg-slate-50'">Dias</button>
            </div>
          </div>
          <div class="md:col-span-2"><button @click="gerarParcelas" class="w-full font-bold py-2 px-4 rounded-lg shadow-sm transition-all flex items-center justify-center text-white" :class="gerador.modo === 'valor_mao' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-indigo-600 hover:bg-indigo-700'"><RefreshCw class="w-4 h-4 mr-2" /> Calcular</button></div>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-32">
        <div class="overflow-x-auto min-h-[300px]">
          <table class="w-full text-left whitespace-nowrap">
            <thead class="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
              <tr><th class="px-4 py-3 w-10 text-center">#</th><th class="px-4 py-3 w-48">Vencimento</th><th class="px-4 py-3 w-20 text-center">Dias</th><th class="px-4 py-3 w-40 text-right">Valor Cheque</th><th class="px-4 py-3 w-40 text-right bg-red-50 text-red-700">Juros Previsto</th><th class="px-4 py-3 w-40 text-right bg-emerald-50 text-emerald-700">Líquido</th><th class="px-4 py-3">Banco / Doc</th><th class="px-4 py-3 w-10"></th></tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="(item, index) in itens" :key="item.id" class="group hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3 text-center text-slate-400 text-xs font-bold">{{ index + 1 }}</td>
                <td class="px-4 py-3"><BaseDateInput v-model="item.vencimento" @change="recalcularLinha(item)" /></td>
                <td class="px-4 py-3 text-center"><span :class="item.dias > 0 ? 'bg-slate-200 text-slate-700' : 'bg-red-100 text-red-600'" class="px-2 py-1 rounded text-xs font-bold block w-full">{{ item.dias }}</span></td>
                <td class="px-4 py-3 text-right"><input v-model="item.valor" @input="recalcularLinha(item)" type="number" step="0.01" class="w-full bg-white border border-slate-300 rounded pl-2 pr-2 py-1.5 text-sm focus:border-emerald-500 outline-none font-bold text-slate-800 text-right" /></td>
                <td class="px-4 py-3 text-right bg-red-50/30 font-bold text-red-600 text-sm">{{ formatCurrency(item.juros) }}</td>
                <td class="px-4 py-3 text-right bg-emerald-50/30 font-bold text-emerald-700 text-sm">{{ formatCurrency(item.liquido) }}</td>
                <td class="px-4 py-3"><div class="flex gap-2"><input v-model="item.banco" placeholder="Banco" class="w-1/2 bg-white border border-slate-300 rounded px-2 py-1.5 text-xs outline-none" /><input v-model="item.num_doc" placeholder="Doc" class="w-1/2 bg-white border border-slate-300 rounded px-2 py-1.5 text-xs outline-none" /></div></td>
                <td class="px-4 py-3 text-center"><button @click="removerLinha(index)" class="text-slate-300 hover:text-red-500 transition-colors"><Trash2 class="w-4 h-4" /></button></td>
              </tr>
            </tbody>
          </table>
          <div class="p-3 bg-slate-50 border-t border-slate-200 flex justify-center"><button @click="adicionarLinha" class="text-sm font-bold text-slate-600 hover:text-emerald-600 flex items-center px-4 py-2 border border-dashed border-slate-300 rounded-full hover:bg-white hover:border-emerald-400 transition-all"><Plus class="w-4 h-4 mr-2" /> Adicionar Título Individual</button></div>
        </div>
      </div>

      <div class="fixed bottom-0 left-64 right-0 bg-slate-900 text-white p-4 shadow-2xl z-40 border-t-4 border-emerald-500">
        <div class="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div class="flex gap-10 text-sm">
            <div><span class="text-slate-400 text-xs uppercase font-bold">Bruto Total</span><span class="block text-xl font-bold text-white">{{ formatCurrency(totais.bruto) }}</span></div>
            <div><span class="text-slate-400 text-xs uppercase font-bold">Total Juros</span><span class="block text-xl font-bold text-red-400">{{ formatCurrency(totais.juros) }}</span></div>
          </div>
          <div class="flex items-center gap-4 bg-slate-800 px-8 py-2 rounded-lg border border-slate-700">
            <span class="text-xs uppercase font-bold text-right leading-tight" :class="gerador.modo === 'valor_mao' ? 'text-purple-400' : 'text-emerald-400'">Valor Líquido<br>A PAGAR</span>
            <span class="text-4xl font-bold" :class="gerador.modo === 'valor_mao' ? 'text-purple-400' : 'text-emerald-400'">{{ formatCurrency(totais.liquido) }}</span>
          </div>
        </div>
      </div>
    </div>

  </DashboardLayout>

  <Teleport to="body">
    <div v-if="isPrinting" class="print-overlay">
      <div class="print-paper">
        
        <div class="flex justify-between items-start border-b-2 border-slate-800 pb-6 mb-8">
          <div class="flex items-center gap-4">
            <div class="bg-slate-900 text-white p-3 rounded-lg">
              <Wallet class="w-8 h-8" />
            </div>
            <div>
              <h1 class="text-2xl font-bold uppercase tracking-wide text-slate-900 leading-none">Extrato de Borderô</h1>
              <p class="text-sm text-slate-500 mt-1">Fozesc - Gestão Financeira</p>
            </div>
          </div>
          <div class="text-right">
            <div class="text-sm text-slate-500 mb-1">Emissão</div>
            <div class="text-lg font-bold text-slate-900">{{ getCurrentDateTime() }}</div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-8 mb-8">
          <div class="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Dados do Cliente</h3>
            <div class="text-lg font-bold text-slate-900 mb-1">{{ header.cliente || 'Consumidor Final' }}</div>
            <div class="text-sm text-slate-600">Operação #{{ Date.now().toString().slice(-6) }}</div>
          </div>
          <div class="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Condições</h3>
            <div class="grid grid-cols-2 gap-4">
              <div><span class="block text-xs text-slate-500">Data Base</span><span class="font-bold text-slate-900">{{ formatDateBr(header.dataOperacao) }}</span></div>
              <div><span class="block text-xs text-slate-500">Taxa</span><span class="font-bold text-slate-900">{{ header.taxaMensal }}%</span></div>
              <div><span class="block text-xs text-slate-500">Compensação</span><span class="font-bold text-slate-900">{{ header.diasCompensacao }} Dias</span></div>
            </div>
          </div>
        </div>

        <table class="w-full text-left mb-8 border-collapse">
          <thead>
            <tr class="border-b-2 border-slate-800">
              <th class="py-2 text-xs font-bold uppercase text-slate-600">Vencimento</th>
              <th class="py-2 text-xs font-bold uppercase text-slate-600 text-center">Dias</th>
              <th class="py-2 text-xs font-bold uppercase text-slate-600">Banco / Doc</th>
              <th class="py-2 text-xs font-bold uppercase text-slate-600 text-right">Valor Face</th>
              <th class="py-2 text-xs font-bold uppercase text-slate-600 text-right">Juros</th>
              <th class="py-2 text-xs font-bold uppercase text-slate-600 text-right">Líquido</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in itens" :key="item.id" class="border-b border-slate-200">
              <td class="py-3 text-sm font-medium text-slate-900">{{ formatDateBr(item.vencimento) }}</td>
              <td class="py-3 text-sm text-slate-600 text-center">{{ item.dias }}</td>
              <td class="py-3 text-sm text-slate-600">{{ item.banco || '-' }} / {{ item.num_doc || '-' }}</td>
              <td class="py-3 text-sm font-medium text-slate-900 text-right">{{ formatCurrency(item.valor) }}</td>
              <td class="py-3 text-sm text-red-600 text-right">- {{ formatCurrency(item.juros) }}</td>
              <td class="py-3 text-sm font-bold text-emerald-700 text-right">{{ formatCurrency(item.liquido) }}</td>
            </tr>
          </tbody>
        </table>

        <div class="flex justify-end mb-16">
          <div class="w-1/2">
            <div class="flex justify-between py-2 border-b border-slate-200">
              <span class="text-sm text-slate-600">Total Bruto</span>
              <span class="text-sm font-bold text-slate-900">{{ formatCurrency(totais.bruto) }}</span>
            </div>
            <div class="flex justify-between py-2 border-b border-slate-200">
              <span class="text-sm text-slate-600">Total Desconto</span>
              <span class="text-sm font-bold text-red-600">- {{ formatCurrency(totais.juros) }}</span>
            </div>
            <div class="flex justify-between py-3 border-b-2 border-slate-900 mt-2">
              <span class="text-base font-bold text-slate-900 uppercase">Líquido a Pagar</span>
              <span class="text-xl font-extrabold text-emerald-600">{{ formatCurrency(totais.liquido) }}</span>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-12 pt-8 mt-8 border-t border-dashed border-slate-300 break-inside-avoid">
          <div class="text-center">
            <div class="border-b border-slate-400 mb-2 w-3/4 mx-auto"></div>
            <span class="text-xs font-bold text-slate-500 uppercase">Fozesc</span>
          </div>
          <div class="text-center">
            <div class="border-b border-slate-400 mb-2 w-3/4 mx-auto"></div>
            <span class="text-xs font-bold text-slate-500 uppercase">{{ header.cliente || 'Cliente' }}</span>
          </div>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<style>
@media print {
  /* 1. ESCONDE O APP INTEIRO (Sidebars, Menus, Fundo Cinza) */
  #app {
    display: none !important;
  }

  /* 2. CONFIGURA O PAPEL */
  @page {
    margin: 0;
    size: auto;
  }

  /* 3. RESETA O BODY PARA SER BRANCO PURO */
  body {
    margin: 0 !important;
    padding: 0 !important;
    background-color: white !important;
    overflow: visible !important;
  }

  /* 4. EXIBE APENAS O NOSSO TELEPORT */
  .print-overlay {
    display: block !important;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    min-height: 100vh;
    background: white;
    z-index: 999999; /* Z-Index Supremo */
  }

  .print-paper {
    padding: 15mm 15mm;
    background: white;
    box-shadow: none !important; /* MATA A SOMBRA AQUI */
  }

  /* 5. SEGURANÇA EXTRA: Remove sombras de TUDO */
  * {
    box-shadow: none !important;
    text-shadow: none !important;
  }
}
</style>