<script setup>
import { ref, onMounted, reactive, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router'; 
import DashboardLayout from '../layouts/DashboardLayout.vue';
import { 
  Plus, Search, Printer, Edit2, 
  AlertTriangle, X, Loader2,
  ArrowLeft, ArrowRight, RotateCcw, User, FileText, Phone, Merge
} from 'lucide-vue-next';
import clientService from '../services/clientService';
import MesclarClienteModal from '../components/layout/finance/MesclarClienteModal.vue';

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
const clienteParaMesclar = ref(null);
const avisoMerge = ref('');
const saving = ref(false);

// --- ATUALIZADO: Campos de endereço adicionados ao form ---
const form = ref({
  id: null, 
  name: '', 
  document: '', 
  phone: '',
  credit_limit: 0, 
  standard_rate: 4.00, 
  notes: '',
  address: '',
  neighborhood: '',
  city: '',
  state: '',
  zip_code: ''
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
    // Garante que se o original não tiver endereço, os campos não fiquem undefined
    form.value = { 
      ...original,
      address: original.address || '',
      neighborhood: original.neighborhood || '',
      city: original.city || '',
      state: original.state || '',
      zip_code: original.zip_code || ''
    };
  } else {
    // ATUALIZADO: Reseta os novos campos ao abrir modal vazio
    form.value = { 
      id: null, 
      name: '', 
      document: '', 
      phone: '', 
      credit_limit: 0, 
      standard_rate: 4.00, 
      notes: '',
      address: '',
      neighborhood: '',
      city: '',
      state: '',
      zip_code: ''
    };
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
const aoMesclar = async (r) => {
  clienteParaMesclar.value = null;
  avisoMerge.value = `"${r.apagado}" foi juntado em "${r.mantido}": `
    + `${r.borderos} borderô(s) e ${r.cheques} cheque(s) transferidos.`;
  await fetchClientes();
  setTimeout(() => { avisoMerge.value = ''; }, 8000);
};

const exportarLista = async () => { isPrinting.value = true; await nextTick(); window.print(); isPrinting.value = false; };

// a marca que o import da planilha grava nas observacoes vira etiqueta, nao texto
const notasVisiveis = (n) => (n || '').replace(/\[IMPORT-PLANILHA\]\s*(Criado pela importacao da planilha historica)?\s*/, '').trim();
</script>

<template>
  <DashboardLayout>
    <div class="print:hidden">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 class="text-2xl font-semibold text-slate-900 tracking-tight">Clientes</h1>
          <div class="flex items-center gap-2 mt-1">
            <span class="text-slate-500 text-sm">Total de <span class="font-semibold text-slate-700">{{ totalItems }}</span> clientes</span>
            <span v-if="loading" class="text-xs text-indigo-600 font-medium ml-2 flex items-center">
              <Loader2 class="w-3 h-3 mr-1 animate-spin" /> Buscando...
            </span>
          </div>
        </div>
        <div class="flex gap-2.5">
          <button @click="exportarLista" class="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 h-9 px-3.5 rounded-lg text-sm font-semibold shadow-xs flex items-center transition-colors">
            <Printer class="w-4 h-4 mr-2 text-slate-500" /> Exportar
          </button>
          <button @click="abrirModal()" class="bg-indigo-600 hover:bg-indigo-700 text-white h-9 px-3.5 rounded-lg text-sm font-semibold shadow-xs ring-1 ring-inset ring-white/10 flex items-center transition-colors">
            <Plus class="w-4 h-4 mr-2" /> Novo cliente
          </button>
        </div>
      </div>

      <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200/80 mb-4 flex gap-3">
        <div class="relative flex-1">
          <Search class="w-[18px] h-[18px] absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            v-model="filters.search" 
            type="text" 
            placeholder="Buscar por nome, documento ou telefone..." 
            class="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg outline-none text-sm transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs"
          />
        </div>
        <button @click="resetFilters" class="w-10 flex items-center justify-center bg-white border border-slate-300 shadow-xs text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors" title="Limpar">
          <RotateCcw class="w-4 h-4" />
        </button>
      </div>

      <div v-if="avisoMerge" class="mb-4 bg-emerald-50 border border-emerald-200/80 text-emerald-800 rounded-xl px-4 py-3 text-sm font-medium flex items-center shadow-xs">
        <Merge class="w-4 h-4 mr-2 shrink-0" /> {{ avisoMerge }}
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col min-h-[400px]">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-[13px]">
            <thead class="bg-slate-50/80 border-b border-slate-200">
              <tr class="text-xs font-medium text-slate-500">
                <th class="px-3 py-2.5">Cliente</th>
                <th class="px-3 py-2.5 whitespace-nowrap">CPF / CNPJ</th>
                <th class="px-3 py-2.5">Telefone</th>
                <th class="px-3 py-2.5 text-right">Taxa</th>
                <th class="px-3 py-2.5 text-right whitespace-nowrap">Em aberto / Limite</th>
                <th class="px-3 py-2.5 text-center">Títulos</th>
                <th class="px-3 py-2.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-if="clientes.length === 0 && !loading">
                <td colspan="7" class="px-3 py-8 text-center text-slate-500">Nenhum cliente encontrado.</td>
              </tr>
              <tr 
                v-for="cliente in clientes" 
                :key="cliente.id" 
                class="group hover:bg-slate-50 transition-colors cursor-pointer"
                @click="abrirDetalhes(cliente.id)"
              >
                <td class="px-3 py-2.5">
                  <div class="font-semibold text-slate-900 flex items-center gap-2 min-w-0 max-w-[250px] 2xl:max-w-[360px]">
                    <span class="truncate min-w-0" :title="cliente.name">{{ cliente.name }}</span>
                    <span v-if="(cliente.notes || '').includes('[IMPORT-PLANILHA]')" class="flex-shrink-0 px-1.5 py-px rounded-md border border-slate-200 text-slate-500 text-[11px] font-medium">importado</span>
                    <span v-if="cliente.pendencia" class="flex-shrink-0 inline-flex items-center gap-1 text-[11px] border border-red-200 bg-red-50 text-red-700 px-1.5 py-px rounded-md font-medium">
                      <AlertTriangle class="w-3 h-3" /> acima do limite
                    </span>
                  </div>
                  <div v-if="notasVisiveis(cliente.notes)" class="text-xs text-slate-500 truncate max-w-[250px] 2xl:max-w-[360px]" :title="notasVisiveis(cliente.notes)">{{ notasVisiveis(cliente.notes) }}</div>
                </td>

                <td class="px-3 py-2.5 text-slate-600 tabular-nums whitespace-nowrap">{{ cliente.document || '—' }}</td>
                <td class="px-3 py-2.5 text-slate-600 tabular-nums whitespace-nowrap">{{ maskPhone(cliente.phone) || '—' }}</td>
                <td class="px-3 py-2.5 text-right text-slate-700 tabular-nums whitespace-nowrap">{{ (cliente.standard_rate || 4.0).toFixed(2).replace('.', ',') }}%</td>

                <td class="px-3 py-2.5">
                  <div class="w-44 ml-auto">
                    <div class="flex justify-between gap-2 text-xs tabular-nums whitespace-nowrap">
                      <span class="font-semibold" :class="cliente.pendencia ? 'text-red-700' : 'text-slate-800'">{{ formatMoney(cliente.valor_em_aberto) }}</span>
                      <span class="text-slate-400">{{ formatMoney(cliente.credit_limit) }}</span>
                    </div>
                    <div class="mt-1.5 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div class="h-1.5 rounded-full" :class="getLimitColor(cliente.valor_em_aberto, cliente.credit_limit)" :style="{ width: cliente.credit_limit > 0 ? Math.min((cliente.valor_em_aberto / cliente.credit_limit) * 100, 100) + '%' : '0%' }"></div>
                    </div>
                  </div>
                </td>

                <td class="px-3 py-2.5 text-center tabular-nums whitespace-nowrap" title="em aberto / total">
                  <span class="font-semibold text-slate-800">{{ cliente.cheques_ativos }}</span>
                  <span class="text-slate-400"> / {{ cliente.cheques_totais }}</span>
                </td>

                <td class="px-3 py-1.5 text-right">
                  <div class="flex justify-end gap-1">
                    <button @click.stop="abrirModal(cliente.id)" title="Editar cadastro" class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"><Edit2 class="w-4 h-4" /></button>
                    <button @click.stop="clienteParaMesclar = cliente" title="Juntar com outro cadastro do mesmo cliente" class="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"><Merge class="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="px-5 py-3 border-t border-slate-200 flex justify-between items-center">
          <span class="text-[13px] text-slate-500">Página <span class="font-semibold text-slate-700">{{ currentPage }}</span> de <span class="font-semibold text-slate-700">{{ totalPages }}</span></span>
          <div class="flex gap-2">
            <button @click="mudarPagina(currentPage - 1)" :disabled="currentPage === 1" class="h-8 w-8 flex items-center justify-center bg-white border border-slate-300 rounded-lg shadow-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:shadow-none"><ArrowLeft class="w-4 h-4" /></button>
            <button @click="mudarPagina(currentPage + 1)" :disabled="currentPage === totalPages" class="h-8 w-8 flex items-center justify-center bg-white border border-slate-300 rounded-lg shadow-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:shadow-none"><ArrowRight class="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" @click="showModal = false"></div>
      
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-xl relative z-10 overflow-hidden animate-scale-in max-h-[90vh] flex flex-col">
        
        <div class="px-6 py-4 border-b border-slate-200 flex justify-between items-center flex-shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 flex items-center justify-center bg-indigo-50 ring-1 ring-inset ring-indigo-100 rounded-lg text-indigo-600">
              <User class="w-5 h-5" />
            </div>
            <div>
              <h3 class="font-semibold text-base text-slate-900 leading-tight">{{ form.id ? 'Editar Cliente' : 'Novo Cliente' }}</h3>
              <p class="text-sm text-slate-500">Preencha os dados do cadastro</p>
            </div>
          </div>
          <button @click="showModal = false" class="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-lg transition-colors">
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="p-6 space-y-5 overflow-y-auto">
          
          <div>
            <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Nome Completo</label>
            <div class="relative">
              <User class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input v-model="form.name" class="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg outline-none font-medium text-slate-700 transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs" placeholder="Ex: João da Silva" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[13px] font-medium text-slate-700 mb-1.5">CPF / CNPJ</label>
              <div class="relative">
                <FileText class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input v-model="form.document" class="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg outline-none font-medium text-slate-700 transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs" placeholder="000.000.000-00" />
              </div>
            </div>
            <div>
              <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Telefone</label>
              <div class="relative">
                <Phone class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input :value="form.phone" @input="onPhoneInput" class="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg outline-none font-medium text-slate-700 transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs" placeholder="(00) 00000-0000" />
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Limite (R$)</label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">R$</span>
                <input v-model="form.credit_limit" type="number" class="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg outline-none font-bold text-slate-700 transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs" placeholder="0,00" />
              </div>
            </div>
            <div>
              <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Taxa Padrão</label>
              <div class="relative">
                <input v-model="form.standard_rate" type="number" step="0.1" class="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg outline-none font-bold text-slate-700 transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs" placeholder="4.0" />
                <span class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">%</span>
              </div>
            </div>
          </div>

          <div class="pt-2 border-t border-slate-100 mt-2">
            <h4 class="text-sm font-semibold text-slate-900 mb-3 pt-3">Endereço</h4>
            <div class="grid grid-cols-1 md:grid-cols-12 gap-3">
              
              <div class="md:col-span-4">
                <label class="block text-xs font-medium text-slate-600 mb-1.5">CEP</label>
                <input v-model="form.zip_code" type="text" placeholder="00000-000" class="w-full bg-white border border-slate-300 rounded-lg p-2.5 outline-none text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" />
              </div>

              <div class="md:col-span-8">
                <label class="block text-xs font-medium text-slate-600 mb-1.5">Logradouro (Rua, Av, N°)</label>
                <input v-model="form.address" type="text" placeholder="Ex: Av. Brasil, 123" class="w-full bg-white border border-slate-300 rounded-lg p-2.5 outline-none text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" />
              </div>

              <div class="md:col-span-5">
                <label class="block text-xs font-medium text-slate-600 mb-1.5">Bairro</label>
                <input v-model="form.neighborhood" type="text" placeholder="Centro" class="w-full bg-white border border-slate-300 rounded-lg p-2.5 outline-none text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" />
              </div>

              <div class="md:col-span-5">
                <label class="block text-xs font-medium text-slate-600 mb-1.5">Cidade</label>
                <input v-model="form.city" type="text" placeholder="Foz do Iguaçu" class="w-full bg-white border border-slate-300 rounded-lg p-2.5 outline-none text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" />
              </div>

              <div class="md:col-span-2">
                <label class="block text-xs font-medium text-slate-600 mb-1.5">UF</label>
                <input v-model="form.state" type="text" placeholder="PR" maxlength="2" class="w-full bg-white border border-slate-300 rounded-lg p-2.5 outline-none text-sm uppercase text-center focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" />
              </div>

            </div>
          </div>
          <div>
            <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Observações</label>
            <textarea v-model="form.notes" rows="3" class="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg outline-none font-medium text-slate-700 transition-all resize-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs" placeholder="Anotações internas sobre o cliente..."></textarea>
          </div>
        </div>

        <div class="px-6 py-4 bg-slate-50/70 border-t border-slate-200 flex justify-end gap-3 flex-shrink-0">
          <button @click="showModal = false" class="px-4 py-2.5 rounded-lg font-semibold text-slate-700 bg-white border border-slate-300 shadow-xs hover:bg-slate-50 transition-colors text-sm">Cancelar</button>
          <button @click="salvarCliente" :disabled="saving" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-semibold shadow-xs ring-1 ring-inset ring-white/10 flex items-center transition-all active:scale-[0.98] text-sm">
            <Loader2 v-if="saving" class="w-4 h-4 mr-2 animate-spin" />
            {{ saving ? 'Salvando...' : 'Salvar cliente' }}
          </button>
        </div>
      </div>
    </div>

    <MesclarClienteModal v-if="clienteParaMesclar" :cliente="clienteParaMesclar"
                         @close="clienteParaMesclar = null" @merged="aoMesclar" />

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