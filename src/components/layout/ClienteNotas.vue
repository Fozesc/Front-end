<script setup>
import { ref, reactive, nextTick, onMounted } from 'vue';
import { StickyNote, Pencil, Trash2, Loader2, AlertTriangle, Send } from 'lucide-vue-next';
import clientService from '../../services/clientService';

const props = defineProps({
  clienteId: { type: Number, required: true }
});
const emit = defineEmits(['total']);

const POR_PAGINA = 20;
const MAX_TEXTO = 4000;

let usuario = {};
try { usuario = JSON.parse(localStorage.getItem('user') || '{}') || {}; } catch { usuario = {}; }

const notas = ref([]);
const total = ref(0);
const pagina = ref(1);
const paginas = ref(1);
const carregando = ref(true);
const carregandoMais = ref(false);
const erro = ref('');

const carregar = async (mais = false) => {
  erro.value = '';
  try {
    const res = await clientService.notas(props.clienteId, { page: pagina.value, per_page: POR_PAGINA });
    notas.value = mais ? [...notas.value, ...res.items.filter(n => !notas.value.some(x => x.id === n.id))] : res.items;
    total.value = res.total;
    paginas.value = res.pages;
    emit('total', res.total);
  } catch (e) {
    erro.value = e.response?.data?.error || 'Não foi possível carregar as notas.';
  } finally {
    carregando.value = false;
    carregandoMais.value = false;
  }
};

const recarregar = () => { pagina.value = 1; return carregar(); };
const verMais = () => { carregandoMais.value = true; pagina.value++; carregar(true); };
onMounted(carregar);

const nova = reactive({ texto: '', salvando: false, erro: '' });
const adicionar = async () => {
  const texto = nova.texto.trim();
  if (!texto || nova.salvando) return;
  nova.salvando = true;
  nova.erro = '';
  try {
    await clientService.criarNota(props.clienteId, texto);
    nova.texto = '';
    await recarregar();
  } catch (e) {
    nova.erro = e.response?.data?.error || 'Não foi possível salvar a nota.';
  } finally {
    nova.salvando = false;
  }
};

const edicao = reactive({ id: null, texto: '', salvando: false, erro: '' });
const editar = async (n) => {
  Object.assign(edicao, { id: n.id, texto: n.texto, erro: '' });
  apagando.id = null;
  await nextTick();
  document.getElementById(`editar-nota-${n.id}`)?.focus();
};
const salvarEdicao = async (n) => {
  const texto = edicao.texto.trim();
  if (!texto || edicao.salvando) return;
  if (texto === n.texto) { edicao.id = null; return; }
  edicao.salvando = true;
  edicao.erro = '';
  try {
    Object.assign(n, await clientService.editarNota(props.clienteId, n.id, texto));
    edicao.id = null;
  } catch (e) {
    edicao.erro = e.response?.data?.error || 'Não foi possível salvar a alteração.';
  } finally {
    edicao.salvando = false;
  }
};

const apagando = reactive({ id: null, salvando: false, erro: '' });
const pedirApagar = (n) => { Object.assign(apagando, { id: n.id, erro: '' }); edicao.id = null; };
const confirmarApagar = async (n) => {
  apagando.salvando = true;
  apagando.erro = '';
  try {
    await clientService.apagarNota(props.clienteId, n.id);
    apagando.id = null;
    await recarregar();
  } catch (e) {
    apagando.erro = e.response?.data?.error || 'Não foi possível apagar a nota.';
  } finally {
    apagando.salvando = false;
  }
};

const iniciais = (nome) => (nome || '?').split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
const dataHora = (iso) => {
  if (!iso) return '';
  const [data, hora] = iso.split('T');
  return `${data.split('-').reverse().join('/')} às ${hora.slice(0, 5)}`;
};
</script>

