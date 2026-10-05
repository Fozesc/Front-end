<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import DashboardLayout from '../layouts/DashboardLayout.vue';
import { 
  ArrowLeft, Printer, CreditCard, AlertTriangle, 
  FileText, CheckCircle, Clock, Check, ChevronDown, ChevronUp, Loader2, MapPin // Adicionei MapPin aqui
} from 'lucide-vue-next';

// --- SERVIÇOS ---
import clientService from '../services/clientService';
import operationService from '../services/operationService';
import checkService from '../services/checkService';

const route = useRoute();
const router = useRouter();
const isPrinting = ref(false);
const loading = ref(true);

const openStatusMenuId = ref(null); 
const expandedOps = ref([]); 

const statusOptions = ['Aguardando', 'Pago', 'Devolvido', 'Atrasado', 'Juridico'];

const cliente = ref({
  id: null,
  nome: 'Carregando...',
  documento: '',
  telefone: '',
  limite: 0,
  taxa: 0,
  obs: '',
  endereco: '',
  // --- ADICIONEI PARA TER CERTEZA QUE NÃO VAI DAR UNDEFINED ---
  bairro: '',
  cidade: '',
  estado: '',
  cep: ''
});

const operacoesDoCliente = ref([]); 


const carregarTudo = async () => {
  loading.value = true;
  const idCliente = Number(route.params.id);
  const hoje = new Date().toISOString().split('T')[0];

  try {
    const [dadosCliente, opsDoCliente] = await Promise.all([
      clientService.getById(idCliente),
      operationService.getByClient(idCliente)
    ]);

    const listaOps = Array.isArray(opsDoCliente) ? opsDoCliente : [];

    
    if (dadosCliente) {
      cliente.value = {
        id: dadosCliente.id,
        nome: dadosCliente.name || 'Sem Nome',
        documento: dadosCliente.document || '-',
        telefone: dadosCliente.phone || '-',
        limite: Number(dadosCliente.credit_limit || 0),
        taxa: Number(dadosCliente.standard_rate || 4.00),
        obs: dadosCliente.notes || '',
        // --- MAPEAMENTO DOS NOVOS CAMPOS DE ENDEREÇO ---
        endereco: dadosCliente.address || '',
        bairro: dadosCliente.neighborhood || '',
        cidade: dadosCliente.city || '',
        estado: dadosCliente.state || '',
        cep: dadosCliente.zip_code || ''
      };
    }

   
    operacoesDoCliente.value = listaOps.map(op => {
      const listaCheques = Array.isArray(op.cheques) ? op.cheques : [];

      const chequesFormatados = listaCheques.map(c => ({
        id: c.id,
        vencimento: c.due_date,
        valor: Number(c.amount || 0),
        status: c.status || 'Aguardando',
        banco: c.bank || 'Manual',
        num_doc: c.number || 'S/N',
        emitente: c.issuer_name || 'Titular',
  
        isAtrasado: (c.status === 'Atrasado') || (c.status === 'Aguardando' && c.due_date < hoje)
      }));

      const totalOp = chequesFormatados.reduce((sum, c) => sum + c.valor, 0);
      const todosPagos = chequesFormatados.length > 0 && chequesFormatados.every(c => ['Pago', 'Compensado'].includes(c.status));
      const temAtraso = chequesFormatados.some(c => c.isAtrasado);

      return {
        id: op.id,
        data: op.date, 
        total: totalOp,
        statusGeral: todosPagos ? 'Concluída' : 'Em Aberto',
        temAtraso: temAtraso,
        cheques: chequesFormatados
      };
    });

    if (operacoesDoCliente.value.length > 0) {
      expandedOps.value.push(operacoesDoCliente.value[0].id);
    }

  } catch (error) {
    console.error("Erro ao carregar ficha:", error);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  carregarTudo();
  document.addEventListener('click', closeStatusMenu);
});


