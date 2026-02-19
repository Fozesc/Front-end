<script setup>
import { ref, onMounted, reactive, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router'; 
import DashboardLayout from '../layouts/DashboardLayout.vue';
import { 
  Plus, Search, Printer, Edit2, 
  AlertTriangle, AlertCircle, X, Loader2,
  ArrowLeft, ArrowRight, RotateCcw, User, FileText, Phone
} from 'lucide-vue-next';
import clientService from '../services/clientService';

const router = useRouter();

const clientes = ref([]);
const loading = ref(true);
const isPrinting = ref(false);

const totalItems = ref(0);
const totalPages = ref(1);
const currentPage = ref(1);
const itemsPerPage = 20;

const filters = reactive({
  search: ''
});

const showModal = ref(false); 
const saving = ref(false);

const form = ref({
  id: null, name: '', document: '', phone: '',
  credit_limit: 0, standard_rate: 4.00, notes: ''
});

const fetchClientes = async () => {
  loading.value = true;
  try {
    const params = {
      page: currentPage.value,
      per_page: itemsPerPage,
      search: filters.search
    };

    const response = await clientService.getAll(params);
    
    clientes.value = response.items;
    totalItems.value = response.total;
    totalPages.value = response.pages;

  } catch (error) {
    console.error("Erro ao carregar clientes:", error);
  } finally {
    loading.value = false;
  }
};

let timeoutSearch = null;
watch(() => filters.search, () => {
  clearTimeout(timeoutSearch);
  timeoutSearch = setTimeout(() => {
    currentPage.value = 1;
    fetchClientes();
  }, 400); 
});

const mudarPagina = (novaPagina) => {
  if (novaPagina >= 1 && novaPagina <= totalPages.value) {
    currentPage.value = novaPagina;
    fetchClientes();
  }
};

const resetFilters = () => {
  filters.search = '';
  currentPage.value = 1;
  fetchClientes();
};

onMounted(fetchClientes);

const abrirDetalhes = (id) => { router.push({ name: 'cliente-detalhes', params: { id } }); };

const salvarCliente = async () => {
  if (!form.value.name) return alert("O nome é obrigatório.");
  saving.value = true;
  try {
    const payload = { ...form.value };
    if (form.value.id) await clientService.update(form.value.id, payload);
    else await clientService.create(payload);
    showModal.value = false;
    fetchClientes(); 
  } catch (error) { alert('Erro ao salvar.'); } finally { saving.value = false; }
};

const abrirModal = (clienteId = null) => {
  if (clienteId) {
    const original = clientes.value.find(c => c.id === clienteId);
    form.value = { ...original };
  } else {
    form.value = { id: null, name: '', document: '', phone: '', credit_limit: 0, standard_rate: 4.00, notes: '' };
  }
  showModal.value = true;
};

const maskPhone = (v) => v ? v.replace(/\D/g, "").replace(/^(\d{2})(\d)/g, "($1) $2").replace(/(\d)(\d{4})$/, "$1-$2") : '';
const onPhoneInput = (e) => { form.value.phone = maskPhone(e.target.value); };
const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
const getLimitColor = (usado, limite) => {
  if (!limite || limite <= 0) return 'bg-slate-300';
  const porc = (usado / limite) * 100;
  if (porc >= 100) return 'bg-red-600'; 
  if (porc > 80) return 'bg-amber-500';
  return 'bg-emerald-500';
};
const exportarLista = async () => { isPrinting.value = true; await nextTick(); window.print(); isPrinting.value = false; };
</script>

<template>
  <DashboardLayout>
    <div class="print:hidden">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 class="text-3xl font-bold text-slate-900 tracking-tight">Carteira de Clientes</h1>
          <div class="flex items-center gap-2 mt-1">
            <span class="text-slate-500 text-sm">Total: <strong>{{ totalItems }}</strong> clientes</span>
            <span v-if="loading" class="text-xs text-indigo-500 font-bold ml-2 flex items-center">
              <Loader2 class="w-3 h-3 mr-1 animate-spin" /> Buscando...
            </span>
          </div>
        </div>
        <div class="flex gap-3">
          <button @click="exportarLista" class="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2.5 rounded-lg font-bold shadow-sm flex items-center transition-all">
            <Printer class="w-5 h-5 mr-2" /> Exportar
          </button>
          <button @click="abrirModal()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-bold shadow-md shadow-indigo-200 flex items-center transition-all">
            <Plus class="w-5 h-5 mr-2" /> Novo Cliente
          </button>
        </div>
      </div>

      <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex gap-4">
        <div class="relative flex-1">
          <Search class="w-5 h-5 absolute left-3 top-2.5 text-slate-400" />
          <input 
            v-model="filters.search" 
            type="text" 
            placeholder="Buscar por nome, documento ou telefone..." 
            class="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
          />
        </div>
        <button @click="resetFilters" class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Limpar">
          <RotateCcw class="w-5 h-5" />
        </button>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[400px]">
        <div class="overflow-x-auto">
          <table class="w-full text-left whitespace-nowrap">
            <thead class="bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Cliente / Obs</th>
                <th class="px-6 py-3 text-xs font-bold text-slate-500 uppercase">CPF / CNPJ</th>
                <th class="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Telefone</th>
                <th class="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-center">Taxa</th>
                <th class="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Limite Crédito</th>
                <th class="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-center">Cheques</th>
                <th class="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-right">Ações</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-if="clientes.length === 0 && !loading">
                <td colspan="7" class="px-6 py-8 text-center text-slate-500">Nenhum cliente encontrado.</td>
              </tr>
              <tr 
                v-for="cliente in clientes" 
                :key="cliente.id" 
                class="group hover:bg-slate-50 transition-colors cursor-pointer"
                @click="abrirDetalhes(cliente.id)"
              >
                <td class="px-6 py-4">
                  <div class="flex items-start">
                    <div class="h-10 w-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg mr-3 flex-shrink-0">
                      {{ cliente.name ? cliente.name.charAt(0).toUpperCase() : '?' }}
                    </div>
                    
                    <div class="min-w-0">
                      <div class="font-bold text-slate-900 flex items-center gap-2">
                        <span class="truncate max-w-[180px] lg:max-w-[280px]" :title="cliente.name">
                          {{ cliente.name }}
                        </span>
                        
                        <span v-if="cliente.pendencia" class="flex-shrink-0 flex items-center gap-1 text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full uppercase font-bold tracking-wide animate-pulse">
                          <AlertTriangle class="w-3 h-3" /> Limite
                        </span>
                      </div>
                      
                      <div v-if="cliente.notes" class="mt-1 inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 max-w-full truncate" :title="cliente.notes">
                        <AlertCircle class="w-3 h-3 flex-shrink-0" /> {{ cliente.notes }}
                      </div>
                    </div>
                  </div>
                </td>

                <td class="px-6 py-4 text-sm text-slate-600 font-mono">{{ cliente.document || '-' }}</td>
                <td class="px-6 py-4 text-sm text-slate-600">{{ maskPhone(cliente.phone) || '-' }}</td>
                
                <td class="px-6 py-4 text-center">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700">{{ (cliente.standard_rate || 4.0).toFixed(2) }}%</span>
                </td>

                <td class="px-6 py-4">
                  <div class="w-32">
                    <div class="flex justify-between text-xs mb-1">
                      <span class="font-bold text-slate-700">{{ formatMoney(cliente.valor_em_aberto) }}</span>
                      <span class="text-slate-400">{{ formatMoney(cliente.credit_limit) }}</span>
                    </div>
                    <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div class="h-1.5 rounded-full" :class="getLimitColor(cliente.valor_em_aberto, cliente.credit_limit)" :style="{ width: cliente.credit_limit > 0 ? Math.min((cliente.valor_em_aberto / cliente.credit_limit) * 100, 100) + '%' : '0%' }"></div>
                    </div>
                  </div>
                </td>

                <td class="px-6 py-4 text-center">
                  <div class="text-sm font-bold text-slate-700">
                    <span class="text-emerald-600">{{ cliente.cheques_ativos }}</span> 
                    <span class="text-slate-300">/</span> {{ cliente.cheques_totais }}
                  </div>
                </td>

                <td class="px-6 py-4 text-right">
                  <div class="flex justify-end gap-2">
                    <button @click.stop="abrirModal(cliente.id)" class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit2 class="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
          <span class="text-xs text-slate-500 font-bold">Página {{ currentPage }} de {{ totalPages }}</span>
          <div class="flex gap-2">
            <button @click="mudarPagina(currentPage - 1)" :disabled="currentPage === 1" class="px-3 py-1 bg-white border border-slate-300 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-50"><ArrowLeft class="w-4 h-4" /></button>
            <button @click="mudarPagina(currentPage + 1)" :disabled="currentPage === totalPages" class="px-3 py-1 bg-white border border-slate-300 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-50"><ArrowRight class="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" @click="showModal = false"></div>
      
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden animate-scale-in">
        
        <div class="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <div class="flex items-center gap-2">
            <div class="p-2 bg-indigo-100 rounded-lg text-indigo-600">
              <User class="w-5 h-5" />
            </div>
            <div>
              <h3 class="font-bold text-lg text-slate-800 leading-tight">{{ form.id ? 'Editar Cliente' : 'Novo Cliente' }}</h3>
              <p class="text-xs text-slate-500">Preencha os dados do cadastro</p>
            </div>
          </div>
          <button @click="showModal = false" class="text-slate-400 hover:text-slate-600 hover:bg-slate-200 p-2 rounded-full transition-colors">
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="p-6 space-y-5">
          
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Nome Completo</label>
            <div class="relative">
              <User class="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input v-model="form.name" class="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 transition-all placeholder:text-slate-400" placeholder="Ex: João da Silva" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">CPF / CNPJ</label>
              <div class="relative">
                <FileText class="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input v-model="form.document" class="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 transition-all placeholder:text-slate-400" placeholder="000.000.000-00" />
              </div>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Telefone</label>
              <div class="relative">
                <Phone class="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input :value="form.phone" @input="onPhoneInput" class="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 transition-all placeholder:text-slate-400" placeholder="(00) 00000-0000" />
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Limite (R$)</label>
              <div class="relative">
                <span class="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">R$</span>
                <input v-model="form.credit_limit" type="number" class="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 transition-all placeholder:text-slate-400" placeholder="0,00" />
              </div>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Taxa Padrão</label>
              <div class="relative">
                <input v-model="form.standard_rate" type="number" step="0.1" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 transition-all placeholder:text-slate-400" placeholder="4.0" />
                <span class="absolute right-4 top-2.5 text-slate-400 font-bold text-sm">%</span>
              </div>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Observações</label>
            <textarea v-model="form.notes" rows="3" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 transition-all resize-none placeholder:text-slate-400" placeholder="Anotações internas sobre o cliente..."></textarea>
          </div>
        </div>

        <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button @click="showModal = false" class="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors text-sm">Cancelar</button>
          <button @click="salvarCliente" :disabled="saving" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-200 flex items-center transition-all active:scale-95 text-sm">
            <Loader2 v-if="saving" class="w-4 h-4 mr-2 animate-spin" />
            {{ saving ? 'Salvando...' : 'Salvar Cliente' }}
          </button>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="isPrinting" class="print-overlay">
        <div class="print-paper">
          <h1 class="text-2xl font-bold mb-4">Relatório de Clientes</h1>
          <table class="w-full text-left text-sm border-collapse">
            <thead>
              <tr class="border-b border-black"><th class="py-2">Cliente</th><th class="py-2 text-right">Limite</th><th class="py-2 text-right">Em Aberto</th></tr>
            </thead>
            <tbody>
              <tr v-for="c in clientes" :key="c.id" class="border-b border-gray-200">
                <td class="py-2">{{ c.name }}</td><td class="py-2 text-right">{{ formatMoney(c.credit_limit) }}</td><td class="py-2 text-right">{{ formatMoney(c.valor_em_aberto) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Teleport>
  </DashboardLayout>
</template>

<style scoped>
.animate-scale-in { animation: scaleIn 0.2s ease-out; }
@keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }

@media print {
  #app { display: none !important; }
  body { background: white !important; }
  .print-overlay { display: block !important; position: absolute; top: 0; left: 0; width: 100%; z-index: 9999; }
  .print-paper { padding: 15mm; background: white; }
}
</style>