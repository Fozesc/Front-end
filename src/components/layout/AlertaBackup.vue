<script setup>
import { ref, computed, onMounted } from 'vue';
import { DatabaseBackup, X } from 'lucide-vue-next';
import api from '../../services/api';
import { AJUDA } from '../../utils/ajuda';

// Aviso da tela inicial (so o Admin): backup que falhou ou parou de rodar. Fechar esconde so
// aquele aviso; uma falha nova aparece de novo.
const CHAVE = 'fozesc_backup_dispensado';
const alertas = ref([]);
const dispensados = ref([]);

let usuario = {};
try { usuario = JSON.parse(localStorage.getItem('user') || '{}') || {}; } catch { usuario = {}; }

onMounted(async () => {
  if (usuario.role !== 'Admin') return;
  try { dispensados.value = JSON.parse(localStorage.getItem(CHAVE) || '[]'); } catch { dispensados.value = []; }
  try {
    alertas.value = (await api.get('/settings/backup/status')).data.alertas || [];
  } catch (e) {
    console.error('Erro ao conferir o backup', e);
  }
});

const chave = (a) => `${a.tipo}@${a.quando}`;
const visiveis = computed(() => alertas.value.filter(a => !dispensados.value.includes(chave(a))));
const quando = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const dispensar = (a) => {
  dispensados.value = [...dispensados.value, chave(a)].slice(-20);
  try { localStorage.setItem(CHAVE, JSON.stringify(dispensados.value)); } catch { /* aba anonima */ }
};
</script>

<template>
  <div v-for="a in visiveis" :key="chave(a)" class="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-4 shadow-xs" role="alert" data-campo="alerta-backup">
    <div class="w-10 h-10 bg-white text-red-600 rounded-lg ring-1 ring-inset ring-red-200 flex items-center justify-center shrink-0"><DatabaseBackup class="w-5 h-5" /></div>
    <div class="flex-1 min-w-0">
      <p class="font-semibold text-red-900 text-sm cursor-help w-fit" v-dica="AJUDA.backupFalhou">{{ a.texto }} · {{ quando(a.quando) }}</p>
      <p class="text-[13px] text-red-700 mt-0.5 break-words">{{ a.detalhe }}</p>
    </div>
    <router-link :to="{ path: '/auditoria', query: { alvo: 'Backup' } }" class="h-8 px-3.5 inline-flex items-center bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-xs shrink-0">
      Ver na auditoria
    </router-link>
    <button @click="dispensar(a)" title="Esconder este aviso" class="p-2 text-red-400 hover:text-red-700 hover:bg-red-100 rounded-lg shrink-0"><X class="w-4 h-4" /></button>
  </div>
</template>
