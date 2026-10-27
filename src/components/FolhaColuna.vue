<script setup>
// Uma folha de calculo: texto a esquerda, resultado de cada linha a direita. Salva sozinha.
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue';
import { confirmar } from '../utils/avisos';
import { Trash2, X, Maximize2, Minimize2 } from 'lucide-vue-next';
import { calcularFolha, slug } from '../utils/calc';
import folhaService from '../services/folhaService';

const props = defineProps({ folha: Object, refs: Array, largura: Number, focada: Boolean });
const emit = defineEmits(['fechar', 'apagada', 'focar', 'largura', 'salva']);

const LINHA = 24; // px: texto e coluna de resultado com a mesma altura de linha
const EXEMPLO = 'valor = 10.000\njuros: valor * @taxa%\n@cliente.\nsoma';

const conteudo = ref(props.folha.conteudo);
const titulo = ref(props.folha.titulo);
const erro = ref('');
const sugestao = ref(null);
const ativa = ref(0);
const texto = ref(null);

const mapaRefs = computed(() => Object.fromEntries(props.refs.map(r => [r.key, r.value])));
const resultados = computed(() => calcularFolha(conteudo.value, mapaRefs.value));
const linhas = computed(() => conteudo.value.split('\n').length);

const grande = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const pequeno = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });
const numero = (v) => (Math.abs(v) < 100 ? pequeno : grande).format(v);

// salva um pouco depois de parar de digitar
let espera = null;
const salvar = async (dados) => {
  try {
    await folhaService.salvar(props.folha.id, dados);
    emit('salva', dados); // a lista do pai fica com o texto novo (fechar e abrir de novo nao volta o antigo)
    erro.value = '';
  } catch (e) {
    erro.value = e.response?.data?.error || 'Não foi possível salvar';
  }
};
watch(conteudo, (c) => {
  clearTimeout(espera);
  espera = setTimeout(() => { espera = null; salvar({ conteudo: c }); }, 600);
});
onBeforeUnmount(() => {
  if (espera) { clearTimeout(espera); salvar({ conteudo: conteudo.value }); }
});
const salvarTitulo = () => {
  if (titulo.value.trim() && titulo.value !== props.folha.titulo) salvar({ titulo: titulo.value });
};

const apagar = async () => {
  if (!await confirmar({ titulo: 'Apagar folha?', mensagem: `A folha "${props.folha.titulo}" e as contas dela serão apagadas.`,
    consequencias: ['Não dá para desfazer.'], botao: 'Apagar', perigo: true })) return;
  await folhaService.apagar(props.folha.id);
  emit('apagada');
};

// ------------------------------------------------------------ @ sugestoes
const opcoes = computed(() => {
  if (!sugestao.value) return [];
  const q = sugestao.value.busca;
  const comeca = props.refs.filter(r => r.key.startsWith(q));
  const lista = comeca.length ? comeca : props.refs.filter(r => r.key.includes(q));
  return [...lista].sort((a, b) => a.key.split('.').length - b.key.split('.').length).slice(0, 8);
});
const lerSugestao = () => {
  const el = texto.value;
  const antes = el.value.slice(0, el.selectionStart);
  const m = antes.match(/@[\p{L}\p{N}_.]*$/u);
  sugestao.value = m ? {
    inicio: el.selectionStart - m[0].length,
    busca: m[0].slice(1).split('.').map(slug).join('.'),
    linha: antes.split('\n').length - 1,
  } : null;
  ativa.value = 0;
};
const soltarSugestao = () => setTimeout(() => (sugestao.value = null), 150);
const aceitar = (r) => {
  const el = texto.value;
  const fim = el.selectionStart;
  const pos = sugestao.value.inicio + r.key.length + 1;
  conteudo.value = `${conteudo.value.slice(0, sugestao.value.inicio)}@${r.key}${conteudo.value.slice(fim)}`;
  sugestao.value = null;
  nextTick(() => { el.focus(); el.setSelectionRange(pos, pos); });
};
const teclas = (e) => {
  if (!opcoes.value.length) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const n = opcoes.value.length;
    ativa.value = (ativa.value + (e.key === 'ArrowDown' ? 1 : -1) + n) % n;
  } else if (e.key === 'Enter' || e.key === 'Tab') {
    e.preventDefault();
    aceitar(opcoes.value[ativa.value]);
  } else if (e.key === 'Escape') {
    sugestao.value = null;
  }
};