<template>
  <section class="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
    <div class="px-5 py-4 border-b border-slate-200">
      <h3 class="font-semibold text-slate-900 flex items-center gap-2"><StickyNote class="w-4 h-4 text-amber-500" /> Notas</h3>
      <p class="text-slate-500 text-sm mt-0.5">Anotações sobre o cliente: contatos, combinados, pendências. Da mais recente para a mais antiga.</p>
    </div>

    <form class="p-5 border-b border-slate-200 bg-slate-50/50" @submit.prevent="adicionar">
      <label for="nova-nota" class="block text-xs font-medium text-slate-600 mb-1.5">Escrever uma nota</label>
      <textarea id="nova-nota" v-model="nova.texto" rows="3" :maxlength="MAX_TEXTO" data-campo="nota-nova"
                placeholder="Ex.: prefere contato por WhatsApp à tarde."
                @keydown.ctrl.enter="adicionar" @keydown.meta.enter="adicionar"
                class="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 outline-none resize-y placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow"></textarea>
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-2">
        <span class="text-xs text-slate-500">
          Assinada como <strong class="text-slate-700">{{ usuario.name || 'você' }}</strong> · Ctrl + Enter salva
          <template v-if="nova.texto.length > MAX_TEXTO - 200"> · {{ nova.texto.length }}/{{ MAX_TEXTO }}</template>
        </span>
        <button type="submit" :disabled="nova.salvando || !nova.texto.trim()" data-campo="nota-adicionar"
                class="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-xs flex items-center justify-center gap-2 transition-colors disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed">
          <Loader2 v-if="nova.salvando" class="w-4 h-4 animate-spin" /><Send v-else class="w-4 h-4" />
          {{ nova.salvando ? 'Salvando...' : 'Adicionar nota' }}
        </button>
      </div>
      <div v-if="nova.erro" class="mt-3 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm font-medium flex items-start gap-2">
        <AlertTriangle class="w-4 h-4 mt-0.5 flex-shrink-0" /> {{ nova.erro }}
      </div>
    </form>

    <div v-if="carregando" class="py-12"><Loader2 class="w-6 h-6 animate-spin mx-auto text-slate-400" /></div>
    <div v-else-if="erro" class="m-5 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm font-medium flex items-center justify-between gap-2">
      <span class="flex items-center gap-2"><AlertTriangle class="w-4 h-4 flex-shrink-0" /> {{ erro }}</span>
      <button @click="recarregar" class="text-xs font-semibold underline">Tentar de novo</button>
    </div>
    <div v-else-if="!notas.length" class="py-12 text-center text-sm text-slate-400">Nenhuma nota ainda. A primeira aparece aqui.</div>

    <ol v-else class="divide-y divide-slate-100">
      <li v-for="n in notas" :key="n.id" class="px-5 py-4 flex gap-3" data-campo="nota">
        <span class="w-9 h-9 rounded-full bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100 flex items-center justify-center text-xs font-bold flex-shrink-0">{{ iniciais(n.autor) }}</span>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <strong class="text-sm text-slate-900">{{ n.autor }}</strong>
            <time :datetime="n.criado_em" class="text-xs text-slate-500 tabular-nums">{{ dataHora(n.criado_em) }}</time>
            <span v-if="n.editado_em" class="text-xs text-slate-400 italic" :title="`Editada em ${dataHora(n.editado_em)}`">· editada {{ dataHora(n.editado_em) }}</span>
            <span v-if="edicao.id !== n.id && apagando.id !== n.id" class="ml-auto flex gap-1">
              <button @click="editar(n)" aria-label="Editar nota" title="Editar nota"
                      class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"><Pencil class="w-4 h-4" /></button>
              <button @click="pedirApagar(n)" aria-label="Apagar nota" title="Apagar nota"
                      class="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 class="w-4 h-4" /></button>
            </span>
          </div>

          <form v-if="edicao.id === n.id" class="mt-2" @submit.prevent="salvarEdicao(n)">
            <label :for="`editar-nota-${n.id}`" class="sr-only">Texto da nota</label>
            <textarea :id="`editar-nota-${n.id}`" v-model="edicao.texto" rows="3" :maxlength="MAX_TEXTO"
                      @keydown.ctrl.enter="salvarEdicao(n)" @keydown.meta.enter="salvarEdicao(n)" @keydown.esc="edicao.id = null"
                      class="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 outline-none resize-y focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow"></textarea>
            <div class="flex justify-end gap-2 mt-2">
              <button type="button" @click="edicao.id = null" class="h-8 px-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
              <button type="submit" :disabled="edicao.salvando || !edicao.texto.trim()"
                      class="h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:bg-slate-300">
                <Loader2 v-if="edicao.salvando" class="w-3.5 h-3.5 animate-spin" /> Salvar
              </button>
            </div>
            <div v-if="edicao.erro" class="mt-2 text-xs text-red-600 font-medium">{{ edicao.erro }}</div>
          </form>
          <p v-else class="mt-1 text-sm text-slate-700 whitespace-pre-wrap break-words">{{ n.texto }}</p>

          <div v-if="apagando.id === n.id" class="mt-3 bg-red-50/60 border border-red-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span class="text-xs text-slate-700">Apagar esta nota? Não dá para desfazer (o texto fica guardado na Auditoria).</span>
            <span class="flex gap-2 flex-shrink-0">
              <button @click="apagando.id = null" class="h-8 px-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
              <button @click="confirmarApagar(n)" :disabled="apagando.salvando" data-campo="nota-confirmar-apagar"
                      class="h-8 px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60">
                <Loader2 v-if="apagando.salvando" class="w-3.5 h-3.5 animate-spin" /><Trash2 v-else class="w-3.5 h-3.5" /> Apagar
              </button>
            </span>
            <span v-if="apagando.erro" class="text-xs text-red-700 font-medium">{{ apagando.erro }}</span>
          </div>
        </div>
      </li>
    </ol>

    <div v-if="!carregando && pagina < paginas" class="px-5 py-3 border-t border-slate-200 text-center">
      <button @click="verMais" :disabled="carregandoMais"
              class="h-8 px-4 bg-white border border-slate-300 rounded-lg shadow-xs text-[13px] font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2 disabled:opacity-60">
        <Loader2 v-if="carregandoMais" class="w-3.5 h-3.5 animate-spin" /> Ver notas mais antigas ({{ total - notas.length }})
      </button>
    </div>
  </section>
</template>
