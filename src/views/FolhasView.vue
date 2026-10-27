<script setup>
// Folhas de calculo (igual a do Smaug): contas livres, lado a lado, com @valores do sistema.
// Cada usuario ve so as suas. Quais estao abertas e a largura ficam lembradas no navegador.
import { ref, computed, onMounted } from 'vue';
import { AJUDA } from '../utils/ajuda';
import { Plus, Loader2 } from 'lucide-vue-next';
import DashboardLayout from '../layouts/DashboardLayout.vue';
import FolhaColuna from '../components/FolhaColuna.vue';
import folhaService from '../services/folhaService';

const CHAVE_ABERTAS = 'fozesc.folhas-abertas';
const CHAVE_LARGURA = 'fozesc.folhas-largura';
const LARGURA = 380;

const ler = (chave) => { try { return JSON.parse(localStorage.getItem(chave)); } catch { return null; } };
const guardar = (chave, valor) => { try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* aba anonima */ } };

const folhas = ref([]);
const refs = ref([]);
const carregando = ref(true);
const erro = ref('');
const abertasSalvas = ref(ler(CHAVE_ABERTAS));
const larguras = ref(ler(CHAVE_LARGURA) || {});
const focoId = ref(null);

onMounted(async () => {
  try {
    [folhas.value, refs.value] = await Promise.all([folhaService.listar(), folhaService.refs()]);
  } catch (e) {
    erro.value = e.response?.data?.error || 'Não foi possível carregar as folhas.';
  } finally {
    carregando.value = false;
  }
});

// sem preferencia guardada, todas abertas
const abertas = computed(() => abertasSalvas.value ?? folhas.value.map(f => f.id));
const setAbertas = (ids) => { abertasSalvas.value = ids; guardar(CHAVE_ABERTAS, ids); };
const alternar = (id) => setAbertas(abertas.value.includes(id) ? abertas.value.filter(i => i !== id) : [...abertas.value, id]);
const fechar = (id) => { focoId.value = null; setAbertas(abertas.value.filter(i => i !== id)); };

const focada = computed(() => folhas.value.find(f => f.id === focoId.value));
const visiveis = computed(() => (focada.value ? [focada.value] : folhas.value.filter(f => abertas.value.includes(f.id))));

const mudarLargura = (id, largura) => {
  const { [id]: _, ...resto } = larguras.value;
  larguras.value = largura === null ? resto : { ...resto, [id]: largura };
  guardar(CHAVE_LARGURA, larguras.value);
};

const criando = ref(false);
const novaFolha = async () => {
  criando.value = true;
  try {
    const f = await folhaService.criar(`Folha ${folhas.value.length + 1}`);
    folhas.value.push(f);
    setAbertas([...abertas.value, f.id]);
  } catch (e) {
    erro.value = e.response?.data?.error || 'Não foi possível criar a folha.';
  } finally {
    criando.value = false;
  }
};
const apagada = (id) => {
  folhas.value = folhas.value.filter(f => f.id !== id);
  fechar(id);
};
</script>

<template>
  <DashboardLayout>
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5">
      <div>
        <h1 class="text-2xl font-semibold text-slate-900 tracking-tight cursor-help" :title="AJUDA['/calculos']">Cálculos</h1>
        <p class="text-slate-500 text-sm mt-1">Contas livres, uma por linha, com o resultado ao lado. Tudo fica salvo sozinho.</p>
      </div>
      <button @click="novaFolha" :disabled="criando" data-campo="nova-folha"
              class="bg-indigo-600 hover:bg-indigo-700 text-white h-9 px-3.5 rounded-lg font-semibold text-sm flex items-center shadow-xs disabled:opacity-60">
        <Plus class="w-4 h-4 mr-2" /> Nova folha
      </button>
    </div>

    <p v-if="erro" class="mb-4 text-sm text-red-600">{{ erro }}</p>

    <div v-if="carregando" class="flex items-center text-slate-400 py-16 justify-center">
      <Loader2 class="w-5 h-5 animate-spin mr-2" /> Carregando...
    </div>

    <div v-else-if="!folhas.length" class="bg-white border border-slate-200 rounded-xl p-5 text-sm text-slate-600 space-y-2 max-w-2xl">
      <p class="font-semibold text-slate-800">Como usar</p>
      <ul class="list-disc pl-5 space-y-1 text-[13px]">
        <li><code>valor = 10.000</code> guarda um valor com nome para usar nas linhas de baixo</li>
        <li><code>juros: valor * 4%</code> — o que vem antes do ":" é só o nome da linha</li>
        <li><code>@</code> puxa valores do sistema: <code>@caixa</code>, <code>@caixa.bb</code>, <code>@carteira.atrasado</code>, <code>@vales</code>, <code>@taxa</code>, <code>@cliente.nome</code> (em aberto), <code>@cliente.nome.disponivel</code></li>
        <li><code>soma</code> soma tudo acima até a soma anterior</li>
        <li>Linha começando com <code>#</code> é anotação</li>
      </ul>
      <p class="text-[13px] text-slate-500">Clique em <b>Nova folha</b> para começar. Cada pessoa vê só as próprias folhas.</p>
    </div>

    <template v-else>
      <div class="flex flex-wrap gap-2 mb-4">
        <button v-for="f in folhas" :key="f.id" @click="focada ? (focoId = f.id) : alternar(f.id)"
                class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                :class="(focada ? focada.id === f.id : abertas.includes(f.id))
                  ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300'">
          {{ f.titulo }}
        </button>
      </div>
      <p v-if="!visiveis.length" class="text-sm text-slate-400">Escolha acima as folhas para abrir lado a lado.</p>
      <div v-else class="flex flex-col items-start gap-4 sm:flex-row sm:overflow-x-auto sm:pb-2">
        <FolhaColuna v-for="f in visiveis" :key="f.id" :folha="f" :refs="refs"
                     :largura="larguras[f.id] ?? LARGURA" :focada="!!focada"
                     @fechar="fechar(f.id)" @apagada="apagada(f.id)" @salva="(d) => Object.assign(f, d)"
                     @focar="focoId = focada ? null : f.id" @largura="(l) => mudarLargura(f.id, l)" />
      </div>
    </template>
  </DashboardLayout>
</template>
