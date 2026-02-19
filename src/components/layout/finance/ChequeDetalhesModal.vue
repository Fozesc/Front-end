<script setup>
import { X, Calendar, User, CreditCard, FileText, Activity, Clock, CheckCircle, History, ArrowRight } from 'lucide-vue-next';

const props = defineProps({
  cheque: Object,
  isOpen: Boolean
});

const emit = defineEmits(['close']);

const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
const formatDate = (val) => val ? val.split('-').reverse().join('/') : '-';
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[70] flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="$emit('close')"></div>
    
    <div class="bg-white w-full max-w-2xl rounded-2xl shadow-2xl relative z-10 overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">
      
      <div class="bg-slate-900 p-6 flex justify-between items-start flex-shrink-0">
        <div>
          <h2 class="text-white text-xl font-bold flex items-center gap-2">
            <CreditCard class="w-6 h-6 text-emerald-400" /> Detalhes do Título
          </h2>
          <p class="text-slate-400 text-sm mt-1">
            <span v-if="cheque.type" class="uppercase font-bold text-indigo-400 mr-2">{{ cheque.type }}</span>
            ID: #{{ cheque.id }} | Op: #{{ cheque.operation_id }}
          </p>
        </div>
        <button @click="$emit('close')" class="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors">
          <X class="w-6 h-6" />
        </button>
      </div>

      <div class="p-6 space-y-6 overflow-y-auto">
        
        <div class="bg-slate-50 rounded-xl border border-slate-200 p-4">
          <div class="text-center mb-4">
            <span class="text-xs font-bold text-slate-400 uppercase tracking-widest">Valor de Face</span>
            <div class="text-3xl font-extrabold text-slate-800 mt-1">{{ formatMoney(cheque.valor_bruto) }}</div>
          </div>
          <div class="grid grid-cols-2 gap-4 border-t border-slate-200 pt-4">
            <div class="text-center">
              <span class="text-[10px] font-bold text-red-500 uppercase">(-) Custos Iniciais</span>
              <div class="text-lg font-bold text-red-600">{{ formatMoney(cheque.juros) }}</div>
            </div>
            <div class="text-center border-l border-slate-200">
              <span class="text-[10px] font-bold text-emerald-600 uppercase">(=) Líquido Original</span>
              <div class="text-lg font-bold text-emerald-600">{{ formatMoney(cheque.valor_liquido) }}</div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1">
            <label class="text-xs font-bold text-slate-400 uppercase flex items-center gap-1"><User class="w-3 h-3" /> Cliente</label>
            <div class="font-medium text-slate-800 truncate" :title="cheque.cliente">{{ cheque.cliente }}</div>
          </div>
          <div class="space-y-1">
            <label class="text-xs font-bold text-slate-400 uppercase flex items-center gap-1"><FileText class="w-3 h-3" /> Emitente</label>
            <div class="font-medium text-slate-800 truncate" :title="cheque.emitente">{{ cheque.emitente || 'Mesmo do Cliente' }}</div>
          </div>
          
          <div class="space-y-1 pt-2">
            <label class="text-xs font-bold text-slate-400 uppercase flex items-center gap-1"><Clock class="w-3 h-3" /> Entrada</label>
            <div class="font-medium text-slate-700">{{ formatDate(cheque.data_entrada) }}</div>
          </div>

          <div class="space-y-1 pt-2">
            <label class="text-xs font-bold text-slate-400 uppercase flex items-center gap-1"><Calendar class="w-3 h-3" /> Vencimento Atual</label>
            <div class="font-bold text-xl text-indigo-700">{{ formatDate(cheque.vencimento) }}</div>
            <div v-if="cheque.vencimento_original && cheque.vencimento_original !== cheque.vencimento" class="text-xs text-slate-400 line-through">
              Original: {{ formatDate(cheque.vencimento_original) }}
            </div>
          </div>
        </div>

        <div class="pt-2 flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
           <div>
             <label class="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 mb-1"><Activity class="w-3 h-3" /> Status</label>
             <div class="inline-block px-3 py-1 rounded-md text-sm font-bold bg-white text-slate-700 border border-slate-200 shadow-sm">
                {{ cheque.status }}
             </div>
           </div>
           <div v-if="cheque.data_pagamento" class="text-right">
             <label class="text-[10px] font-bold text-emerald-600 uppercase flex items-center justify-end gap-1 mb-1"><CheckCircle class="w-3 h-3" /> Pago em</label>
             <div class="font-bold text-emerald-700">{{ formatDate(cheque.data_pagamento) }}</div>
             <div v-if="cheque.valor_pago > 0" class="text-xs text-emerald-600 font-bold">
               Recebido: {{ formatMoney(cheque.valor_pago) }}
             </div>
           </div>
        </div>

        <div v-if="cheque.historico_prorrogacao && cheque.historico_prorrogacao.length > 0" class="mt-6 border-t-2 border-dashed border-slate-200 pt-4">
          <h3 class="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
            <History class="w-4 h-4 text-indigo-500" /> Histórico de Prorrogações
          </h3>
          <div class="overflow-x-auto rounded-lg border border-slate-200">
            <table class="w-full text-xs text-left">
              <thead class="bg-slate-50 text-slate-500 font-bold uppercase">
                <tr>
                  <th class="px-3 py-2">Data Negoc.</th>
                  <th class="px-3 py-2">De</th>
                  <th class="px-3 py-2"></th>
                  <th class="px-3 py-2">Para</th>
                  <th class="px-3 py-2 text-right">Dias</th>
                  <th class="px-3 py-2 text-right">Taxa</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="hist in cheque.historico_prorrogacao" :key="hist.id">
                  <td class="px-3 py-2 text-slate-600">{{ formatDate(hist.data_simulacao) }}</td>
                  <td class="px-3 py-2 font-mono text-slate-500">{{ formatDate(hist.de) }}</td>
                  <td class="px-1 py-2 text-slate-300"><ArrowRight class="w-3 h-3" /></td>
                  <td class="px-3 py-2 font-bold text-indigo-700">{{ formatDate(hist.para) }}</td>
                  <td class="px-3 py-2 text-right font-bold text-slate-600">+{{ hist.dias }}</td>
                  <td class="px-3 py-2 text-right font-bold text-red-600">{{ formatMoney(hist.taxa) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
      
      <div class="bg-slate-50 p-4 flex justify-end flex-shrink-0 border-t border-slate-200">
        <button @click="$emit('close')" class="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition-colors">Fechar</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-scale-in { animation: scaleIn 0.2s ease-out; }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
</style>