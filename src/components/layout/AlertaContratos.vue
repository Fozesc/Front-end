<script setup>
import { ref, onMounted } from 'vue';
import { FileSignature } from 'lucide-vue-next';
import contratoService from '../../services/contratoService';

// Linha fina na tela inicial: contratos da Fozesc sem assinatura e com titulo vencido (da para mandar a notificacao)
const p = ref({ nao_assinados: 0, com_atraso: 0 });
onMounted(async () => {
  try { p.value = await contratoService.pendencias(); } catch (e) { console.error('Erro ao conferir os contratos', e); }
});
</script>

<template>
  <div v-if="p.nao_assinados || p.com_atraso" class="mb-4 bg-white border border-slate-200/80 rounded-xl px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm shadow-xs" data-campo="alerta-contratos">
    <span class="flex items-center gap-2 font-medium text-slate-700"><FileSignature class="w-4 h-4 text-indigo-600" /> Contratos</span>
    <router-link v-if="p.nao_assinados" :to="{ path: '/contratos', query: { filtro: 'nao' } }" class="text-amber-700 hover:underline" data-campo="contratos-nao-assinados">
      {{ p.nao_assinados === 1 ? '1 sem assinatura' : `${p.nao_assinados} sem assinatura` }}
    </router-link>
    <router-link v-if="p.com_atraso" :to="{ path: '/contratos', query: { filtro: 'atraso' } }" class="text-red-700 hover:underline" data-campo="contratos-atraso">
      {{ p.com_atraso === 1 ? '1 com título vencido' : `${p.com_atraso} com título vencido` }} · pode mandar a notificação
    </router-link>
  </div>
</template>
