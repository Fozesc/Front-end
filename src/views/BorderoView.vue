<script setup>
import { hojeLocal, somarDiasLocal } from '../utils/datas';
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { AJUDA } from '../utils/ajuda';
import DashboardLayout from '../layouts/DashboardLayout.vue';
import {
  Plus, Trash2, Save, ArrowLeft, Printer, Calculator,
  AlertTriangle, CheckCircle, Loader2, Building2, CalendarClock, X, Split, FileText
} from 'lucide-vue-next';
import { useRouter } from 'vue-router';
import { avisar } from '../utils/avisos';
import { documentosDoBordero, documentosDoContrato } from '../utils/documentosBordero';
import VisualizadorDocumentos from '../components/common/VisualizadorDocumentos.vue';
import operationService from '../services/operationService';
import checkService from '../services/checkService';
import ClientSelect from '../components/inputs/ClientSelect.vue';
import ComissaoVale from '../components/layout/finance/ComissaoVale.vue';
import api from '../services/api';
import { motivoNaoUtil, proximoDiaUtil } from '../utils/diasUteis';
import { CONTAS, partesFecham, partesParaEnviar, somaPartes } from '../utils/contasCaixa';
import PartesPagamento from '../components/layout/finance/PartesPagamento.vue';
import { REGRA_REPUTACAO } from '../utils/reputacao';
import MedidorReputacao from '../components/common/MedidorReputacao.vue';
import {
  parcelaRedonda, calcularDias, calcularLinha, calcularComissao, divisorInverso, iofDasConfiguracoes,
  IOF_BASE_PADRAO, IOF_DIARIO_PADRAO, DIAS_COMPENSACAO_PADRAO
} from '../utils/calculoBordero';

const router = useRouter();

