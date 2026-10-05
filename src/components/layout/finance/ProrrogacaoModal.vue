<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { X, CalendarClock, Save, AlertTriangle, Loader2, RotateCcw, Lock, ChevronDown, FileDown, Split } from 'lucide-vue-next';
import checkService from '../../../services/checkService';
import PartesPagamento from './PartesPagamento.vue';
import { partesFecham, partesParaEnviar } from '../../../utils/contasCaixa';
import { VERSAO } from '../../../versao';
import settingsService from '../../../services/settingsService';
import { motivoNaoUtil, proximoDiaUtil } from '../../../utils/diasUteis';
import {
  calcularProrrogacao, iofDasConfiguracoes, IOF_BASE_PADRAO, IOF_DIARIO_PADRAO, DIAS_COMPENSACAO_PADRAO
} from '../../../utils/calculoBordero';

const props = defineProps({
  cheque: Object,
  isOpen: Boolean
});

const emit = defineEmits(['close', 'save']);

const hoje = new Date().toLocaleDateString('en-CA');
const vencimentoAtual = props.cheque.vencimento;

const somarDias = (iso, dias) => {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};
// ja abre com 30 dias depois do vencimento (ou de hoje, se ja venceu), em dia util:
// assim os juros aparecem na hora, sem precisar escolher a data
const dataSugerida = proximoDiaUtil(somarDias(vencimentoAtual > hoje ? vencimentoAtual : hoje, 30));

const loading = ref(false);
const errorMessage = ref('');
const maisOpcoes = ref(false);
const taxaPadrao = ref(Number(props.cheque.taxa_cliente) || 4);
const taxaOrigem = ref(props.cheque.taxa_cliente ? 'taxa do cliente' : 'padrão');
const iofBase = ref(IOF_BASE_PADRAO);
const iofDiario = ref(IOF_DIARIO_PADRAO);

const prorrogar = ref(true);
const pagamento = ref({ conta: 'Dinheiro', data: hoje });
// pagamento dividido (parte no dinheiro, parte no banco): mesmo editor do Receber
const dividido = ref(false);
const partes = ref([]);
const empresa = ref({ nome: 'Fozesc', cnpj: '', telefone: '', endereco: '' });
const form = ref({
  new_date: dataSugerida,
  data_base: vencimentoAtual,
  taxa: taxaPadrao.value,
  dias_comp: DIAS_COMPENSACAO_PADRAO,
  // mesma condicao do borderô de origem: se ele nao cobrou IOF, a prorrogacao tambem nao
  iof: Boolean(props.cheque.iof_bordero),
  notes: '',
  senha: ''
});
// Valor digitado a mao. null = automatico.
const pagoManual = ref(null);
const saldoManual = ref(null);
const jurosManual = ref(null);

onMounted(async () => {
  try {
    const settings = await settingsService.get();
    const iof = iofDasConfiguracoes(settings);
    iofBase.value = iof.iofBase;
    iofDiario.value = iof.iofDiario;
    // 'Minha Fatoring' e' o valor de fabrica: enquanto nao preencherem em Ajustes, sai Fozesc
    if (settings.nomeEmpresa && settings.nomeEmpresa !== 'Minha Fatoring') empresa.value.nome = settings.nomeEmpresa;
    empresa.value.cnpj = settings.cnpj || '';
    empresa.value.telefone = settings.telefone || '';
    empresa.value.endereco = settings.endereco || '';
    if (!props.cheque.taxa_cliente && settings.extension_rate) {
      taxaPadrao.value = Number(settings.extension_rate);
      form.value.taxa = taxaPadrao.value;
    }
  } catch (e) {
    console.error("Erro ao carregar configurações:", e);
  }
});

// Cheque nao compensa em fim de semana nem feriado: a data escolhida e' adiada para
// o proximo dia util, e ele pode recusar.
const ajusteData = ref(null);
let ignorarProximo = false;

watch(() => form.value.new_date, (nova) => {
  if (ignorarProximo) { ignorarProximo = false; return; }
  if (!nova) { ajusteData.value = null; return; }
  const motivo = motivoNaoUtil(nova);
  if (!motivo) { ajusteData.value = null; return; }
  const util = proximoDiaUtil(nova);
  ajusteData.value = { de: nova, para: util, motivo, mantida: false };
  ignorarProximo = true;
  form.value.new_date = util;
});

