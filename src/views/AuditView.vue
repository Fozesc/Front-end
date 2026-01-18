<script setup>
import { ref, computed } from 'vue';
import DashboardLayout from '../layouts/DashboardLayout.vue';
import { 
  ShieldCheck, Search, Filter, Calendar, 
  User, Activity, Monitor, AlertCircle 
} from 'lucide-vue-next';

// --- DADOS MOCKADOS (Simulando o Banco) ---
const logs = ref([
  { id: 105, user: 'Admin Lucas', action: 'DELETE', target: 'Cheque', targetId: '#402', details: 'Removeu cheque devolvido valor R$ 500,00', ip: '192.168.0.15', date: '2026-01-18T10:30:00' },
  { id: 104, user: 'Admin Lucas', action: 'UPDATE', target: 'Cliente', targetId: '#12', details: 'Alterou limite de crédito: 10k -> 20k', ip: '192.168.0.15', date: '2026-01-18T09:15:00' },
  { id: 103, user: 'Func. João', action: 'CREATE', target: 'Borderô', targetId: '#145609', details: 'Novo borderô para Mercado Silva (4 cheques)', ip: '192.168.0.22', date: '2026-01-18T08:45:00' },
  { id: 102, user: 'Func. João', action: 'LOGIN', target: 'Sistema', targetId: '-', details: 'Acesso realizado com sucesso', ip: '192.168.0.22', date: '2026-01-18T08:00:00' },
  { id: 101, user: 'Admin Lucas', action: 'LOGIN', target: 'Sistema', targetId: '-', details: 'Acesso realizado com sucesso', ip: '192.168.0.15', date: '2026-01-18T07:55:00' },
]);

const filtros = ref({
  busca: '',
  acao: 'TODOS', // CREATE, UPDATE, DELETE, LOGIN
});

// Lógica de Filtro
const logsFiltrados = computed(() => {
  return logs.value.filter(log => {
    const termo = filtros.value.busca.toLowerCase();
    const matchBusca = 
      log.user.toLowerCase().includes(termo) || 
      log.details.toLowerCase().includes(termo) ||
      log.target.toLowerCase().includes(termo);
    
    const matchAcao = filtros.value.acao === 'TODOS' || log.action === filtros.value.acao;
    
    return matchBusca && matchAcao;
  });
});

// Cores das Ações
const getActionStyle = (action) => {
  switch(action) {
    case 'CREATE': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'UPDATE': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'DELETE': return 'bg-red-100 text-red-700 border-red-200';
    case 'LOGIN': return 'bg-purple-100 text-purple-700 border-purple-200';
    default: return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

const formatDate = (iso) => {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR');
};
</script>

<template>
  <DashboardLayout>
    <div class="flex items-center gap-3 mb-8">
      <div class="bg-slate-800 p-2 rounded-lg text-white shadow-lg">
        <ShieldCheck class="w-6 h-6" />
      </div>
      <div>
        <h1 class="text-3xl font-bold text-slate-900">Auditoria e Segurança</h1>
        <p class="text-slate-500 text-sm">Rastreamento completo de atividades no sistema.</p>
      </div>
    </div>

    <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 grid grid-cols-1 md:grid-cols-12 gap-4">
      <div class="md:col-span-6 relative">
        <Search class="w-4 h-4 absolute left-3 top-3 text-slate-400" />
        <input 
          v-model="filtros.busca" 
          type="text" 
          placeholder="Buscar por usuário, detalhe ou módulo..." 
          class="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
        />
      </div>
      
      <div class="md:col-span-3 relative">
        <Activity class="w-4 h-4 absolute left-3 top-3 text-slate-400" />
        <select v-model="filtros.acao" class="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm appearance-none text-slate-600 font-medium">
          <option value="TODOS">Todas as Ações</option>
          <option value="LOGIN">Logins</option>
          <option value="CREATE">Criações</option>
          <option value="UPDATE">Edições</option>
          <option value="DELETE">Exclusões</option>
        </select>
      </div>

      <div class="md:col-span-3 relative">
        <Calendar class="w-4 h-4 absolute left-3 top-3 text-slate-400" />
        <input type="date" class="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-600 font-medium" />
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm whitespace-nowrap">
          <thead class="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
            <tr>
              <th class="px-6 py-3">Data / Hora</th>
              <th class="px-6 py-3">Usuário</th>
              <th class="px-6 py-3 text-center">Ação</th>
              <th class="px-6 py-3">Alvo / ID</th>
              <th class="px-6 py-3">Detalhes</th>
              <th class="px-6 py-3 text-right">IP Origem</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="log in logsFiltrados" :key="log.id" class="hover:bg-slate-50 transition-colors">
              <td class="px-6 py-4 font-mono text-xs text-slate-500">
                {{ formatDate(log.date) }}
              </td>

              <td class="px-6 py-4">
                <div class="flex items-center gap-2">
                  <div class="bg-slate-200 p-1 rounded-full"><User class="w-3 h-3 text-slate-600" /></div>
                  <span class="font-bold text-slate-700">{{ log.user }}</span>
                </div>
              </td>

              <td class="px-6 py-4 text-center">
                <span :class="getActionStyle(log.action)" class="px-2 py-1 rounded text-[10px] font-bold border uppercase tracking-wide">
                  {{ log.action }}
                </span>
              </td>

              <td class="px-6 py-4">
                <span class="font-medium text-slate-800">{{ log.target }}</span>
                <span class="text-slate-400 text-xs ml-1">{{ log.targetId }}</span>
              </td>

              <td class="px-6 py-4">
                <div class="text-slate-600 truncate max-w-xs" :title="log.details">
                  {{ log.details }}
                </div>
              </td>

              <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-1 text-slate-400 text-xs">
                  <Monitor class="w-3 h-3" /> {{ log.ip }}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center text-xs text-slate-500">
        <span>Mostrando últimos 50 registros</span>
        <button class="text-indigo-600 font-bold hover:underline">Ver histórico completo</button>
      </div>
    </div>

  </DashboardLayout>
</template>