<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import DashboardLayout from '../layouts/DashboardLayout.vue';
import { ArrowLeft, Printer, Phone, CreditCard, AlertTriangle, FileText, Wallet, Search, Filter, Edit2, Trash2 } from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const isPrinting = ref(false);

// FILTROS
const buscaCheque = ref('');
const statusFiltro = ref('Todos');

// Simulação de dados
const cliente = ref({
  id: 1,
  nome: 'Carregando...',
  documento: '',
  telefone: '',
  limite: 0,
  taxa: 0,
  obs: '',
  endereco: 'Av. Brasil, 1234 - Centro, Foz do Iguaçu - PR'
});

const cheques = ref([
  { id: 101, vencimento: '2026-02-15', valor: 1500.00, status: 'Compensado', banco: 'Itau', doc: 'A-12' },
  { id: 102, vencimento: '2026-03-15', valor: 1500.00, status: 'Aberto', banco: 'Itau', doc: 'A-13' },
  { id: 103, vencimento: '2026-04-15', valor: 2350.50, status: 'Aberto', banco: 'Bradesco', doc: 'B-99' },
  { id: 104, vencimento: '2025-12-10', valor: 5000.00, status: 'Devolvido', banco: 'BB', doc: 'X-01' },
]);

onMounted(() => {
  // Mock para exemplo (usar ID da rota no futuro)
  cliente.value = { 
    id: route.params.id, 
    nome: 'Mercado Silva & Filhos', 
    documento: '12.345.678/0001-90', 
    telefone: '(45) 99988-7766', 
    taxa: 3.50, 
    limite: 50000.00,
    obs: 'Cliente preferencial.',
    endereco: 'Av. Brasil, 1234 - Centro'
  };
});

// Cheques Filtrados
const chequesFiltrados = computed(() => {
  return cheques.value.filter(cheque => {
    const termo = buscaCheque.value.toLowerCase();
    const matchBusca = 
      cheque.banco.toLowerCase().includes(termo) || 
      cheque.doc.toLowerCase().includes(termo);
    
    const matchStatus = statusFiltro.value === 'Todos' || cheque.status === statusFiltro.value;

    return matchBusca && matchStatus;
  });
});

const totalAberto = computed(() => cheques.value.filter(c => c.status === 'Aberto').reduce((a, b) => a + b.valor, 0));
const totalDevolvido = computed(() => cheques.value.filter(c => c.status === 'Devolvido').reduce((a, b) => a + b.valor, 0));

const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
const formatDate = (iso) => iso.split('-').reverse().join('/');

const exportarFicha = () => {
  isPrinting.value = true;
  setTimeout(() => { window.print(); isPrinting.value = false; }, 100);
};

// Mock Ações
const editarCheque = (id) => alert(`Editar cheque ${id}`);
const excluirCheque = (id) => {
  if(confirm('Apagar este cheque?')) alert(`Excluir cheque ${id}`);
};
</script>