const toggleOp = (id) => {
  if (expandedOps.value.includes(id)) expandedOps.value = expandedOps.value.filter(opId => opId !== id); 
  else expandedOps.value.push(id); 
};

const toggleStatusMenu = (id, event) => {
  event.stopPropagation();
  openStatusMenuId.value = openStatusMenuId.value === id ? null : id;
};

const closeStatusMenu = () => {
  openStatusMenuId.value = null;
};

const alterarStatus = async (cheque, novoStatus, operacaoPai) => {
  try {
    await checkService.updateStatus(cheque.id, novoStatus);
    cheque.status = novoStatus; 
    
    const hoje = new Date().toISOString().split('T')[0];
    cheque.isAtrasado = (novoStatus === 'Atrasado') || (novoStatus === 'Aguardando' && cheque.vencimento < hoje);

    const todosPagos = operacaoPai.cheques.every(c => ['Pago', 'Compensado'].includes(c.status));
    operacaoPai.statusGeral = todosPagos ? 'Concluída' : 'Em Aberto';
    operacaoPai.temAtraso = operacaoPai.cheques.some(c => c.isAtrasado);

    openStatusMenuId.value = null;
  } catch (error) {
    alert("Erro ao atualizar status.");
  }
};


const totalEmAbertoGlobal = computed(() => {
  let total = 0;
  if (!operacoesDoCliente.value) return 0;
  operacoesDoCliente.value.forEach(op => {
    if (op.cheques) {
      op.cheques.forEach(c => {
        if (['Aguardando', 'Atrasado', 'Aberto'].includes(c.status)) {
          total += c.valor;
        }
      });
    }
  });
  return total;
});

const totalDevolvido = computed(() => {
  let total = 0;
  if (!operacoesDoCliente.value) return 0;
  operacoesDoCliente.value.forEach(op => {
    if (op.cheques) {
      op.cheques.forEach(c => {
        if (c.status === 'Devolvido') total += c.valor;
      });
    }
  });
  return total;
});

// Computed para formatar o endereço completo em uma linha (se existir)
const enderecoCompleto = computed(() => {
  const c = cliente.value;
  if (!c.endereco && !c.cidade) return '-';
  
  let end = c.endereco || '';
  if (c.bairro) end += `, ${c.bairro}`;
  if (c.cidade) end += ` - ${c.cidade}`;
  if (c.estado) end += `/${c.estado}`;
  if (c.cep) end += ` (CEP: ${c.cep})`;
  
  return end || '-';
});


const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
const formatDate = (iso) => {
  if (!iso) return '-';
  try { return iso.split('-').reverse().join('/'); } catch (e) { return iso; }
};

const getStatusColor = (s, isAtrasado) => {
  if (s === 'Juridico') return 'bg-purple-50 text-purple-700 border-purple-200';
  
  if (isAtrasado) return 'bg-red-50 text-red-700 border-red-200';
  
  switch(s) {
    case 'Pago': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Devolvido': return 'bg-orange-50 text-orange-700 border-orange-200';
    default: return 'bg-blue-50 text-blue-700 border-blue-200';
  }
};

const exportarFicha = () => {
  isPrinting.value = true;
  setTimeout(() => { window.print(); isPrinting.value = false; }, 300);
};
</script>