// ------------------------------------------------------------ alargar arrastando a borda
const arrastar = (e) => {
  e.preventDefault();
  const x0 = e.clientX, l0 = props.largura;
  const mover = (ev) => emit('largura', Math.max(280, Math.round(l0 + ev.clientX - x0)));
  const soltar = () => { window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar); };
  window.addEventListener('pointermove', mover);
  window.addEventListener('pointerup', soltar);
};
</script>

<template>
  <section class="relative flex w-full shrink-0 flex-col bg-white border border-slate-200 rounded-xl shadow-xs"
           :class="!focada && 'sm:w-(--largura)'" :style="{ '--largura': `${largura}px` }">
    <div class="flex items-center gap-1 border-b border-slate-100 px-4 py-2.5">
      <input v-model="titulo" @blur="salvarTitulo" @keydown.enter="$event.target.blur()" aria-label="Título da folha"
             class="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none" />
      <button @click="emit('focar')" :title="focada ? 'Voltar às folhas lado a lado' : 'Focar nesta folha'"
              :aria-label="focada ? 'Voltar às folhas lado a lado' : 'Focar nesta folha'"
              class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
        <Minimize2 v-if="focada" class="w-3.5 h-3.5" /><Maximize2 v-else class="w-3.5 h-3.5" />
      </button>
      <button @click="apagar" title="Apagar folha" aria-label="Apagar folha"
              class="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 class="w-3.5 h-3.5" /></button>
      <button @click="emit('fechar')" title="Fechar (continua salva)" aria-label="Fechar folha"
              class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X class="w-3.5 h-3.5" /></button>
    </div>
    <p v-if="erro" class="px-4 pt-2 text-xs text-red-600">{{ erro }}</p>

    <div class="relative flex px-4 py-3 font-mono text-sm" :style="{ lineHeight: `${LINHA}px` }">
      <textarea ref="texto" v-model="conteudo" @input="lerSugestao" @click="lerSugestao" @keydown="teclas"
                @blur="soltarSugestao" :rows="Math.max(linhas, 8)" wrap="off" spellcheck="false"
                :placeholder="EXEMPLO" :style="{ lineHeight: `${LINHA}px` }"
                class="min-w-0 flex-1 resize-none overflow-x-auto overflow-y-hidden bg-transparent text-slate-800 outline-none placeholder:text-slate-300" />
      <div class="w-32 shrink-0 border-l border-slate-100 pl-3 text-right" aria-hidden="true">
        <div v-for="(r, i) in resultados" :key="i" :style="{ height: `${LINHA}px` }" :title="r.tipo === 'erro' ? r.msg : undefined"
             class="truncate" :class="r.tipo === 'erro' ? 'text-red-400' : 'text-indigo-600'">
          {{ r.tipo === 'valor' ? numero(r.valor) : r.tipo === 'erro' ? '⚠' : '' }}
        </div>
      </div>

      <ul v-if="opcoes.length" :style="{ top: `${(sugestao.linha + 1) * LINHA + 16}px` }"
          class="absolute left-4 right-4 z-20 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 font-sans shadow-lg">
        <li v-for="(r, i) in opcoes" :key="r.key">
          <button type="button" @mousedown.prevent="aceitar(r)"
                  class="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-xs"
                  :class="i === ativa ? 'bg-indigo-500/10' : 'hover:bg-slate-50'">
            <span class="min-w-0">
              <span class="block truncate font-mono text-slate-800">@{{ r.key }}</span>
              <span class="block truncate text-slate-400">{{ r.hint }}</span>
            </span>
            <span class="shrink-0 font-mono text-slate-500">{{ numero(r.value) }}</span>
          </button>
        </li>
      </ul>
    </div>

    <div v-if="!focada" @pointerdown="arrastar" @dblclick="emit('largura', null)"
         title="Arraste para alargar · dois cliques volta ao tamanho padrão"
         class="absolute inset-y-3 right-0 hidden w-2 cursor-col-resize rounded-full hover:bg-indigo-500/20 sm:block" />
  </section>
</template>
