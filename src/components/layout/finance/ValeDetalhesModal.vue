<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { X, HandCoins, Wallet, Loader2, AlertTriangle, Receipt, ArrowUpRight, ArrowDownLeft, FileDown, Undo2, Lock, Pencil, Trash2 } from 'lucide-vue-next';
import valeService from '../../../services/valeService';
import settingsService from '../../../services/settingsService';
import transactionService from '../../../services/transactionService';
import { CONTAS, ESTILO, arred } from '../../../utils/contasCaixa';
import { baixarRecibo } from '../../../utils/reciboVale';

const props = defineProps({
  valeId: { type: Number, required: true },
  coberto: { type: Boolean, default: false },
  iniciarApagando: { type: Boolean, default: false }
});
const emit = defineEmits(['close', 'pagar', 'alterado', 'editar', 'apagado']);

const v = ref(null);
const carregando = ref(true);
const erro = ref('');

const carregar = async () => {
  try {
    v.value = await valeService.getOne(props.valeId);
  } catch (e) {
    erro.value = e.response?.data?.error || 'Não foi possível carregar o vale.';
  } finally {
    carregando.value = false;
  }
};

onMounted(() => {
  window.addEventListener('keydown', aoTeclar);
  carregar();
});

let empresa = null;
const gerando = ref(null);
const erroRecibo = ref('');
const recibo = async (pagamento = null) => {
  if (gerando.value) return;
  gerando.value = pagamento ? pagamento.id : 'vale';
  erroRecibo.value = '';
  try {
    if (!empresa) {
      try { empresa = await settingsService.get(); } catch { empresa = {}; }
    }
    await baixarRecibo({ empresa, vale: v.value, pagamento });
  } catch (e) {
    console.error(e);
    erroRecibo.value = 'Não foi possível gerar o PDF do recibo.';
  } finally {
    gerando.value = null;
  }
};

const desfazer = reactive({ item: null, senha: '', erro: '', salvando: false });
const pedirDesfazer = (m) => Object.assign(desfazer, { item: m, senha: '', erro: '' });
const confirmarDesfazer = async () => {
  if (!desfazer.senha) { desfazer.erro = 'Digite sua senha para confirmar.'; return; }
  desfazer.salvando = true;
  desfazer.erro = '';
  try {
    await transactionService.delete(desfazer.item.id, desfazer.senha);
    desfazer.item = null;
    await carregar();
    emit('alterado');
  } catch (e) {
    desfazer.erro = e.response?.data?.error || 'Não foi possível desfazer o pagamento.';
  } finally {
    desfazer.salvando = false;
    desfazer.senha = '';
  }
};

const movimentos = computed(() => {
  let saldo = v.value?.valor || 0;
  return (v.value?.pagamentos || []).map(p => ({ ...p, saldoApos: Math.max((saldo = arred(saldo - p.valor)), 0) }));
});
const pctPago = computed(() => (v.value?.valor ? Math.min(v.value.pago / v.value.valor * 100, 100) : 0));
const ultimo = computed(() => movimentos.value.at(-1));

