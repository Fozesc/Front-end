<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { X, Download, Loader2, ExternalLink, FileText, AlertTriangle } from 'lucide-vue-next';

// Mostra os PDFs na tela antes de baixar. documentos: [{ chave, nome, arquivo, gerar: async () => jsPDF }];
// cada um so e' montado quando a aba e' aberta.
const props = defineProps({
  titulo: { type: String, default: 'Documentos' },
  documentos: { type: Array, required: true },
  inicial: { type: String, default: '' },
});
const emit = defineEmits(['close']);

const ativo = ref(props.documentos.some(d => d.chave === props.inicial) ? props.inicial : props.documentos[0]?.chave);
const gerados = ref({});
const carregando = ref('');
const erro = ref('');
const baixandoTodos = ref(false);

const abrir = async (chave) => {
  ativo.value = chave;
  erro.value = '';
  if (gerados.value[chave]) return gerados.value[chave];
  const d = props.documentos.find(x => x.chave === chave);
  carregando.value = chave;
  try {
    const doc = await d.gerar();
    doc.setProperties({ title: d.arquivo.replace(/\.pdf$/, '') });
    gerados.value = { ...gerados.value, [chave]: { doc, url: URL.createObjectURL(doc.output('blob')) } };
    return gerados.value[chave];
  } catch (e) {
    console.error(e);
    erro.value = e?.response?.data?.error || e?.message || 'Não foi possível montar este documento.';
    return null;
  } finally {
    if (carregando.value === chave) carregando.value = '';
  }
};

const baixar = async (chave) => {
  const g = gerados.value[chave] || await abrir(chave);
  if (g) g.doc.save(props.documentos.find(d => d.chave === chave).arquivo);
};

const baixarTodos = async () => {
  baixandoTodos.value = true;
  try {
    for (const d of props.documentos) await baixar(d.chave);
  } finally {
    baixandoTodos.value = false;
  }
};

const abrirEmOutraAba = () => { const g = gerados.value[ativo.value]; if (g) window.open(g.url, '_blank'); };

const tecla = (e) => { if (e.key === 'Escape') emit('close'); };
onMounted(() => { abrir(ativo.value); window.addEventListener('keydown', tecla); });
onBeforeUnmount(() => {
  window.removeEventListener('keydown', tecla);
  Object.values(gerados.value).forEach(g => URL.revokeObjectURL(g.url));
});
</script>

<template>
  <div class="print:hidden fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4" role="dialog" aria-modal="true" data-campo="visualizador">
    <div class="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" @click="emit('close')"></div>
    <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[94vh] flex flex-col overflow-hidden">
      <div class="px-4 sm:px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
        <h2 class="text-base font-semibold text-slate-900 flex items-center gap-2 min-w-0"><FileText class="w-5 h-5 text-indigo-600 shrink-0" /> <span class="truncate">{{ titulo }}</span></h2>
        <button @click="emit('close')" aria-label="Fechar" class="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"><X class="w-5 h-5" /></button>
      </div>

      <div class="px-4 sm:px-5 py-2.5 border-b border-slate-200 bg-slate-50 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
        <div class="flex flex-wrap gap-1.5" role="tablist">
          <button v-for="d in documentos" :key="d.chave" @click="abrir(d.chave)" role="tab" :aria-selected="ativo === d.chave" :data-campo="`doc-${d.chave}`"
                  class="h-8 px-3 rounded-md text-sm font-medium border transition-colors flex items-center gap-1.5"
                  :class="ativo === d.chave ? 'bg-white border-indigo-300 text-indigo-700 shadow-xs' : 'border-transparent text-slate-600 hover:bg-white hover:border-slate-200'">
            <Loader2 v-if="carregando === d.chave" class="w-3.5 h-3.5 animate-spin" />{{ d.nome }}
          </button>
        </div>
        <div class="flex flex-wrap gap-2">
          <button @click="abrirEmOutraAba" :disabled="!gerados[ativo]" class="h-8 px-3 rounded-md bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5 disabled:opacity-50">
            <ExternalLink class="w-3.5 h-3.5" /> Abrir em outra aba
          </button>
          <button @click="baixar(ativo)" :disabled="!!carregando" data-campo="baixar-este" class="h-8 px-3 rounded-md bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5 disabled:opacity-50">
            <Download class="w-3.5 h-3.5" /> Baixar este
          </button>
          <button v-if="documentos.length > 1" @click="baixarTodos" :disabled="baixandoTodos" data-campo="baixar-todos"
                  class="h-8 px-3 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60">
            <Loader2 v-if="baixandoTodos" class="w-3.5 h-3.5 animate-spin" /><Download v-else class="w-3.5 h-3.5" /> Baixar todos ({{ documentos.length }})
          </button>
        </div>
      </div>

      <div class="flex-1 relative bg-slate-200">
        <iframe v-if="gerados[ativo]" :key="ativo" :src="`${gerados[ativo].url}#view=FitH`" :title="documentos.find(d => d.chave === ativo)?.nome" class="w-full h-full border-0" data-campo="pdf"></iframe>
        <div v-else-if="erro" class="absolute inset-0 flex flex-col items-center justify-center text-sm text-red-700 gap-2 p-6 text-center"><AlertTriangle class="w-6 h-6" /> {{ erro }}</div>
        <div v-else class="absolute inset-0 flex items-center justify-center text-slate-500 text-sm"><Loader2 class="w-5 h-5 animate-spin mr-2" /> Montando o documento...</div>
      </div>
      <p v-if="documentos.length > 1" class="px-5 py-2 text-[11px] text-slate-500 border-t border-slate-200">
        Em "Baixar todos" o navegador pode perguntar se permite baixar vários arquivos: clique em <b>Permitir</b> (só na primeira vez).
      </p>
    </div>
  </div>
</template>
