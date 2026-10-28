<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Bell, CalendarDays, Check, Loader2, X } from 'lucide-vue-next';
import calendarioService from '../../services/calendarioService';
import { avisarErro } from '../../utils/avisos';
import { AJUDA } from '../../utils/ajuda';

// Sininho da tela inicial: o que o calendario tem para hoje, para os proximos 7 dias e o
// lembrete que passou sem ninguem marcar como feito. O numero vermelho conta so o de hoje e o
// atrasado que esta pessoa ainda nao viu (guardado neste navegador).
const CHAVE_VISTOS = 'fozesc_avisos_vistos';
const COR_TIPO = { evento: 'bg-indigo-500', nota: 'bg-amber-500', lembrete: 'bg-violet-500' };

const router = useRouter();
const aberto = ref(false);
const carregando = ref(false);
const salvando = ref(null);
const avisos = ref({ hoje: '', atrasados: [], de_hoje: [], proximos: [] });
const vistos = ref(new Set());

const chave = (e) => `${e.id}@${e.data}`;
const urgentes = computed(() => [...avisos.value.atrasados, ...avisos.value.de_hoje]);
const naoVistos = computed(() => urgentes.value.filter(e => !vistos.value.has(chave(e))).length);
const total = computed(() => urgentes.value.length + avisos.value.proximos.length);
const grupos = computed(() => [
  { id: 'atrasados', titulo: 'Passou e não foi feito', itens: avisos.value.atrasados, cor: 'text-red-700' },
  { id: 'de_hoje', titulo: 'Hoje', itens: avisos.value.de_hoje, cor: 'text-indigo-700' },
  { id: 'proximos', titulo: 'Próximos 7 dias', itens: avisos.value.proximos, cor: 'text-slate-600' },
].filter(g => g.itens.length));

const carregar = async () => {
  carregando.value = true;
  try {
    avisos.value = await calendarioService.avisos();
  } catch (e) {
    console.error('Erro ao buscar avisos do calendário', e);
  } finally {
    carregando.value = false;
  }
};

onMounted(() => {
  try { vistos.value = new Set(JSON.parse(localStorage.getItem(CHAVE_VISTOS) || '[]')); } catch { vistos.value = new Set(); }
  carregar();
});

const abrir = () => {
  aberto.value = !aberto.value;
  if (!aberto.value) return;
  // so guarda o que ainda esta no sininho: a lista nao cresce para sempre
  vistos.value = new Set(urgentes.value.map(chave));
  try { localStorage.setItem(CHAVE_VISTOS, JSON.stringify([...vistos.value])); } catch { /* aba anonima */ }
};

const quando = (data) => {
  const hoje = new Date(`${avisos.value.hoje}T12:00:00`);
  const dia = new Date(`${data}T12:00:00`);
  const dif = Math.round((dia - hoje) / 86400000);
  if (dif === 0) return 'hoje';
  if (dif === 1) return 'amanhã';
  if (dif === -1) return 'ontem';
  const texto = dia.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
  return dif < 0 ? `era ${texto}` : texto;
};

const moeda = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const irPara = (e) => { aberto.value = false; router.push({ path: '/calendario', query: { dia: e.data } }); };

const feito = async (e) => {
  salvando.value = e.id;
  try {
    await calendarioService.editar(e.id, { ...e, concluido: true });
    await carregar();
  } catch (err) {
    avisarErro(err, 'Não foi possível marcar como feito. Tente de novo.');
  } finally {
    salvando.value = null;
  }
};
</script>

<template>
  <div class="relative">
    <button type="button" @click="abrir" data-campo="sininho" :aria-expanded="aberto" v-dica="AJUDA.sininho"
            :aria-label="total ? `${total} aviso(s) do calendário` : 'Avisos do calendário'"
            class="relative bg-white h-9 w-9 rounded-lg border border-slate-200 shadow-xs flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors">
      <Bell class="w-[18px] h-[18px]" />
      <span v-if="naoVistos" data-campo="sininho-numero"
            class="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center tabular-nums ring-2 ring-white">
        {{ naoVistos > 9 ? '9+' : naoVistos }}
      </span>
    </button>

    <template v-if="aberto">
      <div class="fixed inset-0 z-40" @click="aberto = false"></div>
      <div class="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden" data-campo="sininho-painel">
        <header class="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-slate-900">Avisos do calendário</h3>
            <p class="text-xs text-slate-500">Eventos, notas e lembretes que ainda não foram feitos</p>
          </div>
          <button @click="aberto = false" aria-label="Fechar" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"><X class="w-4 h-4" /></button>
        </header>

        <div class="max-h-[60vh] overflow-y-auto">
          <div v-if="carregando && !total" class="py-8 flex justify-center text-slate-400"><Loader2 class="w-5 h-5 animate-spin" /></div>
          <p v-else-if="!total" class="px-4 py-8 text-center text-sm text-slate-400">Nada no calendário para hoje nem para os próximos 7 dias.</p>

          <section v-for="g in grupos" :key="g.id" class="py-2 border-b border-slate-100 last:border-0">
            <div class="px-4 pb-1 text-xs font-semibold" :class="g.cor">{{ g.titulo }}</div>
            <div v-for="e in g.itens" :key="e.id" class="px-4 py-2 flex items-start gap-3 hover:bg-slate-50 group" :data-aviso="e.id">
              <span class="w-2 h-2 rounded-full mt-1.5 shrink-0" :class="COR_TIPO[e.tipo]"></span>
              <button type="button" @click="irPara(e)" class="min-w-0 flex-1 text-left">
                <div class="text-sm font-medium text-slate-800 truncate">{{ e.titulo }}</div>
                <div class="text-xs text-slate-500 flex flex-wrap gap-x-2">
                  <span :class="g.id === 'atrasados' ? 'text-red-600 font-medium' : ''">{{ quando(e.data) }}</span>
                  <span class="capitalize">{{ e.tipo }}</span>
                  <span v-if="e.cliente" class="truncate">{{ e.cliente }}</span>
                  <span v-if="e.valor" class="font-semibold tabular-nums" :class="e.previsao === 'entrada' ? 'text-emerald-600' : 'text-red-600'">
                    {{ e.previsao === 'entrada' ? '+' : '−' }} {{ moeda(e.valor) }}
                  </span>
                </div>
              </button>
              <button type="button" @click="feito(e)" :disabled="salvando === e.id" title="Marcar como feito"
                      class="h-7 px-2 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50 flex items-center gap-1 shrink-0 disabled:opacity-50">
                <Loader2 v-if="salvando === e.id" class="w-3.5 h-3.5 animate-spin" /><Check v-else class="w-3.5 h-3.5" /> Feito
              </button>
            </div>
          </section>
        </div>

        <footer class="px-4 py-2.5 bg-slate-50/70 border-t border-slate-200">
          <router-link to="/calendario" class="text-sm font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5">
            <CalendarDays class="w-4 h-4" /> Abrir o calendário
          </router-link>
        </footer>
      </div>
    </template>
  </div>
</template>
