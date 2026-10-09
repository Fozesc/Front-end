<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import DashboardLayout from '../layouts/DashboardLayout.vue';
import ClientSelect from '../components/inputs/ClientSelect.vue';
import EventoModal from '../components/layout/EventoModal.vue';
import calendarioService from '../services/calendarioService';
import {
  ChevronLeft, ChevronRight, Plus, Loader2, AlertTriangle, Banknote, CalendarDays, StickyNote, BellRing,
  Pencil, Trash2, CheckCircle2, TrendingUp
} from 'lucide-vue-next';

const iso = (d) => d.toLocaleDateString('en-CA');
const hojeIso = iso(new Date());
const mes = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
const filtro = reactive({ clienteId: null });
const camadas = reactive({ cheques: true, evento: true, nota: true, lembrete: true });
const dados = ref(null);
const carregando = ref(false);
const erro = ref('');
const diaSel = ref(hojeIso);
const modal = reactive({ aberto: false, evento: null, data: '' });

const CAMADAS = [
  { id: 'cheques', nome: 'Cheques', icone: Banknote, ativo: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
  { id: 'evento', nome: 'Eventos', icone: CalendarDays, ativo: 'border-indigo-300 bg-indigo-50 text-indigo-700' },
  { id: 'nota', nome: 'Notas', icone: StickyNote, ativo: 'border-amber-300 bg-amber-50 text-amber-800' },
  { id: 'lembrete', nome: 'Lembretes', icone: BellRing, ativo: 'border-violet-300 bg-violet-50 text-violet-700' },
];
const COR_TIPO = { evento: 'bg-indigo-500', nota: 'bg-amber-500', lembrete: 'bg-violet-500' };
const CHIP_TIPO = { evento: 'bg-indigo-50 text-indigo-700 ring-indigo-100', nota: 'bg-amber-50 text-amber-800 ring-amber-100', lembrete: 'bg-violet-50 text-violet-700 ring-violet-100' };

// grade: do domingo antes do dia 1 ao sabado depois do ultimo dia (5 ou 6 semanas)
const dias = computed(() => {
  const primeiro = mes.value;
  const ini = new Date(primeiro); ini.setDate(1 - primeiro.getDay());
  const ultimo = new Date(primeiro.getFullYear(), primeiro.getMonth() + 1, 0);
  const fim = new Date(ultimo); fim.setDate(ultimo.getDate() + (6 - ultimo.getDay()));
  const lista = [];
  for (const d = new Date(ini); d <= fim; d.setDate(d.getDate() + 1)) {
    lista.push({ iso: iso(d), dia: d.getDate(), doMes: d.getMonth() === primeiro.getMonth() });
  }
  return lista;
});
const maiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const tituloMes = computed(() => maiuscula(mes.value.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })));

const carregar = async () => {
  carregando.value = true;
  erro.value = '';
  try {
    dados.value = await calendarioService.periodo({
      inicio: dias.value[0].iso, fim: dias.value[dias.value.length - 1].iso,
      ...(filtro.clienteId ? { cliente_id: filtro.clienteId } : {})
    });
  } catch (e) {
    erro.value = e.response?.data?.error || 'Não foi possível carregar o calendário.';
  } finally {
    carregando.value = false;
  }
};
watch([mes, () => filtro.clienteId], carregar);
onMounted(carregar);

const mudarMes = (n) => { mes.value = new Date(mes.value.getFullYear(), mes.value.getMonth() + n, 1); };
const irHoje = () => { mes.value = new Date(new Date().getFullYear(), new Date().getMonth(), 1); diaSel.value = hojeIso; };

const porDia = computed(() => {
  const mapa = {};
  const pegar = (d) => (mapa[d] ||= { cheques: [], eventos: [], total: 0, vencidos: 0 });
  if (camadas.cheques) {
    for (const c of dados.value?.cheques || []) {
      const d = pegar(c.vencimento);
      d.cheques.push(c);
      d.total += c.valor;
      if (c.status === 'Atrasado' || c.status === 'Devolvido') d.vencidos++;
    }
  }
  for (const e of dados.value?.eventos || []) if (camadas[e.tipo]) pegar(e.data).eventos.push(e);
  return mapa;
});
const doDia = computed(() => porDia.value[diaSel.value] || { cheques: [], eventos: [], total: 0, vencidos: 0 });