const manterDataOriginal = () => {
  ignorarProximo = true;
  form.value.new_date = ajusteData.value.de;
  ajusteData.value = { ...ajusteData.value, mantida: true };
};

const adiarNovamente = () => {
  ignorarProximo = true;
  form.value.new_date = ajusteData.value.para;
  ajusteData.value = { ...ajusteData.value, mantida: false };
};

const numero = (v) => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };

// Toda a conta vem de calcularProrrogacao (a mesma do Borderô de Liquido Inverso).
const r = computed(() => calcularProrrogacao({
  valorAnterior: props.cheque.valor_bruto,
  pago: pagoManual.value,
  saldoManual: saldoManual.value,
  prorrogar: prorrogar.value,
  dataBase: form.value.data_base,
  novaData: form.value.new_date,
  taxaMensal: form.value.taxa,
  diasCompensacao: form.value.dias_comp,
  iofEnabled: form.value.iof,
  iofBase: iofBase.value,
  iofDiario: iofDiario.value,
  jurosManual: jurosManual.value
}));

watch([() => r.value.saldoBase, prorrogar, () => form.value.new_date, () => form.value.data_base,
       () => form.value.taxa, () => form.value.dias_comp, () => form.value.iof],
      () => { jurosManual.value = null; });
watch(prorrogar, () => { pagoManual.value = null; });

// erro com `opcoes: true` esta num campo de "Mais opcoes": abre a secao para mostrar
const erros = computed(() => {
  const e = [];
  const add = (msg, opcoes = false) => e.push({ msg, opcoes });
  if (Number.isNaN(r.value.pago) || r.value.pago < 0) add('Valor pago inválido.');
  else if (r.value.pago > r.value.totalComJuros) add('O valor pago é maior que o devido.');
  else if (r.value.pago > 0 && r.value.pago === r.value.totalComJuros) add('O valor pago quita o título inteiro: use o botão Receber.');
  if (r.value.pago > 0 && (!pagamento.value.data || pagamento.value.data > hoje)) add('Data do pagamento inválida (não pode ser no futuro).', true);
  if (r.value.pago > 0 && dividido.value && !partesFecham(partes.value, r.value.pago)) add(`As partes do pagamento têm que somar ${moeda(r.value.pago)}.`);
  if (!(r.value.saldoBase > 0)) add('O saldo para o cálculo tem que ser maior que zero.', true);
  if (prorrogar.value) {
    if (!form.value.new_date) add('Escolha a nova data de vencimento.');
    else if (form.value.new_date <= vencimentoAtual) add('A nova data tem que ser depois do vencimento atual.');
    else if (!form.value.data_base || form.value.new_date <= form.value.data_base) add('A nova data tem que ser depois da data em que os juros começam.', true);
    else if (r.value.divisor <= 0) add('Prazo longo demais para o cálculo inverso: conte os juros a partir de hoje (Mais opções).', true);
    const t = numero(form.value.taxa);
    if (Number.isNaN(t) || t < 0 || t > 100) add('Taxa inválida.');
    const d = numero(form.value.dias_comp);
    if (!Number.isInteger(d) || d < 0 || d > 30) add('Dias de compensação inválidos.', true);
    if (Number.isNaN(r.value.juros) || r.value.juros < 0) add('Juros inválidos.', true);
  } else if (!r.value.pago && !r.value.ajuste) {
    add('Informe o valor pago.');
  }
  if (r.value.ajuste && !form.value.senha) add('Digite sua senha para confirmar o ajuste manual do saldo.', true);
  return e;
});
// o aviso do Confirmar some sozinho quando o problema e' resolvido
watch(erros, (lista) => {
  if (errorMessage.value && !lista.some(e => e.msg === errorMessage.value)) errorMessage.value = '';
});
// aviso que aparece na hora (sem esperar o Confirmar) quando a conta nao fecha
const avisoCalculo = computed(() => erros.value.find(e => /Prazo longo|depois do vencimento|maior que o devido|quita o título/.test(e.msg))?.msg);