const dinheiro = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);
const dataBR = (d) => (d ? d.split('-').reverse().join('/') : '-');
const nomeConta = (id) => CONTAS.find(c => c.id === id)?.nome || id;
const situacao = computed(() => {
  if (v.value?.status === 'Pago') return { texto: 'Pago', cor: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (v.value?.pago > 0) return { texto: 'Pago em parte', cor: 'bg-sky-50 text-sky-700 border-sky-200' };
  return { texto: 'Em aberto', cor: 'bg-amber-50 text-amber-700 border-amber-200' };
});

const apagar = reactive({ ativo: props.iniciarApagando, senha: '', erro: '', salvando: false });
const confirmarApagar = async () => {
  if (!apagar.senha) { apagar.erro = 'Digite sua senha para confirmar.'; return; }
  apagar.salvando = true;
  apagar.erro = '';
  try {
    emit('apagado', await valeService.apagar(props.valeId, apagar.senha));
  } catch (e) {
    apagar.erro = e.response?.data?.error || 'Não foi possível apagar o vale.';
  } finally {
    apagar.salvando = false;
    apagar.senha = '';
  }
};

const aoTeclar = (e) => {
  if (e.key !== 'Escape' || props.coberto) return;
  if (apagar.ativo) apagar.ativo = false;
  else if (desfazer.item) desfazer.item = null;
  else emit('close');
};
onUnmounted(() => window.removeEventListener('keydown', aoTeclar));
</script>

<template>
  <div class="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="$emit('close')"></div>

    <div class="relative z-10 w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[92vh]" data-modal="vale-detalhes">
      <div class="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-start flex-shrink-0">
        <div class="min-w-0">
          <h2 class="text-slate-900 text-lg font-semibold flex items-center gap-2 flex-wrap">
            <HandCoins class="w-5 h-5 text-emerald-600" /> Vale #{{ valeId }}
            <span v-if="v" :class="['px-2 py-0.5 rounded-md text-xs font-medium border', situacao.cor]">{{ situacao.texto }}</span>
          </h2>
          <p v-if="v" class="text-slate-500 text-sm mt-0.5 truncate">
            {{ v.descricao }} · emitido em {{ dataBR(v.data) }} · saiu de {{ nomeConta(v.conta) }}
          </p>
        </div>
        <button @click="$emit('close')" aria-label="Fechar" class="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors">
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="p-6 space-y-5 overflow-y-auto text-sm">
        <div v-if="carregando" class="py-12"><Loader2 class="w-6 h-6 animate-spin mx-auto text-slate-400" /></div>
        <div v-else-if="erro" class="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm font-medium flex items-start gap-2">
          <AlertTriangle class="w-4 h-4 mt-0.5 flex-shrink-0" /> {{ erro }}
        </div>

        <template v-else>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div class="rounded-xl border border-slate-200 p-3">
              <div class="text-xs font-medium text-slate-500">Valor do vale</div>
              <div class="text-2xl font-extrabold text-slate-900 tabular-nums">{{ dinheiro(v.valor) }}</div>
            </div>
            <div class="rounded-xl border border-slate-200 p-3">
              <div class="text-xs font-medium text-slate-500">Já pago</div>
              <div class="text-2xl font-extrabold text-emerald-700 tabular-nums">{{ dinheiro(v.pago) }}</div>
              <div class="text-[11px] text-slate-500">{{ pctPago.toFixed(0) }}% do vale</div>
            </div>
            <div class="rounded-xl border border-slate-200 p-3">
              <div class="text-xs font-medium text-slate-500">Falta pagar</div>
              <div class="text-2xl font-extrabold tabular-nums" :class="v.saldo > 0 ? 'text-red-600' : 'text-slate-400'" data-campo="vale-saldo">{{ dinheiro(v.saldo) }}</div>
            </div>
            <div class="rounded-xl border border-slate-200 p-3">
              <div class="text-xs font-medium text-slate-500">Último pagamento</div>
              <div class="font-bold text-slate-800">{{ ultimo ? dataBR(ultimo.data) : (v.data_pagamento ? dataBR(v.data_pagamento) : '—') }}</div>
              <div class="text-[11px] text-slate-500">{{ movimentos.length }} pagamento(s)</div>
            </div>
          </div>

          <div class="h-2.5 rounded-full bg-slate-200 overflow-hidden">
            <div class="h-full bg-emerald-500 transition-all duration-300" :style="{ width: pctPago + '%' }"></div>
          </div>

          <section class="rounded-xl border border-slate-200 overflow-hidden">
            <h3 class="px-4 py-2.5 bg-slate-50 text-xs font-semibold text-slate-600 flex items-center gap-2 border-b border-slate-200">
              <Receipt class="w-4 h-4" /> Movimentos do vale
            </h3>
            <div class="overflow-x-auto">
              <table class="w-full text-left text-sm">
                <thead class="text-xs text-slate-500 border-b border-slate-200">
                  <tr>
                    <th class="px-4 py-2 font-medium">Data</th>
                    <th class="px-4 py-2 font-medium">Movimento</th>
                    <th class="px-4 py-2 font-medium">Conta</th>
                    <th class="px-4 py-2 font-medium text-right">Valor</th>
                    <th class="px-4 py-2 font-medium text-right">Saldo</th>
                    <th class="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr>
                    <td class="px-4 py-3 text-slate-500 tabular-nums text-[13px] whitespace-nowrap">{{ dataBR(v.data) }}</td>
                    <td class="px-4 py-3 text-slate-700"><span class="inline-flex items-center gap-2"><ArrowUpRight class="w-4 h-4 text-red-500 flex-shrink-0" /> Vale emitido</span></td>
                    <td class="px-4 py-3"><span class="px-2 py-0.5 rounded-md text-[11px] font-semibold border whitespace-nowrap" :class="ESTILO[v.conta]?.chip">{{ nomeConta(v.conta) }}</span></td>
                    <td class="px-4 py-3 text-right tabular-nums font-semibold text-red-600 whitespace-nowrap">− {{ dinheiro(v.valor) }}</td>
                    <td class="px-4 py-3 text-right tabular-nums text-slate-500 whitespace-nowrap">{{ dinheiro(v.valor) }}</td>
                    <td class="px-2 py-3 text-right whitespace-nowrap">
                      <button @click="recibo()" :disabled="!!gerando" title="Baixar o recibo do vale em PDF (quem pegou assina)" data-campo="vale-recibo"
                              class="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-slate-200 text-[11px] font-semibold text-slate-600 hover:text-indigo-700 hover:border-indigo-300 hover:bg-indigo-50 transition-colors disabled:opacity-50">
                        <Loader2 v-if="gerando === 'vale'" class="w-3.5 h-3.5 animate-spin" /><FileDown v-else class="w-3.5 h-3.5" /> Recibo
                      </button>
                    </td>
                  </tr>
                  <tr v-for="m in movimentos" :key="m.id" data-campo="vale-pagamento">
                    <td class="px-4 py-3 text-slate-500 tabular-nums text-[13px] whitespace-nowrap">{{ dataBR(m.data) }}</td>
                    <td class="px-4 py-3 text-slate-700"><span class="inline-flex items-center gap-2"><ArrowDownLeft class="w-4 h-4 text-emerald-500 flex-shrink-0" /> {{ m.descricao }}</span></td>
                    <td class="px-4 py-3">
                      <span v-if="m.abatimento" class="px-2 py-0.5 rounded-md text-[11px] font-semibold border whitespace-nowrap bg-violet-50 text-violet-700 border-violet-200" title="Descontado da comissão">Comissão</span>
                      <span v-else class="px-2 py-0.5 rounded-md text-[11px] font-semibold border whitespace-nowrap" :class="ESTILO[m.conta]?.chip">{{ nomeConta(m.conta) }}</span>
                    </td>
                    <td class="px-4 py-3 text-right tabular-nums font-semibold text-emerald-600 whitespace-nowrap">+ {{ dinheiro(m.valor) }}</td>
                    <td class="px-4 py-3 text-right tabular-nums text-slate-500 whitespace-nowrap">{{ dinheiro(m.saldoApos) }}</td>
                    <td class="px-2 py-3 text-right whitespace-nowrap">
                      <button @click="recibo(m)" :disabled="!!gerando" title="Baixar o recibo deste pagamento em PDF"
                              class="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-slate-200 text-[11px] font-semibold text-slate-600 hover:text-indigo-700 hover:border-indigo-300 hover:bg-indigo-50 transition-colors disabled:opacity-50">
                        <Loader2 v-if="gerando === m.id" class="w-3.5 h-3.5 animate-spin" /><FileDown v-else class="w-3.5 h-3.5" /> Recibo
                      </button>
                      <button @click="pedirDesfazer(m)" title="Desfazer este pagamento" aria-label="Desfazer este pagamento" data-campo="vale-desfazer"
                              class="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Undo2 class="w-4 h-4" /></button>
                    </td>
                  </tr>
                  <tr v-if="!movimentos.length">
                    <td colspan="6" class="px-4 py-6 text-center text-xs text-slate-400">
                      <template v-if="v.status === 'Pago'">Quitado em {{ dataBR(v.data_pagamento) }} ({{ nomeConta(v.conta_pagamento) }}), antes do registro de pagamentos parciais.</template>
                      <template v-else>Nenhum pagamento ainda.</template>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
          <div v-if="erroRecibo" class="text-xs text-red-600 font-medium -mt-3">{{ erroRecibo }}</div>

          <div v-if="desfazer.item" class="bg-red-50/60 border border-red-200 rounded-xl p-4 space-y-3">
            <div class="text-sm text-slate-800">
              Desfazer o {{ desfazer.item.abatimento ? 'desconto' : 'pagamento' }} de <strong class="tabular-nums">{{ dinheiro(desfazer.item.valor) }}</strong> de {{ dataBR(desfazer.item.data) }}
              ({{ desfazer.item.abatimento ? 'comissão' : nomeConta(desfazer.item.conta) }})?
              <div class="text-xs text-slate-600 mt-1"><template v-if="desfazer.item.abatimento">O valor volta a ficar devendo no vale e a comissão fica como paga inteira em dinheiro (o desconto sai do caixa)</template><template v-else>O valor sai do caixa e volta a ficar devendo no vale</template><template v-if="v.status === 'Pago'">, que volta para Em aberto</template>. Fica registrado na Auditoria.</div>
            </div>
            <div class="flex flex-col sm:flex-row gap-2">
              <div class="relative flex-1">
                <Lock class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input v-model="desfazer.senha" type="password" autocomplete="current-password" placeholder="Sua senha" autofocus
                       @keyup.enter="confirmarDesfazer"
                       class="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/15 shadow-xs transition-shadow" />
              </div>
              <button @click="desfazer.item = null" class="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg shadow-xs hover:bg-slate-50 text-sm">Cancelar</button>
              <button @click="confirmarDesfazer" :disabled="desfazer.salvando"
                      class="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-xs text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                <Loader2 v-if="desfazer.salvando" class="w-4 h-4 animate-spin" /><Undo2 v-else class="w-4 h-4" /> Desfazer pagamento
              </button>
            </div>
            <div v-if="desfazer.erro" class="text-xs text-red-700 font-medium">{{ desfazer.erro }}</div>
          </div>
        </template>
      </div>

      <div v-if="apagar.ativo && v" class="bg-red-50 px-6 py-4 border-t border-red-200 space-y-3 flex-shrink-0" data-campo="vale-apagar-painel">
        <div class="text-sm text-slate-800">
          <strong>Apagar o vale #{{ v.id }}?</strong>
          Sai do caixa a saída de <strong class="tabular-nums">{{ dinheiro(v.valor) }}</strong> ({{ nomeConta(v.conta) }})<template v-if="v.pago > 0">
          e os pagamentos dele (<strong class="tabular-nums">{{ dinheiro(v.pago) }}</strong>)</template> — o caixa fica como se o vale nunca tivesse existido.
          <div class="text-xs text-slate-600 mt-1">Não dá para desfazer. Tudo fica registrado na Auditoria.</div>
        </div>
        <div class="flex flex-col sm:flex-row gap-2">
          <div class="relative flex-1">
            <Lock class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input v-model="apagar.senha" type="password" autocomplete="current-password" placeholder="Sua senha" autofocus
                   @keyup.enter="confirmarApagar" data-campo="vale-apagar-senha"
                   class="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/15 shadow-xs transition-shadow" />
          </div>
          <button @click="apagar.ativo = false" class="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg shadow-xs hover:bg-slate-50 text-sm">Cancelar</button>
          <button @click="confirmarApagar" :disabled="apagar.salvando" data-campo="vale-apagar-confirmar"
                  class="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-xs text-sm flex items-center justify-center gap-2 disabled:opacity-60">
            <Loader2 v-if="apagar.salvando" class="w-4 h-4 animate-spin" /><Trash2 v-else class="w-4 h-4" /> Apagar vale
          </button>
        </div>
        <div v-if="apagar.erro" class="text-xs text-red-700 font-medium">{{ apagar.erro }}</div>
      </div>

      <div v-else class="bg-slate-50/70 px-6 py-4 border-t border-slate-200 flex flex-wrap gap-3 flex-shrink-0">
        <button @click="$emit('close')"
                class="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg shadow-xs hover:bg-slate-50 transition-colors text-sm">
          Fechar
        </button>
        <button v-if="v" @click="$emit('editar', v)" data-campo="vale-editar"
                class="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg shadow-xs hover:bg-slate-50 hover:text-indigo-700 transition-colors text-sm flex items-center gap-2">
          <Pencil class="w-4 h-4" /> Editar
        </button>
        <button v-if="v" @click="apagar.ativo = true; desfazer.item = null" data-campo="vale-apagar"
                class="px-4 py-2.5 bg-white border border-red-200 text-red-600 font-semibold rounded-lg shadow-xs hover:bg-red-50 transition-colors text-sm flex items-center gap-2">
          <Trash2 class="w-4 h-4" /> Apagar
        </button>
        <button v-if="v?.status === 'Aberto'" @click="$emit('pagar', v)"
                class="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2">
          <Wallet class="w-4 h-4" /> Registrar pagamento · falta {{ dinheiro(v.saldo) }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-scale-in { animation: scaleIn 0.2s ease-out; }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
</style>