const novo = (data) => Object.assign(modal, { aberto: true, evento: null, data: data || diaSel.value });
const editar = (e) => Object.assign(modal, { aberto: true, evento: e, data: '' });
const apagar = async (e) => {
  if (!confirm(`Apagar "${e.titulo}"?`)) return;
  try { await calendarioService.apagar(e.id); await carregar(); } catch (err) { erro.value = err.response?.data?.error || 'Não foi possível apagar.'; }
};
const concluir = async (e) => {
  try { await calendarioService.editar(e.id, { ...e, concluido: !e.concluido }); await carregar(); } catch (err) { erro.value = err.response?.data?.error || 'Não foi possível salvar.'; }
};

const moeda = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const curta = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(v || 0);
const dataLonga = (d) => maiuscula(new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }));
</script>

<template>
  <DashboardLayout>
    <EventoModal v-if="modal.aberto" :evento="modal.evento" :data="modal.data" @close="modal.aberto = false" @salvo="carregar" />

    <div class="space-y-4">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
          <h1 class="text-2xl font-semibold text-slate-900 tracking-tight">Calendário</h1>
          <p class="text-slate-500 text-sm mt-0.5">Cheques por vencimento, eventos, notas e lembretes, com a previsão do caixa.</p>
        </div>
        <button @click="novo()" data-campo="novo-evento" class="h-9 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-semibold shadow-xs flex items-center gap-2">
          <Plus class="w-4 h-4" /> Novo evento
        </button>
      </div>

      <!-- previsao: metodo do sistema financeiro -->
      <section v-if="dados" class="grid grid-cols-2 lg:grid-cols-5 gap-3" data-campo="previsao">
        <div class="bg-slate-900 rounded-lg p-4">
          <div class="text-xs font-medium text-slate-400">Saldo do caixa</div>
          <div class="mt-1 text-lg font-semibold tabular-nums" :class="dados.previsao.saldo < 0 ? 'text-red-300' : 'text-white'">{{ moeda(dados.previsao.saldo) }}</div>
          <div class="text-[11px] text-slate-400">tudo que foi lançado</div>
        </div>
        <div v-for="h in dados.previsao.horizontes" :key="h.dias" class="bg-white border border-slate-200 rounded-lg shadow-xs p-4">
          <div class="flex items-center gap-1.5 text-xs font-medium text-slate-500"><TrendingUp class="w-3.5 h-3.5" /> Previsto em {{ h.dias }} dias</div>
          <div class="mt-1 text-lg font-semibold tabular-nums" :class="h.saldo_previsto < 0 ? 'text-red-600' : 'text-slate-900'">{{ moeda(h.saldo_previsto) }}</div>
          <div class="text-[11px] tabular-nums"><span class="text-emerald-600">+ {{ moeda(h.a_receber) }}</span> <span class="text-red-600">− {{ moeda(h.a_pagar) }}</span></div>
        </div>
        <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div class="text-xs font-medium text-amber-800">Cheques vencidos</div>
          <div class="mt-1 text-lg font-semibold tabular-nums text-amber-900">{{ moeda(dados.previsao.vencido) }}</div>
          <div class="text-[11px] text-amber-700">{{ dados.previsao.qtd_vencidos }} cheque(s) · não entram na previsão</div>
        </div>
      </section>

      <section class="bg-white border border-slate-200 rounded-lg shadow-xs p-4 flex flex-col xl:flex-row xl:items-end gap-4">
        <div class="flex items-center gap-2">
          <button @click="mudarMes(-1)" aria-label="Mês anterior" class="h-10 w-10 flex items-center justify-center rounded-md border border-slate-300 bg-white hover:bg-slate-50"><ChevronLeft class="w-4 h-4" /></button>
          <div class="min-w-[170px] text-center text-base font-semibold text-slate-900" data-campo="titulo-mes">{{ tituloMes }}</div>
          <button @click="mudarMes(1)" aria-label="Próximo mês" class="h-10 w-10 flex items-center justify-center rounded-md border border-slate-300 bg-white hover:bg-slate-50"><ChevronRight class="w-4 h-4" /></button>
          <button @click="irHoje" class="h-10 px-3 rounded-md border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50">Hoje</button>
          <Loader2 v-if="carregando" class="w-4 h-4 animate-spin text-slate-400" />
        </div>
        <div class="w-full xl:w-72"><ClientSelect v-model="filtro.clienteId" /></div>
        <div class="flex flex-wrap gap-1.5 xl:ml-auto" role="group" aria-label="O que mostrar">
          <button v-for="c in CAMADAS" :key="c.id" @click="camadas[c.id] = !camadas[c.id]" :aria-pressed="camadas[c.id]" :data-camada="c.id"
                  class="h-10 px-3 rounded-md border text-[13px] font-semibold flex items-center gap-1.5 transition-colors"
                  :class="camadas[c.id] ? c.ativo : 'border-slate-200 bg-white text-slate-400 line-through'">
            <component :is="c.icone" class="w-4 h-4" /> {{ c.nome }}
          </button>
        </div>
      </section>

      <div v-if="erro" class="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm font-medium flex items-center gap-2">
        <AlertTriangle class="w-4 h-4 flex-shrink-0" /> {{ erro }}
      </div>
      <div v-if="dados?.cheques_cortados" class="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-sm">Muitos cheques neste mês: mostrando os 2.000 primeiros. Filtre por cliente para ver todos.</div>

      <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
        <section class="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
          <div class="grid grid-cols-7 bg-slate-50/80 border-b border-slate-200 text-xs font-medium text-slate-500">
            <div v-for="d in ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']" :key="d" class="px-2 py-2 text-center">{{ d }}</div>
          </div>
          <div class="grid grid-cols-7">
            <button v-for="d in dias" :key="d.iso" type="button" @click="diaSel = d.iso" @dblclick="novo(d.iso)" :data-dia="d.iso"
                    class="min-h-[112px] border-b border-r border-slate-100 p-1.5 text-left align-top flex flex-col gap-1 transition-colors"
                    :class="[d.doMes ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/60 text-slate-400', diaSel === d.iso ? 'ring-2 ring-inset ring-indigo-400 !bg-indigo-50/40' : '']">
              <div class="flex items-center justify-between">
                <span class="w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold"
                      :class="d.iso === hojeIso ? 'bg-indigo-600 text-white' : d.doMes ? 'text-slate-700' : 'text-slate-400'">{{ d.dia }}</span>
              </div>
              <div v-if="porDia[d.iso]?.cheques.length" class="px-1.5 py-0.5 rounded text-[11px] font-semibold truncate flex items-center gap-1"
                   :class="porDia[d.iso].vencidos ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'"
                   :title="`${porDia[d.iso].cheques.length} cheque(s) · ${moeda(porDia[d.iso].total)}${porDia[d.iso].vencidos ? ' · com vencido' : ''}`">
                <Banknote class="w-3 h-3 flex-shrink-0" /> {{ porDia[d.iso].cheques.length }} · {{ curta(porDia[d.iso].total) }}
              </div>
              <div v-for="e in (porDia[d.iso]?.eventos || []).slice(0, 2)" :key="e.id" class="flex items-center gap-1 text-[11px] text-slate-700 truncate">
                <span class="w-1.5 h-1.5 rounded-full flex-shrink-0" :class="COR_TIPO[e.tipo]"></span>
                <span class="truncate" :class="e.concluido ? 'line-through text-slate-400' : ''">{{ e.titulo }}</span>
              </div>
              <div v-if="(porDia[d.iso]?.eventos.length || 0) > 2" class="text-[10px] text-slate-400">+ {{ porDia[d.iso].eventos.length - 2 }}</div>
              <div v-if="dados?.saldo_previsto?.[d.iso] !== undefined" class="mt-auto text-[10px] tabular-nums"
                   :class="dados.saldo_previsto[d.iso] < 0 ? 'text-red-500' : 'text-slate-400'" :title="'Saldo previsto: ' + moeda(dados.saldo_previsto[d.iso])">
                prev. {{ curta(dados.saldo_previsto[d.iso]) }}
              </div>
            </button>
          </div>
        </section>

        <aside class="bg-white border border-slate-200 rounded-lg shadow-xs xl:sticky xl:top-4" data-campo="painel-dia">
          <header class="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
            <div>
              <h2 class="text-sm font-semibold text-slate-900">{{ dataLonga(diaSel) }}</h2>
              <p v-if="dados?.saldo_previsto?.[diaSel] !== undefined" class="text-xs text-slate-500">Saldo previsto: <b class="tabular-nums" :class="dados.saldo_previsto[diaSel] < 0 ? 'text-red-600' : 'text-slate-800'">{{ moeda(dados.saldo_previsto[diaSel]) }}</b></p>
            </div>
            <button @click="novo(diaSel)" class="h-8 px-2.5 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1"><Plus class="w-3.5 h-3.5" /> Adicionar</button>
          </header>
          <div class="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
            <div v-if="doDia.cheques.length">
              <div class="text-xs font-semibold text-slate-500 mb-1.5">Cheques · {{ moeda(doDia.total) }}</div>
              <ul class="space-y-1.5">
                <li v-for="c in doDia.cheques" :key="c.id" class="rounded-md border border-slate-200 px-2.5 py-2 text-sm">
                  <div class="flex justify-between gap-2"><span class="font-medium text-slate-800 truncate">{{ c.emitente || c.cliente }}</span><span class="font-semibold tabular-nums">{{ moeda(c.valor) }}</span></div>
                  <div class="flex justify-between text-[11px] text-slate-500"><span class="truncate">{{ c.cliente }} · nº {{ c.numero || 'S/N' }}</span>
                    <span :class="c.status === 'Aguardando' ? 'text-emerald-600' : 'text-red-600 font-semibold'">{{ c.status === 'Aguardando' ? 'a receber' : c.status.toLowerCase() }}</span></div>
                </li>
              </ul>
            </div>
            <div v-if="doDia.eventos.length">
              <div class="text-xs font-semibold text-slate-500 mb-1.5">Eventos e notas</div>
              <ul class="space-y-1.5">
                <li v-for="e in doDia.eventos" :key="e.id" class="rounded-md border border-slate-200 px-2.5 py-2 text-sm" data-campo="evento-do-dia">
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                      <span class="px-1.5 py-px rounded text-[10px] font-semibold ring-1 ring-inset capitalize" :class="CHIP_TIPO[e.tipo]">{{ e.tipo }}</span>
                      <div class="font-medium text-slate-800 mt-1" :class="e.concluido ? 'line-through text-slate-400' : ''">{{ e.titulo }}</div>
                    </div>
                    <div class="flex gap-0.5 flex-shrink-0">
                      <button v-if="e.valor" @click="concluir(e)" :title="e.concluido ? 'Marcar como pendente' : 'Já aconteceu'" class="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"><CheckCircle2 class="w-4 h-4" /></button>
                      <button @click="editar(e)" title="Editar" class="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"><Pencil class="w-4 h-4" /></button>
                      <button @click="apagar(e)" title="Apagar" class="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 class="w-4 h-4" /></button>
                    </div>
                  </div>
                  <p v-if="e.descricao" class="text-xs text-slate-600 mt-1 whitespace-pre-line">{{ e.descricao }}</p>
                  <div class="flex flex-wrap gap-x-3 text-[11px] text-slate-500 mt-1">
                    <span v-if="e.cliente">{{ e.cliente }}</span>
                    <span v-if="e.valor" class="font-semibold" :class="e.previsao === 'entrada' ? 'text-emerald-600' : 'text-red-600'">
                      {{ e.previsao === 'entrada' ? '+' : '−' }} {{ moeda(e.valor) }}{{ e.concluido ? ' · já aconteceu' : '' }}
                    </span>
                    <span>por {{ e.autor }}</span>
                  </div>
                </li>
              </ul>
            </div>
            <p v-if="!doDia.cheques.length && !doDia.eventos.length" class="text-sm text-slate-400 text-center py-6">Nada neste dia.<br><span class="text-xs">Clique duas vezes num dia para adicionar.</span></p>
          </div>
        </aside>
      </div>
    </div>
  </DashboardLayout>
</template>