const salvar = async () => {
  errorMessage.value = '';
  if (erros.value.length) {
    errorMessage.value = erros.value[0].msg;
    if (erros.value[0].opcoes) maisOpcoes.value = true;
    return;
  }
  loading.value = true;
  try {
    const gravado = await checkService.prorrogate(props.cheque.id, {
      prorrogar: prorrogar.value,
      new_date: form.value.new_date,
      data_base: form.value.data_base,
      taxa_mensal: numero(form.value.taxa),
      dias_compensacao: numero(form.value.dias_comp),
      iof: form.value.iof,
      novos_juros: r.value.juros,
      juros_calculado: r.value.calculado.encargos,
      valor_recebido: r.value.pago,
      ...(dividido.value && r.value.pago > 0 ? { partes: partesParaEnviar(partes.value) } : { conta: pagamento.value.conta }),
      data_recebimento: pagamento.value.data,
      ...(saldoManual.value !== null ? { saldo_base: r.value.saldoBase } : {}),
      notes: form.value.notes,
      ...(r.value.ajuste ? { senha: form.value.senha } : {})
    });
    emit('save', gravado);
    emit('close');
  } catch (error) {
    errorMessage.value = error.response?.data?.error || "Erro ao gravar.";
  } finally {
    loading.value = false;
  }
};

function dataBR(iso) { return iso ? iso.split('-').reverse().join('/') : ''; }
function moeda(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0); }
const NOMES_CONTA = { Dinheiro: 'Dinheiro', BB: 'Banco do Brasil', Caixa: 'Caixa Econômica' };

