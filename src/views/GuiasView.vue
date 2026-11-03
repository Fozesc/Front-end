<script setup>
import { ref, reactive, computed, watch, nextTick } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router';
import DashboardLayout from '../layouts/DashboardLayout.vue';
import { AJUDA } from '../utils/ajuda';
import { avisar, avisarErro, confirmar } from '../utils/avisos';
import { partesComLinks } from '../utils/textoComLinks';
import guiaService from '../services/guiaService';
import { BookOpen, FolderOpen, FileText, Plus, Pencil, Trash2, ExternalLink, Search, Loader2, ChevronRight, ChevronUp, ChevronDown, X, Save, Check, Copy, StickyNote, AlertTriangle, Lightbulb, RotateCcw } from 'lucide-vue-next';

const TIPOS = {
  nota: { nome: 'Anotação', icone: StickyNote, card: 'bg-white border-slate-200', cor: 'text-slate-500', ativo: 'bg-slate-800 text-white' },
  atencao: { nome: 'Atenção', icone: AlertTriangle, card: 'bg-amber-50/70 border-amber-200', cor: 'text-amber-600', ativo: 'bg-amber-500 text-white' },
  dica: { nome: 'Dica', icone: Lightbulb, card: 'bg-emerald-50/70 border-emerald-200', cor: 'text-emerald-600', ativo: 'bg-emerald-600 text-white' },
};
const notaVazia = () => ({ tipo: 'nota', titulo: '', texto: '' });

const route = useRoute();
const router = useRouter();
const guia = ref(null);
const filhos = ref([]);
const carregando = ref(true);
const editando = ref(null);
const salvando = ref(false);
const feitos = ref(new Set());
const novo = reactive({ aberto: false, titulo: '', salvando: false });
const campoNovo = ref(null);
const busca = ref('');
const buscado = ref('');
const achados = ref([]);
let original = '';
let editarAoAbrir = false;

const idAtual = computed(() => Number(route.params.id) || null);

const comecarEdicao = () => {
  const g = guia.value;
  editando.value = {
    titulo: g.titulo,
    links: g.links.length ? g.links.map(l => ({ ...l })) : [{ titulo: '', url: '' }],
    passos: g.passos.length ? [...g.passos] : [''],
    notas: g.notas.length ? g.notas.map(n => ({ ...n })) : [notaVazia()],
  };
  original = JSON.stringify(editando.value);
};

const carregar = async () => {
  carregando.value = true;
  editando.value = null;
  novo.aberto = false;
  feitos.value = new Set();
  try {
    if (idAtual.value) {
      guia.value = await guiaService.abrir(idAtual.value);
      filhos.value = guia.value.filhos;
      if (editarAoAbrir) comecarEdicao();
    } else {
      guia.value = null;
      filhos.value = (await guiaService.raiz()).filhos;
    }
  } catch (e) {
    if (e?.response?.status === 404) {
      avisar('Este guia não existe mais.');
      router.replace('/guias');
    } else avisarErro(e, 'Não foi possível abrir o guia.');
  } finally {
    editarAoAbrir = false;
    carregando.value = false;
  }
};
watch(idAtual, carregar, { immediate: true });

const sairSemSalvar = async () => !editando.value || JSON.stringify(editando.value) === original
  || confirmar({ titulo: 'Sair sem salvar?', mensagem: 'O que você mudou neste guia vai se perder.', botao: 'Sair sem salvar', perigo: true });
onBeforeRouteLeave(sairSemSalvar);
onBeforeRouteUpdate(sairSemSalvar);

const mover = (lista, i, passo) => {
  const j = i + passo;
  if (j >= 0 && j < lista.length) [lista[i], lista[j]] = [lista[j], lista[i]];
};

const marcar = (i) => {
  if (feitos.value.has(i)) feitos.value.delete(i);
  else feitos.value.add(i);
};