<template>
  <DashboardLayout>
    <div class="print:hidden">
      
      <div class="flex justify-between items-center mb-6">
        <div class="flex items-center gap-3">
          <button @click="router.back()" class="w-9 h-9 flex items-center justify-center bg-white border border-slate-200 shadow-xs hover:bg-slate-50 rounded-lg text-slate-500 transition-colors">
            <ArrowLeft class="w-[18px] h-[18px]" />
          </button>
          <div>
            <h1 class="text-2xl font-semibold text-slate-900 tracking-tight">{{ cliente.nome }}</h1>
            <p class="text-slate-500 text-sm mt-0.5">Ficha cadastral e operacional</p>
          </div>
        </div>
        <button @click="exportarFicha" class="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 h-9 px-3.5 rounded-lg text-sm font-semibold shadow-xs flex items-center transition-colors">
          <Printer class="w-4 h-4 mr-2 text-slate-500" /> Imprimir ficha
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200/80">
          <div class="flex items-center gap-2.5 mb-4 text-sm font-semibold text-slate-900">
            <span class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100 flex items-center justify-center"><FileText class="w-4 h-4" /></span> Dados cadastrais
          </div>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between"><span class="text-slate-500">Documento</span> <span class="font-medium text-slate-900 tabular-nums">{{ cliente.documento }}</span></div>
            <div class="flex justify-between"><span class="text-slate-500">Telefone</span> <span class="text-slate-900">{{ cliente.telefone }}</span></div>
            <div class="flex justify-between"><span class="text-slate-500">Taxa</span> <span class="font-semibold text-indigo-600">{{ cliente.taxa }}%</span></div>
            
            <div class="pt-2 mt-2 border-t border-slate-100">
              <div class="text-slate-500 text-xs mb-1 flex items-center gap-1"><MapPin class="w-3 h-3"/> Endereço</div>
              <div class="text-slate-800 leading-tight text-xs">{{ enderecoCompleto }}</div>
            </div>
            
            <div class="pt-2 mt-2 border-t border-slate-100">
              <div class="text-slate-500 text-xs mb-1">Observações</div>
              <div class="text-slate-800 leading-tight text-xs italic">{{ cliente.obs || '-' }}</div>
            </div>
            </div>
        </div>

        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200/80">
          <div class="flex items-center gap-2.5 mb-4 text-sm font-semibold text-slate-900">
            <span class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100 flex items-center justify-center"><CreditCard class="w-4 h-4" /></span> Limite e crédito
          </div>
          <div class="mb-2">
            <span class="text-2xl font-semibold tracking-tight text-slate-900">{{ formatMoney(cliente.limite) }}</span>
            <span class="text-xs text-slate-400 ml-2">Limite</span>
          </div>
          <div class="w-full bg-slate-100 h-2.5 rounded-full mb-3 overflow-hidden">
            <div class="bg-emerald-500 h-2.5 rounded-full transition-all duration-500" 
                 :class="{'bg-red-500': cliente.limite > 0 && (totalEmAbertoGlobal/cliente.limite) > 0.9}"
                 :style="{ width: cliente.limite > 0 ? Math.min((totalEmAbertoGlobal / cliente.limite) * 100, 100) + '%' : '0%' }">
            </div>
          </div>
          <div class="flex justify-between text-xs font-medium border-t border-slate-100 pt-2.5">
            <span class="text-slate-500">Utilizado: {{ formatMoney(totalEmAbertoGlobal) }}</span>
            <span class="text-emerald-600">Disp: {{ formatMoney(cliente.limite - totalEmAbertoGlobal) }}</span>
          </div>
        </div>

        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200/80">
          <div class="flex items-center gap-2.5 mb-4 text-sm font-semibold text-slate-900">
            <span class="w-8 h-8 rounded-lg bg-red-50 text-red-600 ring-1 ring-inset ring-red-100 flex items-center justify-center"><AlertTriangle class="w-4 h-4" /></span> Pendências
          </div>
          <div v-if="totalDevolvido > 0" class="p-3 bg-red-50 rounded-lg border border-red-100 text-center">
            <div class="text-red-600 font-semibold tracking-tight text-xl">{{ formatMoney(totalDevolvido) }}</div>
            <div class="text-xs text-red-500">em devolvidos</div>
          </div>
          <div v-else class="text-emerald-700 text-sm font-medium bg-emerald-50 border border-emerald-100 rounded-lg p-3 flex items-center gap-2">
            <CheckCircle class="w-5 h-5" /> Nenhuma pendência
          </div>
        </div>
      </div>

      <div class="space-y-4">
        <h3 class="font-semibold text-slate-900 text-base">Histórico de operações</h3>

        <div v-if="loading" class="text-center py-10 text-slate-400 flex flex-col items-center">
          <Loader2 class="w-8 h-8 animate-spin mb-2 text-indigo-500" />
          Carregando dados...
        </div>

        <div v-else-if="operacoesDoCliente.length === 0" class="text-center py-10 bg-white rounded-xl border border-dashed border-slate-300 text-slate-400 text-sm">
          Nenhuma operação registrada para este cliente.
        </div>

        <div v-for="op in operacoesDoCliente" :key="op.id" class="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-visible transition-all duration-300">
          
          <div @click="toggleOp(op.id)" class="px-5 py-4 flex items-center justify-between cursor-pointer rounded-xl hover:bg-slate-50/70 transition-colors">
            
            <div class="flex items-center gap-4">
              <div class="p-2 rounded-lg" :class="op.statusGeral === 'Concluída' ? 'bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100' : (op.temAtraso ? 'bg-red-50 text-red-600 ring-1 ring-inset ring-red-100' : 'bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100')">
                <FileText class="w-5 h-5" />
              </div>
              <div>
                <h4 class="font-semibold text-slate-900">Operação #{{ op.id }}</h4>
                <div class="text-xs text-slate-500 flex gap-2">
                  <span class="flex items-center gap-1"><Clock class="w-3 h-3" /> {{ formatDate(op.data) }}</span>
                  <span>•</span>
                  <span>{{ op.cheques ? op.cheques.length : 0 }} Cheques</span>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-4">
              <div class="text-right mr-2">
                <div class="text-xs text-slate-500">Total da operação</div>
                <div class="font-semibold text-slate-900 tabular-nums">{{ formatMoney(op.total) }}</div>
              </div>
              
              <div v-if="op.temAtraso && op.statusGeral !== 'Concluída'" class="px-2 py-0.5 rounded-md text-xs font-medium border bg-red-50 text-red-700 border-red-200 flex items-center gap-1">
                <AlertTriangle class="w-3 h-3" /> Atraso
              </div>

              <div class="px-2 py-0.5 rounded-md text-xs font-medium border" 
                   :class="op.statusGeral === 'Concluída' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'">
                {{ op.statusGeral }}
              </div>

              <div class="text-slate-400">
                <ChevronUp v-if="expandedOps.includes(op.id)" class="w-5 h-5" />
                <ChevronDown v-else class="w-5 h-5" />
              </div>
            </div>
          </div>

          <div v-if="expandedOps.includes(op.id)" class="border-t border-slate-100 bg-slate-50/60 p-4 animate-fade-in-down">
            <table class="w-full text-left text-sm bg-white rounded-lg shadow-xs overflow-visible border border-slate-200">
              <thead class="bg-slate-50 text-slate-500 text-xs font-medium border-b border-slate-200">
                <tr>
                  <th class="px-4 py-2">Vencimento</th>
                  <th class="px-4 py-2">Banco / Doc</th>
                  <th class="px-4 py-2">Emitente</th>
                  <th class="px-4 py-2 text-right">Valor</th>
                  <th class="px-4 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="cheque in op.cheques" :key="cheque.id" class="hover:bg-slate-50 transition-colors">
                  <td class="px-4 py-3 tabular-nums" :class="cheque.isAtrasado ? 'text-red-600 font-semibold' : 'text-slate-600'">
                    {{ formatDate(cheque.vencimento) }}
                    <span v-if="cheque.isAtrasado" class="text-[10px] ml-1">(!)</span>
                  </td>
                  <td class="px-4 py-3 text-slate-600">{{ cheque.banco }} - {{ cheque.num_doc }}</td>
                  <td class="px-4 py-3 text-slate-900 font-medium">{{ cheque.emitente }}</td>
                  <td class="px-4 py-3 text-right font-semibold text-slate-900 tabular-nums">{{ formatMoney(cheque.valor) }}</td>
                  
                  <td class="px-4 py-3 text-center relative">
                    <button 
                      @click="toggleStatusMenu(cheque.id, $event)"
                      :class="['pl-2 pr-1.5 py-0.5 rounded-md text-xs font-medium border flex items-center gap-1.5 mx-auto transition-all w-fit before:w-1.5 before:h-1.5 before:rounded-full before:bg-current before:opacity-80', getStatusColor(cheque.status, cheque.isAtrasado)]"
                    >
                      {{ cheque.isAtrasado ? 'Atrasado' : cheque.status }} <ChevronDown class="w-3 h-3 opacity-50" />
                    </button>

                    <div v-if="openStatusMenuId === cheque.id" class="absolute right-0 mt-1.5 w-36 bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden text-left animate-scale-in p-1">
                      <div v-for="opt in statusOptions" :key="opt" 
                           @click.stop="alterarStatus(cheque, opt, op)"
                           class="px-2.5 py-1.5 text-[13px] font-medium rounded-md hover:bg-slate-100 cursor-pointer text-slate-700 flex justify-between items-center">
                        {{ opt }}
                        <Check v-if="cheque.status === opt" class="w-3 h-3 text-emerald-500" />
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="isPrinting" class="print-overlay">
        <div class="print-paper">
          <div class="text-center border-b-2 border-black pb-4 mb-6">
            <h1 class="text-2xl font-bold uppercase">Extrato de Cliente</h1>
            <p class="text-lg">{{ cliente.nome }}</p>
            <p v-if="cliente.endereco" class="text-sm mt-1">{{ enderecoCompleto }}</p>
          </div>
          
          <div class="grid grid-cols-3 gap-4 mb-6 text-sm border-b border-black pb-4">
            <div><strong>Limite:</strong> {{ formatMoney(cliente.limite) }}</div>
            <div><strong>Em Aberto:</strong> {{ formatMoney(totalEmAbertoGlobal) }}</div>
            <div><strong>Disponível:</strong> {{ formatMoney(cliente.limite - totalEmAbertoGlobal) }}</div>
          </div>

          <div v-for="op in operacoesDoCliente" :key="op.id" class="mb-6 break-inside-avoid">
            <div class="bg-gray-100 p-2 font-bold text-sm flex justify-between">
              <span>OP #{{ op.id }} - {{ formatDate(op.data) }}</span>
              <span>Total: {{ formatMoney(op.total) }}</span>
            </div>
            <table class="w-full text-xs text-left border-collapse mt-2">
              <thead>
                <tr class="border-b border-gray-300">
                  <th class="py-1">Vencimento</th>
                  <th class="py-1">Banco</th>
                  <th class="py-1">Emitente</th>
                  <th class="py-1 text-right">Valor</th>
                  <th class="py-1 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in op.cheques" :key="c.id" class="border-b border-gray-100">
                  <td class="py-1">{{ formatDate(c.vencimento) }}</td>
                  <td class="py-1">{{ c.banco }}</td>
                  <td class="py-1">{{ c.emitente }}</td>
                  <td class="py-1 text-right">{{ formatMoney(c.valor) }}</td>
                  <td class="py-1 text-center">{{ c.status }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Teleport>
  </DashboardLayout>
</template>

<style scoped>
.animate-fade-in-down { animation: fadeInDown 0.3s ease-out forwards; }
.animate-scale-in { animation: scaleIn 0.15s ease-out forwards; }

@keyframes fadeInDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }

@media print {
  #app { display: none !important; }
  body { margin: 0 !important; background: white !important; }
  .print-overlay { display: block !important; position: absolute; top: 0; left: 0; width: 100%; background: white; z-index: 9999; }
  .print-paper { padding: 10mm; background: white; }
  .break-inside-avoid { page-break-inside: avoid; }
}
</style>