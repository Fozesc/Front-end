<script setup>
import { X, Calendar, Wallet, FileText, Tag, ArrowUpCircle, ArrowDownCircle } from 'lucide-vue-next';

const props = defineProps({
  lancamento: { type: Object, required: true }
});

const emit = defineEmits(['close']);

const formatMoney = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const formatDate = (d) => d ? d.split('-').reverse().join('/') : '-';
</script>

<template>
  <div class="fixed inset-0 z-[60] flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="$emit('close')"></div>
    
    <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
      <div class="bg-white px-6 py-4 border-b border-slate-200 flex justify-between items-center">
        <h2 class="text-base font-semibold text-slate-900 flex items-center gap-2">
          <FileText class="w-5 h-5 text-indigo-600" /> Detalhes do Lançamento
        </h2>
        <button @click="$emit('close')" class="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-lg transition-colors">
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="p-6 space-y-6">
        
        <div class="text-center p-4 rounded-xl border-2" 
             :class="lancamento.tipo === 'entrada' ? 'border-emerald-100 bg-emerald-50' : 'border-red-100 bg-red-50'">
          <span class="text-xs font-semibold block mb-1" 
                :class="lancamento.tipo === 'entrada' ? 'text-emerald-600' : 'text-red-600'">
            {{ lancamento.tipo === 'entrada' ? 'Entrada Confirmada' : 'Saída Confirmada' }}
          </span>
          <div class="text-3xl font-bold" 
               :class="lancamento.tipo === 'entrada' ? 'text-emerald-700' : 'text-red-700'">
            {{ formatMoney(lancamento.valor) }}
          </div>
        </div>

        <div class="space-y-4">
          
          <div class="flex items-start gap-3">
            <div class="bg-slate-50 ring-1 ring-inset ring-slate-200 p-2 rounded-lg"><FileText class="w-5 h-5 text-slate-500" /></div>
            <div>
              <p class="text-xs font-medium text-slate-500">Descrição / Histórico</p>
              <p class="text-sm font-semibold text-slate-800">{{ lancamento.descricao }}</p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="flex items-start gap-3">
              <div class="bg-slate-50 ring-1 ring-inset ring-slate-200 p-2 rounded-lg"><Calendar class="w-5 h-5 text-slate-500" /></div>
              <div>
                <p class="text-xs font-medium text-slate-500">Data</p>
                <p class="text-sm font-semibold text-slate-800">{{ formatDate(lancamento.data) }}</p>
              </div>
            </div>

            <div class="flex items-start gap-3">
              <div class="bg-slate-50 ring-1 ring-inset ring-slate-200 p-2 rounded-lg"><Wallet class="w-5 h-5 text-slate-500" /></div>
              <div>
                <p class="text-xs font-medium text-slate-500">Conta Origem</p>
                <p class="text-sm font-semibold text-slate-800">{{ lancamento.origem }}</p>
              </div>
            </div>
          </div>

          <div class="flex items-start gap-3">
            <div class="bg-slate-50 ring-1 ring-inset ring-slate-200 p-2 rounded-lg"><Tag class="w-5 h-5 text-slate-500" /></div>
            <div>
              <p class="text-xs font-medium text-slate-500">Categoria</p>
              <p class="text-sm font-semibold text-slate-800">{{ lancamento.category || 'Geral' }}</p>
            </div>
          </div>

        </div>
      </div>

      <div class="bg-slate-50/70 px-6 py-4 flex justify-end border-t border-slate-200">
        <button @click="$emit('close')" class="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg font-semibold shadow-xs text-sm">
          Fechar
        </button>
      </div>
    </div>
  </div>
</template>