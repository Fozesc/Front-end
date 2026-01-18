<script setup>
import { ref, computed } from 'vue';
import DashboardLayout from '../layouts/DashboardLayout.vue';
import { 
  Search, Plus, Filter, Edit2, Trash2, Phone, 
  AlertTriangle, Printer, ChevronRight, Wallet, AlertCircle 
} from 'lucide-vue-next';
import { useRouter } from 'vue-router';

const router = useRouter();
const isPrinting = ref(false);

// DADOS MOCKADOS
const clientes = ref([
  { 
    id: 1, 
    nome: 'Mercado Silva & Filhos', 
    documento: '12.345.678/0001-90', 
    telefone: '(45) 99988-7766', 
    taxa: 3.50, 
    limite: 50000.00, 
    cheques_ativos: 12, 
    cheques_totais: 45, 
    valor_em_aberto: 15400.00, 
    pendencia: false,
    obs: 'Cliente preferencial.' 
  },
  { 
    id: 2, 
    nome: 'João da Silva Construções', 
    documento: '123.456.789-00', 
    telefone: '(45) 98877-6655', 
    taxa: 4.00, 
    limite: 20000.00, 
    cheques_ativos: 3, 
    cheques_totais: 10, 
    valor_em_aberto: 18500.00, 
    pendencia: true, 
    obs: 'Cheque voltou mês passado.' 
  },
  { 
    id: 3, 
    nome: 'Auto Peças Foz', 
    documento: '98.765.432/0001-10', 
    telefone: '(45) 3522-1234', 
    taxa: 3.80, 
    limite: 100000.00, 
    cheques_ativos: 0, 
    cheques_totais: 120, 
    valor_em_aberto: 0.00, 
    pendencia: false,
    obs: '' 
  }
]);

const busca = ref('');

const clientesFiltrados = computed(() => {
  const termo = busca.value.toLowerCase().replace(/[^a-z0-9]/g, '');
  return clientes.value.filter(c => {
    const nome = c.nome.toLowerCase();
    const doc = c.documento.replace(/[^0-9]/g, '');
    const tel = c.telefone.replace(/[^0-9]/g, '');
    return nome.includes(termo) || doc.includes(termo) || tel.includes(termo);
  });
});

const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const getLimitColor = (aberto, total) => {
  const percent = (aberto / total) * 100;
  if (percent > 90) return 'bg-red-500';
  if (percent > 70) return 'bg-yellow-500';
  return 'bg-emerald-500';
};

const abrirCliente = (id) => {
  router.push(`/clientes/${id}`);
};

const editarCliente = (id) => {
  alert(`Editar cliente ${id} (Integrar com Backend)`);
};

const excluirCliente = (id) => {
  if(confirm('Tem certeza que deseja excluir este cliente?')) {
    alert(`Excluir cliente ${id} (Integrar com Backend)`);
  }
};

const exportarLista = () => {
  isPrinting.value = true;
  setTimeout(() => { window.print(); isPrinting.value = false; }, 100);
};

const getDataAtual = () => new Date().toLocaleDateString('pt-BR');
</script>