const copiar = async (texto) => {
  try {
    await navigator.clipboard.writeText(texto);
  } catch {
    // sem https o navegador nao libera o navigator.clipboard
    const area = Object.assign(document.createElement('textarea'), { value: texto });
    area.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
  avisar('Copiado.', 'ok');
};

const salvar = async () => {
  if (!editando.value.titulo.trim()) return avisar('Dê um título ao guia.');
  salvando.value = true;
  try {
    guia.value = await guiaService.salvar(guia.value.id, editando.value);
    filhos.value = guia.value.filhos;
    editando.value = null;
    feitos.value = new Set();
    avisar('Guia salvo.', 'ok');
  } catch (e) {
    avisarErro(e, 'Não foi possível salvar. Nada foi gravado.');
  } finally {
    salvando.value = false;
  }
};

const abrirNovo = async () => {
  novo.aberto = true;
  novo.titulo = '';
  await nextTick();
  campoNovo.value?.focus();
};

const criar = async () => {
  if (!novo.titulo.trim()) return avisar('Escreva o título do guia.');
  novo.salvando = true;
  try {
    const g = await guiaService.criar({ titulo: novo.titulo, pai_id: guia.value?.id ?? null });
    novo.aberto = false;
    editarAoAbrir = true;
    router.push(`/guias/${g.id}`);
  } catch (e) {
    avisarErro(e, 'Não foi possível criar o guia.');
  } finally {
    novo.salvando = false;
  }
};

const apagar = async () => {
  const g = guia.value;
  if (filhos.value.length) return avisar('Este guia tem outros guias dentro: apague os de dentro primeiro.');
  const ok = await confirmar({
    titulo: `Apagar "${g.titulo}"?`,
    mensagem: 'O passo a passo, os sites e as anotações deste guia saem da tela. Uma cópia do texto fica na Auditoria.',
    botao: 'Apagar guia', perigo: true,
  });
  if (!ok) return;
  try {
    await guiaService.apagar(g.id);
    avisar('Guia apagado.', 'ok');
    router.push(g.caminho.length ? `/guias/${g.caminho.at(-1).id}` : '/guias');
  } catch (e) {
    avisarErro(e, 'Não foi possível apagar o guia.');
  }
};

let espera = null;
watch(busca, (texto) => {
  clearTimeout(espera);
  const q = texto.trim();
  if (q.length < 2) { achados.value = []; buscado.value = ''; return; }
  espera = setTimeout(async () => {
    try { achados.value = await guiaService.buscar(q); } catch { achados.value = []; }
    buscado.value = q;
  }, 300);
});
const irPara = (id) => {
  busca.value = '';
  router.push(`/guias/${id}`);
};

const dominio = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
};
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const resumo = (f) => [
  f.guias && plural(f.guias, 'guia dentro', 'guias dentro'),
  f.passos && plural(f.passos, 'passo', 'passos'),
  f.links && plural(f.links, 'site', 'sites'),
].filter(Boolean).join(' · ') || 'Vazio';

const CAMPO = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow';
const BOTAO_ICONE = 'p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30';
const LINK = 'text-indigo-600 underline underline-offset-2 break-all hover:text-indigo-800';
</script>