// Estilo dos campos da tela num lugar so (todos com a mesma altura).
const rotulo = 'block text-[13px] font-medium text-slate-700 mb-1.5';
const campo = 'h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-xs outline-none transition-shadow placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 disabled:bg-slate-50 disabled:text-slate-400';
const campoTabela = 'h-8 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none transition-shadow placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15';
const segmento = (ativo) => ['flex-1 px-3 rounded-[5px] text-[13px] font-medium transition-colors whitespace-nowrap',
  ativo ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800'];

const loading = ref(false);

// PQ e' a empresa do dia a dia; a Fozesc e' a dos contratos (escolhida quando precisa)
const selectedCompany = ref('PQ');
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
const empresa = ref({});

const TIPOS_TITULO = [{ id: 'CHEQUE', nome: 'Cheques' }, { id: 'PROMISSORIA', nome: 'Promissórias' }];
const ehPromissoria = computed(() => header.tipo === 'PROMISSORIA');
const nome = computed(() => (ehPromissoria.value ? { um: 'promissória', varios: 'promissórias' } : { um: 'cheque', varios: 'cheques' }));
// nome, CNPJ e endereco da empresa escolhida no topo (Ajustes > Empresas): vao no borderô impresso e na promissoria
const empresaAtual = computed(() => {
  const e = empresa.value;
  return selectedCompany.value === 'PQ'
    ? { nome: e.pqNome || 'PQ', cnpj: e.pqCnpj, endereco: e.pqEndereco }
    : { nome: e.nomeEmpresa || 'Fozesc', cnpj: e.cnpj, endereco: e.endereco };
});
// na promissoria quem assina e' o proprio cliente
const emitenteFinal = () => (ehPromissoria.value ? header.clienteNome : header.emitenteNome);
const numeroTitulo = (item, i) => item.num_doc || (ehPromissoria.value ? `${i + 1}/${itens.value.length}` : '');

const header = reactive({
  clienteId: null,
  clienteNome: '',
  clienteDocumento: '',
  clienteTelefone: '',
  clienteLimite: 0,      
  clienteDivida: 0,      
  clienteReputacao: null,
  clienteEndereco: '',
  emitenteNome: '',
  tipo: 'CHEQUE',
  avalistaNome: '',
  avalistaDocumento: '',
  dataOperacao: hojeLocal(),
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
// o que este emitente ja tem com a empresa (em aberto e problemas), para decidir antes de aceitar
const riscoEmitente = ref(null);
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
  riscoEmitente.value = null;
  if (termo.length < 3) { emitenteNovo.value = false; return; }
  try {
    const [achados, risco] = await Promise.all([checkService.emitentes(termo), checkService.riscoEmitentes(termo)]);
    emitenteNovo.value = !achados.some(n => n.toLowerCase() === termo.toLowerCase());
    riscoEmitente.value = risco && (risco.em_aberto > 0 || risco.devolvidos || risco.juridico || risco.vencidos) ? risco : null;
  } catch (e) {
    emitenteNovo.value = false;
  }
};
const problemasEmitente = computed(() => {
  const r = riscoEmitente.value;
  if (!r) return '';
  return [r.devolvidos && `${r.devolvidos} devolvido(s)`, r.juridico && `${r.juridico} no jurídico`,
    r.vencidos && `${r.vencidos} vencido(s) sem pagar`].filter(Boolean).join(', ');
});

const fetchSettings = async () => {
  try {
    const { data } = await api.get('/settings/');
    if (data) {
      empresa.value = data;
      const { iofBase, iofDiario } = iofDasConfiguracoes(data);
      header.iofBase = iofBase;
      header.iofDiario = iofDiario;
    }
  } catch (error) {
    console.error("Usando IOF padrão (Fixo: 0.38% / Diário: 0.0041%)");
  }
};


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
    header.clienteDocumento = ''; header.clienteTelefone = ''; header.clienteEndereco = '';
    header.clienteLimite = 0; header.clienteDivida = 0; header.clienteReputacao = null;
    return;
  }
  header.clienteId = cliente.id;
  header.clienteNome = cliente.name;
  header.clienteDocumento = cliente.document || '';
  header.clienteTelefone = cliente.phone || '';
  header.clienteEndereco = [cliente.address, cliente.neighborhood, [cliente.city, cliente.state].filter(Boolean).join('/'),
    cliente.zip_code && `CEP ${cliente.zip_code}`].filter(Boolean).join(' - ');
  if (cliente.standard_rate) header.taxaMensal = cliente.standard_rate;
  header.clienteLimite = cliente.credit_limit || 0;
  header.clienteDivida = cliente.valor_em_aberto || 0; 
  header.clienteReputacao = cliente.reputacao || null;
  if (!header.emitenteNome) { header.emitenteNome = cliente.name; conferirEmitente(); }
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
const nomeConta = (id) => CONTAS.find(c => c.id === id)?.nome || id;

// saida dividida (2.11.2): o liquido sai de mais de uma conta, quanto de cada uma. A conta "do
// borderô" (comissao, linha de total) passa a ser a da maior parte.
const DIVIDIR = 'dividir';
const partesSaida = ref([]);
const dividida = computed(() => header.contaSaida === DIVIDIR);
const contaPrincipal = computed(() => (!dividida.value ? header.contaSaida
  : [...partesSaida.value].sort((a, b) => (Number(b.valor) || 0) - (Number(a.valor) || 0))[0]?.conta || 'Dinheiro'));

const comissaoInvalida = computed(() => {
  const c = Number(header.comissao || 0);
  return !(c >= 0 && c <= Number(header.taxaMensal || 0));
});
// invalida conta como zero: totais e impressao nao mostram numero que nao vai ser gravado
const comissao = computed(() => (comissaoInvalida.value ? { valor: 0, parte: 0 } : calcularComissao({
  juros: totais.value.juros, comissao: header.comissao, taxaMensal: header.taxaMensal
})));
// comissao descontada de um vale (opcional): so o que passar do vale sai do caixa
const abaterVale = ref(false);
const valeId = ref(null);
const comissaoVale = ref(null);
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

  // a parcela que o cliente paga sai sem centavos: sobe para o proximo real (versao 2.11.3)
  const valorParcelaBruta = parcelaRedonda(gerador.modo === 'valor_mao'
    ? gerador.valorAlvo / divisores.reduce((soma, d) => soma + d, 0)
    : gerador.valorAlvo / gerador.qtdParcelas);

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

const exportarBordero = () => window.print();

// documentos do borderô efetivado: o visualizador mostra antes de baixar (borderô, promissorias e, na Fozesc,
// o contrato gerado sozinho e o borderô da operação). Os dados vem do que foi gravado.
const visualizador = ref(null);
const abrindoDocumentos = ref(false);
const contratoGerado = ref(false);
const verDocumentos = async (inicial = '') => {
  if (abrindoDocumentos.value) return;
  abrindoDocumentos.value = true;
  try {
    visualizador.value = { titulo: `Borderô #${lastOperationId.value}`, documentos: await documentosDoBordero(lastOperationId.value), inicial };
  } catch (e) {
    console.error(e);
    avisar('Não foi possível abrir os documentos. Tente de novo.');
  } finally {
    abrindoDocumentos.value = false;
  }
};

const novoBordero = () => {
  modalState.visible = false;
  limparRascunho();
  rascunhoRecuperado.value = false;
  chaveCliente.value++;
  partesSaida.value = [{ conta: 'Dinheiro', forma: 'Dinheiro', valor: 0 }, { conta: 'BB', forma: 'PIX', valor: 0 }];
  itens.value = [];
  adicionarLinha();
  gerador.valorAlvo = 0;
  header.clienteId = null; header.clienteNome = '';
  header.clienteDocumento = ''; header.clienteTelefone = ''; header.clienteEndereco = '';
  header.clienteLimite = 0; header.clienteDivida = 0; header.clienteReputacao = null;
  riscoEmitente.value = null;
  header.comissao = 0;
  header.avalistaNome = ''; header.avalistaDocumento = '';
  contratoGerado.value = false;
  visualizador.value = null;
  abaterVale.value = false;
  valeId.value = null;
  lastOperationId.value = null;
  fetchNextId();
};

const verificarLimiteESalvar = () => {
  if (loading.value) return;
  if (!header.clienteId) return showPopup('Atenção', 'Selecione um cliente válido.', 'error');
  if (!ehPromissoria.value && !header.emitenteNome) return showPopup('Atenção', 'Informe o emitente.', 'error');
  if (itens.value.length === 0 || totais.value.bruto <= 0) return showPopup('Atenção', 'Borderô vazio.', 'error');
  if (dividida.value && !partesFecham(partesSaida.value, totais.value.liquido)) {
    return showPopup('Atenção', `A saída dividida tem que somar o líquido do borderô (${formatCurrency(totais.value.liquido)}). `
      + `Hoje soma ${formatCurrency(somaPartes(partesSaida.value))}.`, 'error');
  }
  if (itens.value.some(i => !i.vencimento)) return showPopup('Erro', 'Datas inválidas.', 'error');
  const zerado = itens.value.findIndex(i => !(Number(i.valor) > 0) || !(Number(i.liquido) > 0));
  if (zerado >= 0) return showPopup('Atenção', `${ehPromissoria.value ? 'A promissória' : 'O cheque'} ${zerado + 1} está com valor ou líquido zerado/negativo (juros maiores que o valor). Corrija antes de efetivar.`, 'error');
  if (comissaoInvalida.value) return showPopup('Atenção', `A comissão tem que ficar entre 0 e a taxa (${header.taxaMensal}%).`, 'error');
  if (abaterVale.value && !(comissao.value.valor > 0)) return showPopup('Atenção', 'Preencha a comissão para descontar do vale.', 'error');
  if (abaterVale.value && !valeId.value) return showPopup('Atenção', 'Escolha o vale que vai receber a comissão.', 'error');

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

// Fozesc: antes de gravar mostra o contrato e o borderô da operação montados pelo servidor com os numeros
// deste borderô (nada e' gravado); "Efetivar borderô" na previa chama de novo com confirmado = true
const efetivarDaPrevia = () => {
  visualizador.value = null;
  processarSalvamento(true);
};

const processarSalvamento = async (confirmado = false) => {
  limitModal.visible = false;
  loading.value = true;
  try {
    const payload = {
      client_id: header.clienteId,
      operation_date: header.dataOperacao,
      taxa_mensal: header.taxaMensal,
      dias_compensacao: header.diasCompensacao,
      account_source: contaPrincipal.value,
      ...(dividida.value ? { partes: partesParaEnviar(partesSaida.value) } : {}),
      iof_amount: totais.value.iof,
      total_net: totais.value.liquido, // valor realmente emprestado (o que sai do caixa) = face - juros - IOF
      notes: header.observacao,
      comissao: Number(header.comissao) || 0,
      ...(abaterVale.value && valeId.value ? { vale_id: valeId.value } : {}),
      // o servidor grava exatamente estes centavos (depois de conferir com a mesma conta)
      iof_enabled: header.iofEnabled,
      empresa: selectedCompany.value,
      ...(ehPromissoria.value ? { avalista_nome: header.avalistaNome, avalista_documento: header.avalistaDocumento } : {}),
      iof_base: header.iofBase,
      iof_diario: header.iofDiario,
      checks: itens.value.map((item, i) => ({
        valor: item.valor, vencimento: item.vencimento,
        juros: item.juros, iof: item.iof, liquido: item.liquido, tipo: header.tipo,
        banco: ehPromissoria.value ? '' : (item.banco || ''), num_doc: numeroTitulo(item, i), emitente: emitenteFinal()
      }))
    };
    if (selectedCompany.value === 'Fozesc' && confirmado !== true) {
      const previa = await operationService.previa(payload);
      visualizador.value = { titulo: `Prévia do contrato · Borderô #${previa.bordero.id}`, inicial: 'contrato',
        documentos: documentosDoContrato(async () => previa, previa.bordero.id), confirmar: 'Efetivar borderô' };
      return;
    }
    const resposta = await operationService.create(payload);
    limparRascunho();
    rascunhoRecuperado.value = false;

    lastOperationId.value = resposta.id;
    contratoGerado.value = !!resposta.contrato_gerado;
    // a tela so limpa quando o aviso fecha: tem navegador (Safari) que monta a impressao
    // depois, e ai imprimia a tela ja limpa com o aviso por cima
    showPopup('Sucesso!', `Operação #${resposta.id} realizada!\nLíquido: ${formatCurrency(resposta.total_net)}`
      + (resposta.comissao_valor > 0 ? `\nComissão: ${formatCurrency(resposta.comissao_valor)}` : '')
      + (resposta.comissao_valor > 0 && abaterVale.value && valeId.value
        ? ` · ${formatCurrency(comissaoVale.value?.noVale)} descontados do vale #${valeId.value}` : ''));
    // Fozesc: o contrato ja vem montado; abre direto nele para conferir
    if (contratoGerado.value) verDocumentos('contrato');
  } catch (error) {
    showPopup('Erro', error.response?.data?.error || "Erro ao salvar.", 'error');
  } finally {
    loading.value = false;
  }
};

// Rascunho (versao 2.11.3): o borderô que esta sendo montado fica guardado nesta aba. Se o login
// vencer no meio (o Efetivar volta para o login) ou a pagina recarregar, ao voltar ele reaparece.
const CHAVE_RASCUNHO = 'fozesc_rascunho_bordero';
const rascunhoRecuperado = ref(false);
const chaveCliente = ref(0);
let timerRascunho = null;
const limparRascunho = () => { try { sessionStorage.removeItem(CHAVE_RASCUNHO); } catch { /* aba anonima */ } };
watch([() => header, itens, partesSaida, selectedCompany], () => {
  clearTimeout(timerRascunho);
  timerRascunho = setTimeout(() => {
    const temAlgo = header.clienteId || itens.value.some(i => Number(i.valor) > 0);
    try {
      if (temAlgo) sessionStorage.setItem(CHAVE_RASCUNHO, JSON.stringify({ header, itens: itens.value, partes: partesSaida.value, empresa: selectedCompany.value }));
    } catch { /* cheio ou aba anonima: so nao guarda */ }
  }, 400);
}, { deep: true });

const recuperarRascunho = () => {
  let r = null;
  try { r = JSON.parse(sessionStorage.getItem(CHAVE_RASCUNHO) || 'null'); } catch { r = null; }
  if (!r?.itens?.length) return;
  Object.assign(header, r.header);
  itens.value = r.itens;
  if (Array.isArray(r.partes) && r.partes.length) partesSaida.value = r.partes;
  if (['PQ', 'Fozesc'].includes(r.empresa)) selectedCompany.value = r.empresa;
  chaveCliente.value++;
  recalcularTudo();
  rascunhoRecuperado.value = true;
};
const descartarRascunho = () => { limparRascunho(); rascunhoRecuperado.value = false; novoBordero(); };

onMounted(async () => {
  gerador.primeiroVencimento = somarDiasLocal(30);
  
  await fetchSettings(); 
  adicionarLinha(); 
  recuperarRascunho();
});
</script>

<template>
  <DashboardLayout>

    <div v-if="limitModal.visible" class="print:hidden fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
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

    <div v-if="modalState.visible" class="print:hidden fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
      <div class="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full text-center animate-scale-in">
        <div :class="['mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4', modalState.type === 'error' ? 'bg-red-100' : 'bg-emerald-100']">
          <CheckCircle v-if="modalState.type === 'success'" class="h-6 w-6 text-emerald-600" /><AlertTriangle v-else class="h-6 w-6 text-red-600" />
        </div>
        <h3 class="text-lg font-semibold text-slate-900 mb-1">{{ modalState.title }}</h3>
        <p class="text-slate-500 text-sm mb-6 whitespace-pre-line">{{ modalState.message }}</p>
        <template v-if="lastOperationId">
          <button @click="verDocumentos()" :disabled="abrindoDocumentos" data-campo="ver-documentos"
                  class="w-full h-10 mb-3 px-3 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-xs flex items-center justify-center gap-2 disabled:opacity-60">
            <Loader2 v-if="abrindoDocumentos" class="w-4 h-4 animate-spin" /><FileText v-else class="w-4 h-4" /> Ver e baixar documentos
          </button>
          <p v-if="contratoGerado" class="text-xs text-indigo-700 font-medium -mt-1 mb-3" data-campo="contrato-gerado">Empresa Fozesc: o contrato desta operação já foi gerado.</p>
          <div class="flex gap-3">
            <button @click="exportarBordero" data-campo="imprimir-efetivado" class="flex-1 h-10 px-4 bg-white border border-slate-300 text-slate-700 font-semibold text-sm rounded-md shadow-xs hover:bg-slate-50 flex items-center justify-center gap-2"><Printer class="w-4 h-4 text-slate-500" /> Imprimir</button>
            <button @click="novoBordero" data-campo="novo-bordero" class="flex-1 h-10 px-4 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-xs">Novo borderô</button>
          </div>
          <p class="text-xs text-slate-500 mt-4">Fechou sem baixar? Os documentos também saem pela ficha do cliente e pelo detalhe de cada título.</p>
        </template>
        <button v-else @click="modalState.visible = false" :class="['w-full h-10 px-4 rounded-md text-white font-semibold text-sm shadow-xs', modalState.type === 'error' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700']">Entendido</button>
      </div>
    </div>

    <Teleport to="body">
      <VisualizadorDocumentos v-if="visualizador" :titulo="visualizador.titulo" :documentos="visualizador.documentos"
                              :inicial="visualizador.inicial" :confirmar="visualizador.confirmar || ''"
                              @close="visualizador = null" @confirmar="efetivarDaPrevia" />
    </Teleport>

    <div class="print:hidden space-y-4">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div class="flex items-center gap-3">
          <button @click="router.back()" aria-label="Voltar" class="w-9 h-9 flex items-center justify-center bg-white border border-slate-300 shadow-xs hover:bg-slate-50 rounded-md text-slate-500"><ArrowLeft class="w-[18px] h-[18px]" /></button>
          <div>
            <h1 class="text-2xl font-semibold text-slate-900 tracking-tight cursor-help" v-dica="AJUDA['/bordero']">Cálculo de Borderô</h1>
            <p class="text-slate-500 text-sm mt-0.5">Novo borderô de cheques ou promissórias.</p>
          </div>
        </div>
        <div class="flex gap-2 items-center">
          <div class="relative">
            <select v-model="selectedCompany" aria-label="Empresa do borderô"
                    class="appearance-none h-9 pl-3 pr-9 bg-white border border-slate-300 rounded-md text-sm font-semibold text-slate-700 shadow-xs outline-none cursor-pointer focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15">
              <option value="PQ">PQ</option>
              <option value="Fozesc">Fozesc</option>
            </select>
            <Building2 class="w-4 h-4 absolute right-3 top-2.5 text-slate-400 pointer-events-none" />
          </div>
          <span v-if="selectedCompany === 'Fozesc'" class="hidden md:inline-flex h-9 items-center px-2.5 rounded-md bg-indigo-50 text-indigo-700 text-xs font-semibold" data-campo="aviso-contrato" title="Ao efetivar, aparece a prévia do contrato desta operação para conferir; ele só é gravado depois de confirmar">+ contrato</span>
          <button @click="exportarBordero" class="h-9 px-3.5 bg-white border border-slate-300 rounded-md text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 flex items-center gap-2"><Printer class="w-4 h-4 text-slate-500" /> Simular</button>
          <button @click="verificarLimiteESalvar" :disabled="loading" class="h-9 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-semibold shadow-xs flex items-center gap-2 disabled:opacity-60">
            <Loader2 v-if="loading" class="w-4 h-4 animate-spin" /><Save v-else class="w-4 h-4" /> Efetivar
          </button>
        </div>
      </div>

      <div v-if="rascunhoRecuperado" class="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 flex items-center gap-3 text-sm" data-campo="rascunho">
        <span class="flex-1 text-indigo-900">Recuperei o borderô que estava sendo montado (o login tinha vencido ou a página recarregou). Confira os dados antes de efetivar.</span>
        <button type="button" @click="rascunhoRecuperado = false" class="h-8 px-3 rounded-md bg-white border border-indigo-200 text-indigo-700 text-xs font-semibold hover:bg-indigo-100">Continuar</button>
        <button type="button" @click="descartarRascunho" class="h-8 px-3 rounded-md bg-white border border-slate-300 text-slate-600 text-xs font-semibold hover:bg-slate-50">Descartar</button>
      </div>

      <section class="bg-white border border-slate-200 rounded-lg shadow-xs relative z-30">
        <header class="px-5 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold text-slate-900">Dados da operação</h2>
            <p class="text-xs text-slate-500">Cliente, condições do borderô e de onde sai o dinheiro.</p>
          </div>
          <div class="flex h-9 w-full sm:w-64 gap-0.5 p-0.5 rounded-md border border-slate-300 bg-slate-50" role="radiogroup" aria-label="Tipo dos títulos" data-campo="tipo-titulo">
            <button v-for="t in TIPOS_TITULO" :key="t.id" type="button" role="radio" :aria-checked="header.tipo === t.id"
                    @click="header.tipo = t.id" :class="segmento(header.tipo === t.id)">{{ t.nome }}</button>
          </div>
        </header>
        <div class="p-5 space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-4">
            <div class="relative xl:col-span-5">
              <ClientSelect :key="chaveCliente" v-model="header.clienteId" :initial-name="header.clienteNome" @select="selecionarCliente" />
              <div v-if="header.clienteId && header.clienteLimite > 0" class="absolute right-0 top-0 text-xs font-medium text-slate-500">
                Disponível: <span class="tabular-nums" :class="header.clienteLimite - header.clienteDivida < 0 ? 'text-red-600' : 'text-emerald-600'">{{ formatCurrency(header.clienteLimite - header.clienteDivida) }}</span>
              </div>
              <p v-if="header.clienteId && header.clienteReputacao" class="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5 cursor-help" v-dica="REGRA_REPUTACAO" data-campo="reputacao-bordero">
                Reputação: <MedidorReputacao :reputacao="header.clienteReputacao" tamanho="mini" />
              </p>
            </div>
            <div v-if="ehPromissoria" class="xl:col-span-5 grid grid-cols-1 sm:grid-cols-[1fr_11rem] gap-3" data-campo="avalista">
              <div>
                <label for="bordero-avalista" :class="rotulo">Avalista</label>
                <input id="bordero-avalista" type="text" v-model="header.avalistaNome" maxlength="100" placeholder="Opcional" :class="campo" />
              </div>
              <div>
                <label for="bordero-avalista-doc" :class="rotulo">CPF do avalista</label>
                <input id="bordero-avalista-doc" type="text" v-model="header.avalistaDocumento" maxlength="20" placeholder="Opcional" :class="campo" />
              </div>
              <p class="sm:col-span-2 text-xs text-slate-500 -mt-1">O emitente da promissória é o cliente. Sem avalista, o espaço dele sai em branco para preencher à mão.</p>
            </div>
            <div v-else class="xl:col-span-5">
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
              <p v-if="riscoEmitente && problemasEmitente" class="text-xs text-red-700 font-medium mt-1.5 flex items-start gap-1 cursor-help" data-campo="risco-emitente" v-dica="AJUDA.emitenteRisco">
                <AlertTriangle class="w-3 h-3 shrink-0 mt-0.5" /> Atenção: este emitente tem {{ problemasEmitente }}. Já são {{ formatCurrency(riscoEmitente.em_aberto) }} em aberto com ele.
              </p>
              <p v-else-if="riscoEmitente" class="text-xs text-slate-500 mt-1.5 cursor-help" data-campo="risco-emitente" v-dica="AJUDA.emitenteRisco">
                Já tem {{ formatCurrency(riscoEmitente.em_aberto) }} em aberto deste emitente ({{ riscoEmitente.titulos_abertos }} título(s)), sem problema registrado.
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
                       :class="[campo, 'font-semibold tabular-nums', comissaoInvalida ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15' : '']" />
              </div>
              <p id="bordero-comissao-ajuda" class="text-[11px] font-medium mt-1" :class="comissaoInvalida ? 'text-red-600' : 'text-violet-700'">
                <template v-if="comissaoInvalida">Máximo {{ virgula(header.taxaMensal) }} (a taxa)</template>
                <template v-else-if="comissao.parte">de {{ virgula(header.taxaMensal) }}% · {{ parteDosJuros }} dos juros</template>
                <span v-else class="text-slate-400 font-normal">pontos de {{ virgula(header.taxaMensal) }}%</span>
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
                <button type="button" role="radio" :aria-checked="dividida" @click="header.contaSaida = DIVIDIR" data-campo="saida-dividir"
                        :class="[segmento(dividida), 'flex items-center justify-center gap-1.5']" v-dica="AJUDA.saidaDividida">
                  <Split class="w-3.5 h-3.5" /> Dividir
                </button>
              </div>
            </div>
          </div>

          <div v-if="dividida" class="rounded-md border border-indigo-100 bg-indigo-50/40 p-3 space-y-2" data-campo="partes-saida">
            <p class="text-xs text-slate-600">
              De onde sai o líquido de <b class="tabular-nums">{{ formatCurrency(totais.liquido) }}</b>: digite quanto sai de uma conta e a
              última parte se completa sozinha com o que falta.
            </p>
            <PartesPagamento v-model="partesSaida" :total="totais.liquido" compacto saida auto-completar />
          </div>

          <div class="rounded-md border border-violet-100 bg-violet-50/50 px-3 py-2.5">
            <ComissaoVale ref="comissaoVale" v-model="valeId" v-model:ativo="abaterVale" :comissao="comissao.valor" :conta="nomeConta(contaPrincipal)" />
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
                ? `Pelo líquido: informe quanto o cliente recebe e o sistema calcula o valor ${ehPromissoria ? 'das promissórias' : 'dos cheques'}.`
                : `Pelo bruto: informe a soma ${ehPromissoria ? 'das promissórias' : 'dos cheques'} e o sistema divide em parcelas iguais.` }}
            </p>
          </div>
          <div class="flex h-9 w-full sm:w-56 gap-0.5 p-0.5 rounded-md border border-slate-300 bg-slate-50" role="radiogroup" aria-label="Calcular pelo">
            <button type="button" role="radio" :aria-checked="gerador.modo === 'valor_mao'" @click="gerador.modo = 'valor_mao'" :class="segmento(gerador.modo === 'valor_mao')">Pelo líquido</button>
            <button type="button" role="radio" :aria-checked="gerador.modo === 'valor_bruto'" @click="gerador.modo = 'valor_bruto'" :class="segmento(gerador.modo === 'valor_bruto')">Pelo bruto</button>
          </div>
        </header>
        <div class="p-5 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-12 gap-4 items-end">
          <div class="col-span-2 xl:col-span-3">
            <label for="gerador-valor" :class="rotulo">{{ gerador.modo === 'valor_mao' ? 'Líquido para o cliente' : (ehPromissoria ? 'Soma das promissórias' : 'Soma dos cheques') }}</label>
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
            <h2 class="text-sm font-semibold text-slate-900">{{ ehPromissoria ? 'Promissórias' : 'Cheques' }}</h2>
            <span class="px-1.5 min-w-5 h-5 inline-flex items-center justify-center rounded bg-slate-100 text-[11px] font-semibold text-slate-600 tabular-nums">{{ itens.length }}</span>
          </div>
          <button @click="adicionarLinha" class="h-8 px-3 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 flex items-center gap-1.5">
            <Plus class="w-3.5 h-3.5" /> Adicionar {{ nome.um }}
          </button>
        </header>
        <div class="overflow-x-auto">
          <table class="w-full text-sm whitespace-nowrap">
            <thead class="bg-slate-50/80 border-b border-slate-200 text-xs font-medium text-slate-500">
              <tr>
                <th class="pl-5 pr-2 py-2 text-left w-10">#</th>
                <th class="px-2.5 py-2 text-left">Vencimento</th>
                <th class="px-2.5 py-2 text-right">Dias</th>
                <th class="px-2.5 py-2 text-right">{{ ehPromissoria ? 'Valor da promissória' : 'Valor do cheque' }}</th>
                <th class="px-2.5 py-2 text-right">Juros</th>
                <th v-if="header.iofEnabled" class="px-2.5 py-2 text-right">IOF</th>
                <th class="px-2.5 py-2 text-right">Líquido</th>
                <th class="px-2.5 py-2 text-left">{{ ehPromissoria ? 'Nº' : 'Banco / Nº' }}</th>
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
                    <input v-if="!ehPromissoria" type="text" v-model="item.banco" placeholder="Banco" :aria-label="`Banco do cheque ${index + 1}`" :class="[campoTabela, 'w-20']" />
                    <input type="text" v-model="item.num_doc" :placeholder="ehPromissoria ? `${index + 1}/${itens.length}` : 'Nº'" :aria-label="`Número do cheque ${index + 1}`" :class="[campoTabela, 'w-16']" />
                  </div>
                </td>
                <td class="pl-2 pr-5 py-2 text-right">
                  <button @click="removerLinha(index)" :aria-label="`Remover o cheque ${index + 1}`" class="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 class="w-4 h-4" /></button>
                </td>
              </tr>
              <tr v-if="!itens.length">
                <td :colspan="header.iofEnabled ? 9 : 8" class="px-5 py-10 text-center text-sm text-slate-400">
                  Nenhum{{ ehPromissoria ? 'a promissória' : ' cheque' }}. Use “Gerar parcelas” acima ou “Adicionar {{ nome.um }}”.
                </td>
              </tr>
            </tbody>
            <tfoot v-if="itens.length" class="bg-slate-50/80 border-t border-slate-200">
              <tr class="font-semibold tabular-nums">
                <td colspan="3" class="pl-5 pr-3 py-2.5 text-xs font-medium text-slate-500">Total · {{ itens.length }} {{ nome.um }}(s)</td>
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
    <div class="hidden print:block bg-white text-black p-8 max-w-[210mm] mx-auto min-h-screen relative">
      <div class="border-b-2 border-black pb-4 mb-6 flex justify-between items-end">
        <div>
          <h1 class="text-3xl font-bold uppercase">{{ empresaAtual.nome }}</h1>
          <p class="text-sm text-gray-600">{{ empresaAtual.cnpj ? `CNPJ ${empresaAtual.cnpj}` : 'Gestão de Ativos' }}</p>
        </div>
        <div class="text-right">
          <h2 class="text-xl font-bold uppercase">Demonstrativo de Borderô</h2>
          <p v-if="lastOperationId" class="text-base font-bold text-gray-700">Nº {{ lastOperationId }}</p>
          <p class="text-sm mt-1">Data: {{ dataBR(header.dataOperacao) }}</p>
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
            <td class="py-2 font-mono">{{ dataBR(item.vencimento) }}</td>
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
@media print { @page { margin: 0; size: auto; } }
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
input[type="number"] { -moz-appearance: textfield; }
</style>