<template>
  <DashboardLayout>
    <div class="print:hidden">
      <div class="flex justify-between items-center mb-6">
        <div class="flex items-center gap-3">
          <button @click="router.back()" class="p-2 hover:bg-slate-200 rounded-full text-slate-500"><ArrowLeft class="w-6 h-6" /></button>
          <div>
            <h1 class="text-2xl font-bold text-slate-900">{{ cliente.nome }}</h1>
            <p class="text-slate-500 text-sm">Ficha Cadastral e Financeira</p>
          </div>
        </div>
        <button @click="exportarFicha" class="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg font-bold shadow-sm flex items-center">
          <Printer class="w-4 h-4 mr-2" /> Imprimir Ficha
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div class="flex items-center gap-2 mb-4 text-indigo-600 font-bold uppercase text-xs tracking-wide">
            <FileText class="w-4 h-4" /> Dados Cadastrais
          </div>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between"><span class="text-slate-500">Documento</span> <span class="font-mono text-slate-900">{{ cliente.documento }}</span></div>
            <div class="flex justify-between"><span class="text-slate-500">Telefone</span> <span class="text-slate-900">{{ cliente.telefone }}</span></div>
            <div class="flex justify-between"><span class="text-slate-500">Taxa Padrão</span> <span class="font-bold text-blue-600">{{ cliente.taxa }}%</span></div>
            <div class="border-t pt-2 mt-2 text-slate-600 text-xs">{{ cliente.endereco }}</div>
          </div>
        </div>

        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div class="flex items-center gap-2 mb-4 text-emerald-600 font-bold uppercase text-xs tracking-wide">
            <CreditCard class="w-4 h-4" /> Limite e Crédito
          </div>
          <div class="mb-2">
            <span class="text-2xl font-bold text-slate-900">{{ formatMoney(cliente.limite) }}</span>
            <span class="text-xs text-slate-400 ml-2">Limite Total</span>
          </div>
          <div class="w-full bg-slate-100 h-2 rounded-full mb-2 overflow-hidden">
            <div class="bg-emerald-500 h-2 rounded-full" :style="{ width: Math.min((totalAberto / cliente.limite) * 100, 100) + '%' }"></div>
          </div>
          <div class="flex justify-between text-xs font-bold">
            <span class="text-slate-500">Em Uso: {{ formatMoney(totalAberto) }}</span>
            <span class="text-emerald-600">Disp: {{ formatMoney(cliente.limite - totalAberto) }}</span>
          </div>
        </div>

        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
          <div class="flex items-center gap-2 mb-4 text-red-600 font-bold uppercase text-xs tracking-wide">
            <AlertTriangle class="w-4 h-4" /> Pendências / Obs
          </div>
          <div v-if="totalDevolvido > 0" class="mb-3">
            <div class="text-red-600 font-bold text-lg">{{ formatMoney(totalDevolvido) }}</div>
            <div class="text-xs text-red-400">Em cheques devolvidos</div>
          </div>
          <div v-else class="text-emerald-600 font-bold mb-3">Nada consta</div>
          <div class="text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 italic">
            "{{ cliente.obs || 'Sem observações.' }}"
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        
        <div class="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/50">
          <h3 class="font-bold text-slate-700">Histórico de Cheques</h3>
          
          <div class="flex gap-3 w-full md:w-auto">
            <div class="relative flex-1 md:w-64">
              <Search class="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input 
                v-model="buscaCheque" 
                type="text" 
                placeholder="Buscar Banco ou Doc..." 
                class="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>
            
            <div class="relative">
              <Filter class="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <select v-model="statusFiltro" class="pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none appearance-none font-medium text-slate-700">
                <option value="Todos">Todos</option>
                <option value="Aberto">Aberto</option>
                <option value="Compensado">Compensado</option>
                <option value="Devolvido">Devolvido</option>
              </select>
            </div>
          </div>
        </div>

        <table class="w-full text-left text-sm">
          <thead class="bg-slate-50 text-slate-500 uppercase text-xs">
            <tr>
              <th class="px-4 py-3">Vencimento</th>
              <th class="px-4 py-3">Banco / Doc</th>
              <th class="px-4 py-3 text-right">Valor</th>
              <th class="px-4 py-3 text-center">Status</th>
              <th class="px-4 py-3 text-right w-20">Ações</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="cheque in chequesFiltrados" :key="cheque.id" class="hover:bg-slate-50 group">
              <td class="px-4 py-3 font-mono">{{ formatDate(cheque.vencimento) }}</td>
              <td class="px-4 py-3">{{ cheque.banco }} - {{ cheque.doc }}</td>
              <td class="px-4 py-3 text-right font-bold">{{ formatMoney(cheque.valor) }}</td>
              <td class="px-4 py-3 text-center">
                <span :class="{
                  'bg-emerald-100 text-emerald-700': cheque.status === 'Compensado',
                  'bg-yellow-100 text-yellow-700': cheque.status === 'Aberto',
                  'bg-red-100 text-red-700': cheque.status === 'Devolvido'
                }" class="px-2 py-1 rounded-full text-xs font-bold">{{ cheque.status }}</span>
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button @click="editarCheque(cheque.id)" class="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded"><Edit2 class="w-3.5 h-3.5" /></button>
                  <button @click="excluirCheque(cheque.id)" class="text-red-600 hover:bg-red-50 p-1.5 rounded"><Trash2 class="w-3.5 h-3.5" /></button>
                </div>
              </td>
            </tr>
            <tr v-if="chequesFiltrados.length === 0">
              <td colspan="5" class="px-4 py-8 text-center text-slate-400 italic">Nenhum cheque encontrado.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="isPrinting" class="print-overlay">
        <div class="print-paper">
          <div class="flex justify-between border-b-2 border-black pb-4 mb-6">
            <div class="flex items-center gap-3">
              <Wallet class="w-8 h-8" />
              <div><h1 class="text-2xl font-bold uppercase">Ficha do Cliente</h1><p class="text-sm">Fozesc - Gestão Financeira</p></div>
            </div>
          </div>
          <div class="border border-black p-4 mb-6 grid grid-cols-2 gap-4 text-sm">
            <div><strong>Cliente:</strong> {{ cliente.nome }}</div>
            <div><strong>Documento:</strong> {{ cliente.documento }}</div>
            <div><strong>Telefone:</strong> {{ cliente.telefone }}</div>
            <div><strong>Endereço:</strong> {{ cliente.endereco }}</div>
            <div class="col-span-2 border-t border-dashed border-gray-400 pt-2 mt-2">
              <strong>Observações:</strong> {{ cliente.obs }}
            </div>
          </div>
          <div class="grid grid-cols-3 gap-4 mb-6 text-center">
            <div class="border p-2">
              <div class="text-xs uppercase text-gray-500">Limite Total</div>
              <div class="font-bold text-lg">{{ formatMoney(cliente.limite) }}</div>
            </div>
            <div class="border p-2 bg-gray-50">
              <div class="text-xs uppercase text-gray-500">Em Aberto</div>
              <div class="font-bold text-lg">{{ formatMoney(totalAberto) }}</div>
            </div>
            <div class="border p-2">
              <div class="text-xs uppercase text-gray-500">Taxa Atual</div>
              <div class="font-bold text-lg">{{ cliente.taxa }}%</div>
            </div>
          </div>
          <h3 class="font-bold border-b border-black mb-2 uppercase text-sm">Cheques em Carteira</h3>
          <table class="w-full text-sm text-left">
            <thead>
              <tr class="border-b border-black">
                <th class="py-1">Vencimento</th>
                <th class="py-1">Banco</th>
                <th class="py-1">Status</th>
                <th class="py-1 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in chequesFiltrados" :key="c.id" class="border-b border-gray-200">
                <td class="py-1">{{ formatDate(c.vencimento) }}</td>
                <td class="py-1">{{ c.banco }} / {{ c.doc }}</td>
                <td class="py-1 uppercase text-xs">{{ c.status }}</td>
                <td class="py-1 text-right font-mono">{{ formatMoney(c.valor) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Teleport>
  </DashboardLayout>
</template>