<template>
  <DashboardLayout>
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5">
      <div>
        <h1 class="text-2xl font-semibold text-slate-900 tracking-tight cursor-help" v-dica="AJUDA['/guias']">Guias</h1>
        <p class="text-slate-500 text-sm mt-1">O passo a passo de cada tarefa, com os sites e as anotações. Um guia pode ter outros guias dentro.</p>
      </div>
      <div class="relative w-full md:w-80">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input v-model="busca" type="search" placeholder="Buscar nos guias" data-campo="guia-busca" :class="CAMPO" class="pl-9" />
        <div v-if="busca.trim().length >= 2" class="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-80 overflow-y-auto" data-campo="guia-achados">
          <button v-for="a in achados" :key="a.id" @click="irPara(a.id)" class="block w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0">
            <div class="text-sm font-medium text-slate-800">{{ a.titulo }}</div>
            <div v-if="a.onde" class="text-[11px] text-slate-400">em {{ a.onde }}</div>
          </button>
          <p v-if="!achados.length" class="px-3 py-2 text-sm text-slate-400">{{ buscado === busca.trim() ? 'Nada encontrado.' : 'Buscando...' }}</p>
        </div>
      </div>
    </div>

    <nav v-if="guia" class="flex flex-wrap items-center gap-1 text-sm mb-4" data-campo="guia-caminho">
      <RouterLink to="/guias" class="text-indigo-600 hover:underline font-medium">Todos os guias</RouterLink>
      <template v-for="c in guia.caminho" :key="c.id">
        <ChevronRight class="w-4 h-4 text-slate-300" />
        <RouterLink :to="`/guias/${c.id}`" class="text-indigo-600 hover:underline">{{ c.titulo }}</RouterLink>
      </template>
      <ChevronRight class="w-4 h-4 text-slate-300" />
      <span class="text-slate-700 font-medium">{{ guia.titulo }}</span>
    </nav>

    <div v-if="carregando" class="flex items-center text-slate-400 py-16 justify-center">
      <Loader2 class="w-5 h-5 animate-spin mr-2" /> Carregando...
    </div>

    <template v-else>
      <section v-if="editando" class="bg-white rounded-xl border border-slate-200/80 shadow-sm mb-6" data-campo="guia-form">
        <div class="p-5 md:p-6 space-y-7">
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1.5">Título</label>
            <input v-model="editando.titulo" maxlength="120" data-campo="guia-titulo" :class="CAMPO" class="font-semibold" />
          </div>

          <div>
            <h3 class="text-xs font-medium text-slate-600 mb-2">Sites</h3>
            <div v-for="(l, i) in editando.links" :key="i" class="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_2fr_auto] gap-2 mb-2">
              <input v-model="l.titulo" maxlength="100" placeholder="Nome do site" :class="CAMPO" />
              <input v-model="l.url" maxlength="500" placeholder="Endereço do site" data-campo="guia-link-url" :class="CAMPO" class="order-3 sm:order-none col-span-2 sm:col-span-1" />
              <button @click="editando.links.splice(i, 1)" aria-label="Tirar este site" class="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"><X class="w-4 h-4" /></button>
            </div>
            <button @click="editando.links.push({ titulo: '', url: '' })" class="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
              <Plus class="w-4 h-4" /> Adicionar site
            </button>
          </div>

          <div>
            <h3 class="text-xs font-medium text-slate-600 mb-2">Passo a passo</h3>
            <div v-for="(p, i) in editando.passos" :key="i" class="flex gap-2 mb-2 items-start">
              <span class="w-6 h-6 mt-2 rounded-full bg-slate-900 text-white text-xs font-semibold flex items-center justify-center shrink-0">{{ i + 1 }}</span>
              <textarea v-model="editando.passos[i]" rows="2" maxlength="2000" data-campo="guia-passo"
                        :placeholder="i === 0 ? 'Descreva o primeiro passo' : 'Próximo passo'" :class="CAMPO" class="flex-1 resize-y"></textarea>
              <div class="flex flex-col">
                <button @click="mover(editando.passos, i, -1)" :disabled="i === 0" aria-label="Subir passo" :class="BOTAO_ICONE"><ChevronUp class="w-4 h-4" /></button>
                <button @click="mover(editando.passos, i, 1)" :disabled="i === editando.passos.length - 1" aria-label="Descer passo" :class="BOTAO_ICONE"><ChevronDown class="w-4 h-4" /></button>
              </div>
              <button @click="editando.passos.splice(i, 1)" aria-label="Tirar este passo" class="p-2 mt-0.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"><X class="w-4 h-4" /></button>
            </div>
            <button @click="editando.passos.push('')" data-campo="guia-add-passo" class="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
              <Plus class="w-4 h-4" /> Adicionar passo
            </button>
          </div>

          <div>
            <h3 class="text-xs font-medium text-slate-600 mb-2">Anotações</h3>
            <div v-for="(n, i) in editando.notas" :key="i" class="border rounded-xl p-3 mb-3 transition-colors" :class="TIPOS[n.tipo].card" data-campo="guia-nota-form">
              <div class="flex flex-wrap items-center gap-2 mb-2">
                <div class="flex bg-white border border-slate-200 rounded-lg p-0.5" role="radiogroup" aria-label="Tipo da anotação">
                  <button v-for="(t, chave) in TIPOS" :key="chave" @click="n.tipo = chave" role="radio" :aria-checked="n.tipo === chave"
                          class="px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors"
                          :class="n.tipo === chave ? t.ativo : 'text-slate-500 hover:text-slate-800'">
                    <component :is="t.icone" class="w-3.5 h-3.5" /> {{ t.nome }}
                  </button>
                </div>
                <div class="ml-auto flex items-center">
                  <button @click="mover(editando.notas, i, -1)" :disabled="i === 0" aria-label="Subir anotação" :class="BOTAO_ICONE"><ChevronUp class="w-4 h-4" /></button>
                  <button @click="mover(editando.notas, i, 1)" :disabled="i === editando.notas.length - 1" aria-label="Descer anotação" :class="BOTAO_ICONE"><ChevronDown class="w-4 h-4" /></button>
                  <button @click="editando.notas.splice(i, 1)" aria-label="Tirar esta anotação" class="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"><X class="w-4 h-4" /></button>
                </div>
              </div>
              <input v-model="n.titulo" maxlength="100" placeholder="Título" :class="CAMPO" class="mb-2 font-semibold bg-white" />
              <textarea v-model="n.texto" rows="4" maxlength="5000" placeholder="Escreva a anotação" data-campo="guia-nota-texto" :class="CAMPO" class="bg-white resize-y"></textarea>
            </div>
            <button @click="editando.notas.push(notaVazia())" data-campo="guia-add-nota" class="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
              <Plus class="w-4 h-4" /> Adicionar anotação
            </button>
            <p class="text-[11px] text-slate-400 mt-2">Não guarde senhas aqui: todos da equipe veem os guias.</p>
          </div>
        </div>
        <div class="bg-slate-50/70 px-5 md:px-6 py-4 border-t border-slate-200 flex justify-end gap-3 rounded-b-xl">
          <button @click="editando = null" class="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold shadow-xs hover:bg-slate-50 text-sm">Cancelar</button>
          <button @click="salvar" :disabled="salvando" data-campo="guia-salvar"
                  class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold shadow-xs flex items-center text-sm disabled:opacity-60">
            <Loader2 v-if="salvando" class="w-4 h-4 mr-2 animate-spin" /><Save v-else class="w-4 h-4 mr-2" /> Salvar guia
          </button>
        </div>
      </section>

      <section v-else-if="guia" class="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 md:p-6 mb-6" data-campo="guia-pagina">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="text-xl font-semibold text-slate-900 break-words">{{ guia.titulo }}</h2>
            <p v-if="guia.atualizado_por" class="text-xs text-slate-400 mt-1">Atualizado por {{ guia.atualizado_por }} em {{ guia.atualizado_em }}</p>
          </div>
          <div class="flex gap-1.5 shrink-0">
            <button @click="comecarEdicao" data-campo="guia-editar"
                    class="h-9 px-3 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold shadow-xs hover:bg-slate-50 text-sm flex items-center">
              <Pencil class="w-4 h-4 mr-1.5" /> Editar
            </button>
            <button @click="apagar" aria-label="Apagar guia" data-campo="guia-apagar" class="h-9 px-2.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 class="w-4 h-4" /></button>
          </div>
        </div>

        <div v-if="guia.links.length" class="mt-5">
          <h3 class="text-xs font-medium text-slate-500 mb-2">Sites</h3>
          <div class="flex flex-wrap gap-2">
            <a v-for="(l, i) in guia.links" :key="i" :href="l.url" target="_blank" rel="noopener noreferrer" data-campo="guia-link"
               class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100 text-sm font-medium hover:bg-indigo-100 max-w-full">
              <ExternalLink class="w-4 h-4 shrink-0" /> <span class="truncate">{{ l.titulo || dominio(l.url) }}</span>
            </a>
          </div>
        </div>

        <div v-if="guia.passos.length" class="mt-6">
          <div class="flex items-center justify-between gap-3 mb-1">
            <h3 class="text-xs font-medium text-slate-500">Passo a passo</h3>
            <button v-if="feitos.size" @click="feitos = new Set()" data-campo="guia-recomecar"
                    class="text-xs font-medium text-slate-500 hover:text-indigo-600 flex items-center gap-1">
              <span class="text-emerald-600">{{ feitos.size }} de {{ guia.passos.length }} feitos</span> · <RotateCcw class="w-3.5 h-3.5" /> Recomeçar
            </button>
          </div>
          <p class="text-[11px] text-slate-400 mb-3">Clique no número ao terminar cada passo.</p>
          <ol class="space-y-3">
            <li v-for="(p, i) in guia.passos" :key="i" class="flex gap-3">
              <button @click="marcar(i)" data-campo="guia-marcar" :aria-label="feitos.has(i) ? `Desmarcar passo ${i + 1}` : `Marcar passo ${i + 1} como feito`"
                      class="w-6 h-6 rounded-full text-white text-xs font-semibold flex items-center justify-center shrink-0 transition-colors"
                      :class="feitos.has(i) ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-900 hover:bg-indigo-600'">
                <Check v-if="feitos.has(i)" class="w-3.5 h-3.5" /><template v-else>{{ i + 1 }}</template>
              </button>
              <p class="text-sm whitespace-pre-wrap break-words pt-0.5 min-w-0 transition-colors" :class="feitos.has(i) ? 'text-slate-400 line-through' : 'text-slate-700'"><template v-for="(parte, k) in partesComLinks(p)" :key="k"><a v-if="parte.url" :href="parte.url" target="_blank" rel="noopener noreferrer" :class="LINK">{{ parte.texto }}</a><template v-else>{{ parte.texto }}</template></template></p>
            </li>
          </ol>
        </div>

        <div v-if="guia.notas.length" class="mt-6">
          <h3 class="text-xs font-medium text-slate-500 mb-2">Anotações</h3>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <article v-for="(n, i) in guia.notas" :key="i" class="rounded-xl border p-4" :class="TIPOS[n.tipo].card" data-campo="guia-nota">
              <header class="flex items-start gap-2">
                <component :is="TIPOS[n.tipo].icone" class="w-4 h-4 mt-0.5 shrink-0" :class="TIPOS[n.tipo].cor" />
                <h4 class="text-sm font-semibold text-slate-800 flex-1 min-w-0 break-words">{{ n.titulo || TIPOS[n.tipo].nome }}</h4>
                <button v-if="n.texto" @click="copiar(n.texto)" data-campo="guia-copiar"
                        class="-mt-1 -mr-1 px-2 py-1 rounded-md text-xs font-medium text-slate-500 hover:text-indigo-700 hover:bg-white/80 flex items-center gap-1 shrink-0">
                  <Copy class="w-3.5 h-3.5" /> Copiar
                </button>
              </header>
              <p v-if="n.texto" class="mt-1.5 pl-6 text-sm text-slate-700 whitespace-pre-wrap break-words"><template v-for="(parte, k) in partesComLinks(n.texto)" :key="k"><a v-if="parte.url" :href="parte.url" target="_blank" rel="noopener noreferrer" :class="LINK">{{ parte.texto }}</a><template v-else>{{ parte.texto }}</template></template></p>
            </article>
          </div>
        </div>

        <p v-if="!guia.links.length && !guia.passos.length && !guia.notas.length" class="mt-4 text-sm text-slate-400">
          Ainda sem passo a passo. Clique em <b>Editar</b> para escrever{{ filhos.length ? ' ou abra um dos guias abaixo' : '' }}.
        </p>
      </section>

      <section>
        <div class="flex items-center justify-between gap-3 mb-3">
          <h2 class="text-sm font-semibold text-slate-700 min-w-0 truncate">{{ guia ? `Dentro de "${guia.titulo}"` : 'Todos os guias' }}</h2>
          <button @click="abrirNovo" data-campo="guia-novo"
                  class="bg-indigo-600 hover:bg-indigo-700 text-white h-9 px-3.5 rounded-lg text-sm font-semibold shadow-xs flex items-center shrink-0">
            <Plus class="w-4 h-4 mr-1.5" /> {{ guia ? 'Novo guia aqui dentro' : 'Novo guia' }}
          </button>
        </div>

        <form v-if="novo.aberto" @submit.prevent="criar" class="flex flex-col sm:flex-row gap-2 mb-4 max-w-xl">
          <input ref="campoNovo" v-model="novo.titulo" maxlength="120" data-campo="guia-novo-titulo" :class="CAMPO"
                 placeholder="Título do guia" @keyup.esc="novo.aberto = false" />
          <div class="flex gap-2 shrink-0">
            <button type="submit" :disabled="novo.salvando" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-60">Criar</button>
            <button type="button" @click="novo.aberto = false" class="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50">Cancelar</button>
          </div>
        </form>

        <div v-if="filhos.length" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          <RouterLink v-for="f in filhos" :key="f.id" :to="`/guias/${f.id}`" data-campo="guia-filho"
                      class="group bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs hover:border-indigo-300 hover:shadow-sm transition-all flex gap-3 items-center">
            <span class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ring-1 ring-inset"
                  :class="f.guias ? 'bg-amber-50 text-amber-600 ring-amber-100' : 'bg-indigo-50 text-indigo-600 ring-indigo-100'">
              <component :is="f.guias ? FolderOpen : FileText" class="w-5 h-5" />
            </span>
            <div class="min-w-0">
              <div class="font-semibold text-slate-800 truncate group-hover:text-indigo-700">{{ f.titulo }}</div>
              <div class="text-xs text-slate-500 mt-0.5">{{ resumo(f) }}</div>
            </div>
            <ChevronRight class="w-4 h-4 text-slate-300 ml-auto shrink-0 group-hover:text-indigo-500" />
          </RouterLink>
        </div>
        <div v-else-if="!guia" class="bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center max-w-2xl">
          <BookOpen class="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p class="font-semibold text-slate-700">Nenhum guia ainda</p>
          <p class="text-sm text-slate-500 mt-1">Crie o primeiro guia. Dentro de cada guia dá para criar outros, cada um com o seu passo a passo.</p>
        </div>
        <p v-else class="text-sm text-slate-400">Nenhum guia aqui dentro. Use "Novo guia aqui dentro" para separar os casos.</p>
      </section>
    </template>
  </DashboardLayout>
</template>