<template>
  <DashboardLayout>
    <div class="print:hidden">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 class="text-3xl font-bold text-slate-900 tracking-tight">Carteira de Clientes</h1>
          <p class="text-slate-500 text-sm">Gerencie taxas, limites e histórico.</p>
        </div>
        <div class="flex gap-3">
          <button @click="exportarLista" class="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2.5 rounded-lg font-bold shadow-sm flex items-center transition-all">
            <Printer class="w-5 h-5 mr-2" /> Exportar Lista
          </button>
          <button class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-bold shadow-md shadow-indigo-200 flex items-center transition-all">
            <Plus class="w-5 h-5 mr-2" /> Novo Cliente
          </button>
        </div>
      </div>

      <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex gap-4">
        <div class="relative flex-1">
          <Search class="w-5 h-5 absolute left-3 top-2.5 text-slate-400" />
          <input v-model="busca" type="text" placeholder="Buscar por nome, documento ou telefone..." class="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"/>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left whitespace-nowrap">
            <thead class="bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Cliente</th>
                <th class="px-6 py-3 text-xs font-bold text-slate-500 uppercase">CPF / CNPJ</th>
                <th class="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Telefone / Obs</th>
                <th class="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-center">Taxa</th>
                <th class="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Limite Crédito</th>
                <th class="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-center">Cheques</th>
                <th class="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-right">Ações</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr 
                v-for="cliente in clientesFiltrados" 
                :key="cliente.id" 
                class="group hover:bg-slate-50 transition-colors"
              >
                <td class="px-6 py-4 cursor-pointer" @click="abrirCliente(cliente.id)">
                  <div class="flex items-center">
                    <div class="h-10 w-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg mr-3">
                      {{ cliente.nome.charAt(0) }}
                    </div>
                    <div class="font-bold text-slate-900 flex items-center gap-2">
                      {{ cliente.nome }}
                      <span v-if="cliente.pendencia" class="flex items-center gap-1 text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full uppercase font-bold tracking-wide">
                        <AlertTriangle class="w-3 h-3" /> Pendência
                      </span>
                    </div>
                  </div>
                </td>

                <td class="px-6 py-4 cursor-pointer" @click="abrirCliente(cliente.id)">
                  <div class="text-sm text-slate-600 font-mono">{{ cliente.documento }}</div>
                </td>

                <td class="px-6 py-4 cursor-pointer" @click="abrirCliente(cliente.id)">
                  <div class="text-sm text-slate-600 font-medium flex items-center gap-2">
                    <Phone class="w-3.5 h-3.5 text-slate-400" /> {{ cliente.telefone }}
                  </div>
                  <div v-if="cliente.obs" class="mt-1 inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 max-w-[150px] truncate">
                    <AlertCircle class="w-3 h-3 flex-shrink-0" /> {{ cliente.obs }}
                  </div>
                </td>

                <td class="px-6 py-4 text-center cursor-pointer" @click="abrirCliente(cliente.id)">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700">{{ cliente.taxa.toFixed(2) }}%</span>
                </td>

                <td class="px-6 py-4 cursor-pointer" @click="abrirCliente(cliente.id)">
                  <div class="w-32">
                    <div class="flex justify-between text-xs mb-1">
                      <span class="font-bold text-slate-700">{{ formatMoney(cliente.valor_em_aberto) }}</span>
                      <span class="text-slate-400">{{ formatMoney(cliente.limite) }}</span>
                    </div>
                    <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div class="h-1.5 rounded-full" :class="getLimitColor(cliente.valor_em_aberto, cliente.limite)" :style="{ width: Math.min((cliente.valor_em_aberto / cliente.limite) * 100, 100) + '%' }"></div>
                    </div>
                  </div>
                </td>

                <td class="px-6 py-4 text-center cursor-pointer" @click="abrirCliente(cliente.id)">
                  <div class="text-sm font-bold text-slate-700"><span class="text-emerald-600">{{ cliente.cheques_ativos }}</span> <span class="text-slate-300">/</span> {{ cliente.cheques_totais }}</div>
                </td>

                <td class="px-6 py-4 text-right">
                  <div class="flex justify-end gap-2">
                    <button @click.stop="editarCliente(cliente.id)" class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Editar">
                      <Edit2 class="w-4 h-4" />
                    </button>
                    <button @click.stop="excluirCliente(cliente.id)" class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Excluir">
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="isPrinting" class="print-overlay">
        <div class="print-paper">
          <div class="flex justify-between items-center border-b-2 border-black pb-4 mb-6">
            <div class="flex items-center gap-3">
              <Wallet class="w-8 h-8" />
              <div><h1 class="text-2xl font-bold uppercase">Relatório de Clientes</h1><p class="text-sm">Fozesc - Gestão Financeira</p></div>
            </div>
            <div class="text-right text-sm">Gerado em: <strong>{{ getDataAtual() }}</strong></div>
          </div>
          <table class="w-full text-left text-sm border-collapse">
            <thead>
              <tr class="border-b border-black">
                <th class="py-2">Cliente</th>
                <th class="py-2">Documento</th>
                <th class="py-2">Telefone</th>
                <th class="py-2 text-right">Limite</th>
                <th class="py-2 text-right">Em Aberto</th>
                <th class="py-2 text-center">Situação</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in clientes" :key="c.id" class="border-b border-gray-200">
                <td class="py-2 font-bold">{{ c.nome }}</td>
                <td class="py-2">{{ c.documento }}</td>
                <td class="py-2">{{ c.telefone }}</td>
                <td class="py-2 text-right">{{ formatMoney(c.limite) }}</td>
                <td class="py-2 text-right font-bold">{{ formatMoney(c.valor_em_aberto) }}</td>
                <td class="py-2 text-center">
                  <span v-if="c.pendencia" class="font-bold text-red-600">PENDENTE</span>
                  <span v-else>OK</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Teleport>
  </DashboardLayout>
</template>

<style>
@media print {
  #app { display: none !important; }
  @page { margin: 0; size: auto; }
  body { margin: 0 !important; background: white !important; }
  .print-overlay { display: block !important; position: absolute; top: 0; left: 0; width: 100%; background: white; z-index: 9999; }
  .print-paper { padding: 15mm; background: white; }
}
</style>