<script setup>
import { reactive, ref, computed, onMounted, onUnmounted } from 'vue';
import { X, Save, Loader2, AlertTriangle, CalendarPlus, Pencil } from 'lucide-vue-next';
import ClientSelect from '../inputs/ClientSelect.vue';
import calendarioService from '../../services/calendarioService';

const props = defineProps({
  evento: { type: Object, default: null },   // editando
  data: { type: String, default: '' }         // dia clicado (novo)
});
const emit = defineEmits(['close', 'salvo']);

const e = props.evento;
const form = reactive({
  titulo: e?.titulo || '',
  data: e?.data || props.data || new Date().toLocaleDateString('en-CA'),
  tipo: e?.tipo || 'evento',
  cliente_id: e?.cliente_id || null,
  descricao: e?.descricao || '',
  comValor: !!e?.valor,
  valor: e?.valor || '',
  previsao: e?.previsao || 'saida',
  concluido: !!e?.concluido
});
const erro = ref('');
const salvando = ref(false);

const TIPOS = [{ id: 'evento', nome: 'Evento' }, { id: 'nota', nome: 'Nota' }, { id: 'lembrete', nome: 'Lembrete' }];
const titulo = computed(() => (e ? 'Editar' : 'Novo') + ' ' + TIPOS.find(t => t.id === form.tipo).nome.toLowerCase());

const salvar = async () => {
  erro.value = '';
  if (!form.titulo.trim()) { erro.value = 'Informe o título.'; return; }
  if (!form.data) { erro.value = 'Informe a data.'; return; }
  if (form.comValor && !(Number(form.valor) > 0)) { erro.value = 'Informe um valor maior que zero.'; return; }
  salvando.value = true;
  try {
    const dados = {
      titulo: form.titulo, data: form.data, tipo: form.tipo, cliente_id: form.cliente_id, descricao: form.descricao,
      ...(form.comValor ? { valor: Number(form.valor), previsao: form.previsao, concluido: form.concluido } : {})
    };
    if (e) await calendarioService.editar(e.id, dados); else await calendarioService.criar(dados);
    emit('salvo');
    emit('close');
  } catch (err) {
    erro.value = err.response?.data?.error || 'Não foi possível salvar.';
  } finally {
    salvando.value = false;
  }
};

const aoTeclar = (ev) => { if (ev.key === 'Escape') emit('close'); };
onMounted(() => window.addEventListener('keydown', aoTeclar));
onUnmounted(() => window.removeEventListener('keydown', aoTeclar));

const rotulo = 'block text-[13px] font-medium text-slate-700 mb-1.5';
const campo = 'h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-xs outline-none transition-shadow placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15';
const segmento = (ativo) => ['flex-1 px-3 rounded-[5px] text-[13px] font-medium transition-colors',
  ativo ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800'];
</script>

<template>
  <div class="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="$emit('close')"></div>
    <div class="relative z-10 w-full max-w-xl bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]" data-modal="evento">
      <div class="border-b border-slate-200 px-6 py-4 flex justify-between items-start">
        <h2 class="text-base font-semibold text-slate-900 flex items-center gap-2">
          <Pencil v-if="e" class="w-5 h-5 text-indigo-600" /><CalendarPlus v-else class="w-5 h-5 text-indigo-600" /> {{ titulo }}
        </h2>
        <button @click="$emit('close')" aria-label="Fechar" class="p-2 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"><X class="w-5 h-5" /></button>
      </div>

      <div class="p-6 space-y-4 overflow-y-auto text-sm">
        <div class="flex h-10 gap-0.5 p-0.5 rounded-md border border-slate-300 bg-slate-50" role="radiogroup" aria-label="Tipo">
          <button v-for="t in TIPOS" :key="t.id" type="button" role="radio" :aria-checked="form.tipo === t.id"
                  @click="form.tipo = t.id" :class="segmento(form.tipo === t.id)">{{ t.nome }}</button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4">
          <div>
            <label for="evento-titulo" :class="rotulo">Título</label>
            <input id="evento-titulo" v-model="form.titulo" maxlength="120" autofocus data-campo="evento-titulo"
                   placeholder="Ex.: Pagar aluguel, ligar para o cliente..." :class="campo" />
          </div>
          <div class="sm:w-44">
            <label for="evento-data" :class="rotulo">Data</label>
            <input id="evento-data" type="date" v-model="form.data" :class="campo" />
          </div>
        </div>
        <div>
          <ClientSelect v-model="form.cliente_id" :initial-name="e?.cliente || ''" />
          <p class="text-[11px] text-slate-400 mt-1">Opcional. Ligado a um cliente, aparece quando o calendário é filtrado por ele.</p>
        </div>
        <div>
          <label for="evento-desc" :class="rotulo">Descrição <span class="font-normal text-slate-400">(opcional)</span></label>
          <textarea id="evento-desc" v-model="form.descricao" rows="3" maxlength="2000"
                    class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs outline-none resize-y focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"></textarea>
        </div>

        <div class="rounded-lg border border-slate-200 p-4 space-y-3" :class="form.comValor ? 'bg-slate-50/60' : ''">
          <label class="flex items-center gap-2 font-medium text-slate-700 cursor-pointer">
            <input type="checkbox" v-model="form.comValor" class="w-4 h-4 accent-indigo-600" data-campo="evento-com-valor" />
            Tem valor (entra na previsão do caixa)
          </label>
          <div v-if="form.comValor" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">R$</span>
              <input type="number" step="0.01" min="0" v-model="form.valor" aria-label="Valor" data-campo="evento-valor" :class="[campo, 'pl-9 font-semibold']" />
            </div>
            <div class="flex h-10 gap-0.5 p-0.5 rounded-md border border-slate-300 bg-white" role="radiogroup" aria-label="Entra ou sai">
              <button type="button" role="radio" :aria-checked="form.previsao === 'entrada'" @click="form.previsao = 'entrada'"
                      :class="[segmento(form.previsao === 'entrada'), form.previsao === 'entrada' ? '!text-emerald-700' : '']">Vai entrar</button>
              <button type="button" role="radio" :aria-checked="form.previsao === 'saida'" @click="form.previsao = 'saida'"
                      :class="[segmento(form.previsao === 'saida'), form.previsao === 'saida' ? '!text-red-700' : '']">Vai sair</button>
            </div>
            <label class="sm:col-span-2 flex items-start gap-2 text-xs text-slate-600 cursor-pointer">
              <input type="checkbox" v-model="form.concluido" class="w-4 h-4 mt-px accent-indigo-600" />
              <span><b>Já aconteceu</b> (o dinheiro já está no caixa): sai da previsão para não contar duas vezes.</span>
            </label>
          </div>
        </div>

        <div v-if="erro" class="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md font-medium flex items-start gap-2">
          <AlertTriangle class="w-4 h-4 mt-0.5 flex-shrink-0" /> {{ erro }}
        </div>
      </div>

      <div class="bg-slate-50/70 px-6 py-4 border-t border-slate-200 flex gap-3">
        <button @click="$emit('close')" class="px-4 h-10 bg-white border border-slate-300 text-slate-700 font-semibold rounded-md shadow-xs hover:bg-slate-50 text-sm">Cancelar</button>
        <button @click="salvar" :disabled="salvando" data-campo="evento-salvar"
                class="flex-1 h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md shadow-xs text-sm flex items-center justify-center gap-2 disabled:opacity-60">
          <Loader2 v-if="salvando" class="w-4 h-4 animate-spin" /><Save v-else class="w-4 h-4" /> Salvar
        </button>
      </div>
    </div>
  </div>
</template>