// A "nota": quanto era, o que somou, o que entrou e como ficou. A tela e o PDF usam
// estas mesmas linhas - o que o cliente assina e' o que a tela mostrou.
const nota = computed(() => {
  const linhas = [{ rotulo: `Valor devido (vencimento ${dataBR(vencimentoAtual)})`, valor: r.value.total }];
  if (r.value.ajuste) linhas.push({ rotulo: '(±) Ajuste manual do saldo', valor: r.value.ajuste });
  if (prorrogar.value) {
    linhas.push({ rotulo: `(+) Juros da prorrogação — ${r.value.dias} dias a ${form.value.taxa}% a.m.${form.value.iof ? ' com IOF' : ''}`, valor: r.value.juros });
  }
  linhas.push({ rotulo: '(=) Total', valor: r.value.totalComJuros, tipo: 'subtotal' });
  if (r.value.pago > 0) {
    linhas.push({ rotulo: `(−) Pago em ${dataBR(pagamento.value.data)}`, valor: r.value.pago });
    const lista = dividido.value ? partes.value : [{ conta: pagamento.value.conta, forma: '', valor: r.value.pago }];
    lista.forEach(pt => linhas.push({
      rotulo: `${NOMES_CONTA[pt.conta] || pt.conta}${pt.forma && pt.forma !== pt.conta ? ' · ' + pt.forma : ''}`,
      valor: Number(pt.valor) || 0, tipo: 'detalhe'
    }));
    if (r.value.jurosPagos) linhas.push({ rotulo: 'quitou juros', valor: r.value.jurosPagos, tipo: 'detalhe' });
    if (r.value.abatido) linhas.push({ rotulo: 'abateu do saldo', valor: r.value.abatido, tipo: 'detalhe' });
  } else {
    linhas.push({ rotulo: '(−) Pago agora', valor: 0 });
  }
  if (r.value.jurosNaoPagos) linhas.push({ rotulo: 'juros não pagos (somados ao novo valor)', valor: r.value.jurosNaoPagos, tipo: 'detalhe' });
  linhas.push({
    rotulo: prorrogar.value ? `(=) Novo valor devido — vence em ${dataBR(form.value.new_date)}` : '(=) Novo valor devido',
    valor: r.value.novoTotal, tipo: 'total'
  });
  return linhas;
});

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// PDF para o cliente assinar: abre o documento pronto e o navegador salva como PDF
// (Imprimir > Salvar como PDF). Sem biblioteca nova.
const salvarPdf = () => {
  const c = props.cheque;
  const titulo = prorrogar.value ? 'Comprovante de Prorrogação' : 'Comprovante de Pagamento Parcial';
  const agora = new Date();
  const linhasHtml = nota.value.map(l => `
    <tr class="${l.tipo || ''}"><td>${esc(l.rotulo)}</td><td class="v">${esc(moeda(l.valor))}</td></tr>`).join('');
  const dados = [
    ['Cliente', c.cliente], ['Emitente', c.emitente || c.cliente],
    [c.tipo === 'PROMISSORIA' ? 'Promissória nº' : 'Cheque nº', c.numero || 'S/N'], ['Banco', c.banco || '—'],
    ['Borderô', '#' + c.operation_id],
    ['Vencimento', prorrogar.value ? `${dataBR(vencimentoAtual)} → ${dataBR(form.value.new_date)}` : dataBR(vencimentoAtual)],
  ].map(([k, v]) => `<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('');
  const contato = [empresa.value.cnpj && 'CNPJ ' + empresa.value.cnpj, empresa.value.telefone, empresa.value.endereco].filter(Boolean).join(' · ');
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${esc(`${titulo} - ${c.cliente} - cheque ${c.numero || 'SN'} - ${hoje}`)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  * { box-sizing: border-box; }
  body { font-family: Inter, Arial, sans-serif; color: #0f172a; font-size: 12px; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 10px; }
  header h1 { font-size: 20px; margin: 0; } header p { margin: 2px 0 0; color: #64748b; font-size: 11px; }
  h2 { font-size: 15px; margin: 18px 0 8px; text-transform: uppercase; letter-spacing: .04em; }
  .dados { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; margin-bottom: 14px; }
  .dados div { display: flex; justify-content: space-between; border-bottom: 1px dotted #cbd5e1; padding: 3px 0; }
  .dados span { color: #64748b; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 6px 4px; border-bottom: 1px dotted #cbd5e1; } td.v { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  tr.detalhe td { color: #64748b; font-size: 11px; padding-left: 18px; border-bottom: none; }
  tr.subtotal td { font-weight: 700; border-top: 1px solid #0f172a; }
  tr.total td { font-weight: 800; font-size: 15px; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; }
  .obs { margin-top: 12px; padding: 8px; border: 1px solid #e2e8f0; border-radius: 4px; }
  .declaracao { margin-top: 18px; line-height: 1.5; }
  .assinaturas { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 60px; }
  .assinaturas div { border-top: 1px solid #0f172a; padding-top: 6px; text-align: center; font-size: 11px; }
  footer { margin-top: 30px; color: #94a3b8; font-size: 10px; text-align: center; }
</style></head><body>
<header><div><h1>${esc(empresa.value.nome)}</h1>${contato ? `<p>${esc(contato)}</p>` : ''}</div>
<div style="text-align:right"><strong>${esc(titulo)}</strong><p>Emitido em ${esc(agora.toLocaleDateString('pt-BR'))} às ${esc(agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))}</p></div></header>
<h2>Título</h2><div class="dados">${dados}</div>
<h2>Valores</h2><table>${linhasHtml}</table>
${form.value.notes ? `<div class="obs"><strong>Observação:</strong> ${esc(form.value.notes)}</div>` : ''}
<p class="declaracao">Declaro estar de acordo com os valores acima${prorrogar.value ? ` e com o novo vencimento em <strong>${esc(dataBR(form.value.new_date))}</strong>` : ''}, no valor de <strong>${esc(moeda(r.value.novoTotal))}</strong>.</p>
<div class="assinaturas"><div>${esc(c.cliente)}<br>CPF/CNPJ: ______________________</div><div>${esc(empresa.value.nome)}</div></div>
<footer>Documento gerado pelo sistema ${esc(empresa.value.nome)} v${esc(VERSAO)}</footer>
</body></html>`;
  const janela = window.open('', '_blank');
  if (!janela) { errorMessage.value = 'O navegador bloqueou a janela do PDF: permita pop-ups para este site.'; return; }
  janela.document.write(html);
  janela.document.close();
  janela.focus();
  setTimeout(() => janela.print(), 300);
};
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[80] flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="$emit('close')"></div>

    <div class="bg-white w-full max-w-2xl rounded-2xl shadow-2xl relative z-10 overflow-hidden animate-scale-in flex flex-col max-h-[92vh]" data-modal="prorrogacao">
      <div class="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-start">
        <div>
          <h3 class="text-base font-semibold text-slate-900 flex items-center gap-2"><CalendarClock class="w-5 h-5 text-indigo-600"/> {{ prorrogar ? 'Prorrogar título' : 'Pagamento parcial' }}</h3>
          <p class="text-sm text-slate-500 mt-0.5">Cheque #{{ cheque.numero || 'S/N' }} · {{ cheque.emitente || cheque.cliente }} · {{ cheque.cliente }}</p>
        </div>
        <button @click="$emit('close')" class="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><X class="w-5 h-5"/></button>
      </div>

      <div class="p-6 space-y-4 overflow-y-auto text-sm">
        <div v-if="errorMessage" class="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg font-bold flex items-center gap-2">
          <AlertTriangle class="w-4 h-4 shrink-0" /> {{ errorMessage }}
        </div>

        <!-- mini borderô: a prorrogacao inteira numa conta so -->
        <div class="rounded-lg border border-slate-200 overflow-hidden">
          <div class="grid grid-cols-4 gap-3 p-3 bg-slate-50">
            <div>
              <div class="text-xs font-medium text-slate-500 mb-1">Vencimento atual</div>
              <div class="font-bold text-slate-800 h-[38px] flex items-center">{{ dataBR(vencimentoAtual) }}</div>
            </div>
            <template v-if="prorrogar">
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1.5">Nova data</label>
                <input type="date" v-model="form.new_date" data-campo="nova-data"
                       class="w-full border border-slate-300 rounded-lg px-2 py-1.5 font-bold text-slate-700 bg-white outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow">
              </div>
              <div>
                <div class="text-xs font-medium text-slate-500 mb-1">Prazo</div>
                <div class="font-bold text-slate-800 h-[38px] flex flex-col justify-center leading-tight">
                  {{ r.dias > 0 ? r.dias + ' dias' : '—' }}
                  <span class="text-[10px] font-normal text-slate-400">{{ form.dias_comp }} de compensação</span>
                </div>
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1.5">Taxa a.m.</label>
                <div class="flex items-center gap-2">
                  <div class="relative flex-1">
                    <input type="number" step="0.01" v-model="form.taxa" data-campo="taxa"
                           class="w-full border border-slate-300 rounded-lg px-2 py-1.5 pr-6 font-bold text-slate-800 bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 outline-none shadow-xs transition-shadow">
                    <span class="absolute right-2 top-1.5 text-slate-400 font-bold">%</span>
                  </div>
                  <label class="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer" :title="`IOF ${iofBase}% + ${iofDiario}% ao dia`">
                    <input type="checkbox" v-model="form.iof" class="accent-indigo-600" data-campo="iof"> IOF
                  </label>
                </div>
                <div class="text-[10px] text-slate-400 mt-0.5">
                  <template v-if="Number(form.taxa) === taxaPadrao">{{ taxaOrigem }}</template>
                  <button v-else @click="form.taxa = taxaPadrao" class="font-bold text-indigo-600 hover:underline">voltar a {{ taxaPadrao }}%</button>
                </div>
              </div>
            </template>
            <div v-else class="col-span-3 text-xs text-slate-500 flex items-center">Pagamento parcial: o vencimento continua o mesmo e não há juros.</div>
          </div>

          <div v-if="ajusteData" class="px-3 py-2 text-xs border-t"
               :class="ajusteData.mantida ? 'bg-slate-100 border-slate-200' : 'bg-amber-50 border-amber-200'">
            <strong>{{ dataBR(ajusteData.de) }}</strong> cai em {{ ajusteData.motivo }}.
            <span v-if="!ajusteData.mantida">Adiei para <strong>{{ dataBR(ajusteData.para) }}</strong>.
              <button @click="manterDataOriginal" class="font-bold underline ml-1">Não adiar</button></span>
            <span v-else>Mantida. <button @click="adiarNovamente" class="font-bold underline ml-1">Adiar para {{ dataBR(ajusteData.para) }}</button></span>
          </div>

          <div class="grid grid-cols-4 gap-3 p-3 border-t border-slate-200">
            <div>
              <div class="text-xs font-medium text-slate-500 mb-1">Valor devido</div>
              <div class="font-bold text-slate-800 tabular-nums">{{ moeda(r.saldoBase) }}</div>
              <div v-if="cheque.juros_pendentes > 0" class="text-[10px] text-amber-700">inclui {{ moeda(cheque.juros_pendentes) }} de juros</div>
              <div v-if="r.ajuste" class="text-[10px] text-amber-700">ajuste {{ moeda(r.ajuste) }}</div>
            </div>
            <div>
              <div class="text-xs font-medium text-slate-500 mb-1">+ Juros</div>
              <div class="font-bold text-red-700 tabular-nums" data-campo="juros-valor">{{ moeda(r.juros) }}</div>
              <div v-if="prorrogar" class="text-[10px] text-slate-400">
                <template v-if="jurosManual === null">{{ form.iof ? 'juros ' + moeda(r.calculado.juros) + ' + IOF ' + moeda(r.calculado.iof) : 'Borderô Líquido (Inverso)' }}</template>
                <template v-else>à mão (sistema {{ moeda(r.calculado.encargos) }})</template>
              </div>
            </div>
            <div>
              <div class="text-xs font-medium text-slate-500 mb-1">= Total</div>
              <div class="font-bold text-slate-800 tabular-nums">{{ moeda(r.totalComJuros) }}</div>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1.5">− Cliente paga agora</label>
              <div class="relative">
                <span class="absolute left-2 top-1.5 text-slate-400 font-bold text-xs">R$</span>
                <input type="number" step="0.01" min="0" :value="r.pago" @input="pagoManual = numero($event.target.value)" data-campo="pago"
                       class="w-full border rounded-lg px-2 py-1.5 pl-7 font-bold text-slate-800 outline-none border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 shadow-xs transition-shadow"
                       :class="pagoManual !== null ? 'border-amber-400 bg-amber-50' : 'border-slate-300'">
              </div>
              <select v-if="r.pago > 0 && !dividido" v-model="pagamento.conta" class="mt-1 w-full bg-white border border-slate-300 rounded px-1 py-0.5 text-[11px] font-bold text-slate-600 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 outline-none shadow-xs transition-shadow" title="Conta onde o dinheiro entra">
                <option value="Dinheiro">entra no Dinheiro</option>
                <option value="BB">entra no Banco do Brasil</option>
                <option value="Caixa">entra na Caixa Econômica</option>
              </select>
              <button v-if="r.pago > 0" @click="dividido = !dividido" data-campo="dividir"
                      class="mt-1.5 w-full border rounded-lg px-2 py-1 text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
                      :class="dividido ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-300 bg-white text-slate-600 hover:border-indigo-400 hover:text-indigo-700'">
                <Split class="w-3.5 h-3.5" /> {{ dividido ? 'Uma conta só' : 'Dividir em partes' }}
              </button>
              <div class="flex flex-wrap gap-x-2 mt-1 text-[10px] font-bold">
                <button v-if="prorrogar && pagoManual !== null" @click="pagoManual = null" class="text-indigo-600 hover:underline">só os juros</button>
                <button v-if="r.pago > 0" @click="pagoManual = 0" class="text-slate-400 hover:underline">nada agora</button>
              </div>
            </div>
          </div>

          <div v-if="dividido && r.pago > 0" class="p-3 border-t border-slate-200 bg-slate-50/50">
            <div class="text-xs font-medium text-slate-500 mb-2">Pagamento de {{ moeda(r.pago) }} dividido</div>
            <PartesPagamento v-model="partes" :total="r.pago" compacto />
          </div>

          <div class="p-3 bg-indigo-50 border-t border-indigo-100 flex justify-between items-center gap-3">
            <div class="text-xs">
              <div class="font-semibold text-indigo-700 text-xs">Novo valor devido<template v-if="prorrogar && form.new_date"> em {{ dataBR(form.new_date) }}</template></div>
              <div v-if="avisoCalculo" class="font-bold text-red-600 flex items-center gap-1 mt-0.5"><AlertTriangle class="w-3.5 h-3.5" /> {{ avisoCalculo }}</div>
              <div v-else class="text-slate-600 mt-0.5" data-campo="divisao">
                <template v-if="!r.pago">Nada pago agora<template v-if="r.juros > 0">: os juros somam no valor devido</template>.</template>
                <template v-else>
                  <template v-if="r.juros > 0"><strong>{{ moeda(r.jurosPagos) }}</strong> quitam os juros</template>
                  <template v-if="r.abatido > 0">{{ r.juros > 0 ? ' e ' : '' }}<strong>{{ moeda(r.abatido) }}</strong> abatem do saldo</template>
                  <template v-if="r.jurosNaoPagos > 0"> · faltam <strong class="text-amber-700">{{ moeda(r.jurosNaoPagos) }}</strong> de juros, que somam</template>.
                </template>
                <template v-if="r.novoTotal === r.total"> Fica igual ao de hoje.</template>
              </div>
            </div>
            <div class="text-2xl font-bold text-indigo-900 tabular-nums whitespace-nowrap" data-campo="novo-total">{{ moeda(r.novoTotal) }}</div>
          </div>
        </div>

        <!-- nota: o que o cliente assina -->
        <div class="border border-dashed border-slate-300 rounded-lg px-4 py-3 bg-white" data-campo="nota">
          <div class="text-xs font-medium text-slate-500 mb-1">Resumo para o cliente</div>
          <table class="w-full text-xs">
            <tbody>
              <tr v-for="(l, i) in nota" :key="i"
                  :class="{ 'text-slate-500': l.tipo === 'detalhe', 'font-bold border-t border-slate-300': l.tipo === 'subtotal', 'font-bold text-sm border-t-2 border-slate-800': l.tipo === 'total' }">
                <td class="py-1" :class="l.tipo === 'detalhe' ? 'pl-4 text-[11px]' : ''">{{ l.rotulo }}</td>
                <td class="py-1 text-right tabular-nums whitespace-nowrap" :class="l.tipo === 'detalhe' ? 'text-[11px]' : ''">{{ moeda(l.valor) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- opcoes -->
        <button @click="maisOpcoes = !maisOpcoes" class="w-full flex items-center justify-between text-xs font-bold text-slate-500 hover:text-slate-700 border-t border-slate-100 pt-3" data-campo="mais-opcoes">
          Mais opções — data dos juros, compensação, juros ou saldo à mão, pagamento sem prorrogar
          <ChevronDown class="w-4 h-4 transition-transform" :class="maisOpcoes ? 'rotate-180' : ''" />
        </button>

        <div v-if="maisOpcoes" class="space-y-3">
          <div v-if="prorrogar" class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1.5">Juros a partir de</label>
              <input type="date" v-model="form.data_base" class="w-full border border-slate-300 rounded-lg p-2 font-bold text-slate-700 text-xs focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 outline-none shadow-xs transition-shadow">
              <div class="flex gap-2 mt-1 text-[10px] font-bold">
                <button v-if="form.data_base !== vencimentoAtual" @click="form.data_base = vencimentoAtual" class="text-indigo-600 hover:underline">vencimento</button>
                <button v-if="form.data_base !== hoje" @click="form.data_base = hoje" class="text-indigo-600 hover:underline">hoje</button>
              </div>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1.5">Dias de compensação</label>
              <input type="number" step="1" min="0" v-model.number="form.dias_comp" class="w-full border border-slate-300 rounded-lg p-2 font-bold text-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 outline-none shadow-xs transition-shadow">
            </div>
            <div class="text-[10px] text-slate-400 self-center">IOF quando marcado: {{ iofBase }}% + {{ iofDiario }}% ao dia</div>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div v-if="prorrogar">
              <label class="block text-xs font-medium text-slate-600 mb-1.5">Juros da prorrogação</label>
              <div class="relative">
                <span class="absolute left-3 top-2 text-slate-400 font-bold">R$</span>
                <input type="number" step="0.01" min="0" :value="r.juros" @input="jurosManual = numero($event.target.value)" data-campo="juros"
                       class="w-full border rounded-lg p-2 pl-9 font-bold text-red-700 border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 outline-none shadow-xs transition-shadow" :class="jurosManual !== null ? 'border-amber-400 bg-amber-50' : 'border-slate-300'">
              </div>
              <div class="text-[11px] text-slate-500 mt-0.5">
                <template v-if="jurosManual === null">juros {{ moeda(r.calculado.juros) }} + IOF {{ moeda(r.calculado.iof) }}</template>
                <button v-else @click="jurosManual = null" class="font-bold text-indigo-600 hover:underline"><RotateCcw class="w-3 h-3 inline"/> calculado: {{ moeda(r.calculado.encargos) }}</button>
              </div>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1.5">Saldo para o cálculo</label>
              <div class="relative">
                <span class="absolute left-3 top-2 text-slate-400 font-bold">R$</span>
                <input type="number" step="0.01" :value="r.saldoBase" @input="saldoManual = numero($event.target.value)" data-campo="saldo"
                       class="w-full border rounded-lg p-2 pl-9 font-bold text-slate-800 border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 outline-none shadow-xs transition-shadow" :class="saldoManual !== null ? 'border-amber-400 bg-amber-50' : 'border-slate-300'">
              </div>
              <button v-if="r.ajuste" @click="saldoManual = null" class="text-[10px] font-bold text-amber-800 underline mt-0.5">desfazer ajuste (pede senha)</button>
            </div>
            <div v-if="r.pago > 0">
              <label class="block text-xs font-medium text-slate-600 mb-1.5">Data do pagamento</label>
              <input type="date" v-model="pagamento.data" :max="hoje" class="w-full border border-slate-300 rounded-lg p-2 font-bold text-slate-700 text-xs focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 outline-none shadow-xs transition-shadow">
            </div>
          </div>

          <label class="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
            <input type="checkbox" :checked="!prorrogar" @change="prorrogar = !$event.target.checked" class="accent-indigo-600" data-campo="sem-prorrogar">
            Só registrar um pagamento parcial, sem prorrogar o vencimento
          </label>

          <div class="grid gap-3" :class="r.ajuste ? 'grid-cols-3' : 'grid-cols-1'">
            <div :class="r.ajuste ? 'col-span-2' : ''">
              <label class="block text-xs font-medium text-slate-600 mb-1.5">Observação</label>
              <input type="text" v-model="form.notes" class="w-full border border-slate-300 rounded-lg p-2 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" placeholder="Motivo...">
            </div>
            <div v-if="r.ajuste">
              <label class="block text-xs font-medium text-slate-600 mb-1.5 flex items-center gap-1"><Lock class="w-3 h-3"/> Sua senha</label>
              <input type="password" v-model="form.senha" autocomplete="current-password" class="w-full border border-slate-300 rounded-lg p-2 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 outline-none shadow-xs transition-shadow">
            </div>
          </div>
        </div>
      </div>

      <div class="px-6 py-4 bg-slate-50/70 flex justify-end gap-3 border-t border-slate-200">
        <button @click="salvarPdf" class="mr-auto px-4 py-2 border border-slate-300 bg-white text-slate-700 font-bold text-sm hover:bg-slate-100 rounded-lg flex items-center gap-2" data-campo="pdf">
          <FileDown class="w-4 h-4" /> Salvar PDF
        </button>
        <button @click="$emit('close')" class="px-4 py-2 text-sm rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold shadow-xs hover:bg-slate-50">Cancelar</button>
        <button @click="salvar" :disabled="loading" class="px-5 py-2 bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 rounded-lg flex items-center gap-2 transition-colors shadow-xs disabled:opacity-50">
          <Save v-if="!loading" class="w-4 h-4" />
          <Loader2 v-else class="w-4 h-4 animate-spin" />
          {{ loading ? 'Gravando...' : (prorrogar ? 'Confirmar prorrogação' : 'Registrar pagamento') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-scale-in { animation: scaleIn 0.2s ease-out; }
@keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
</style>
