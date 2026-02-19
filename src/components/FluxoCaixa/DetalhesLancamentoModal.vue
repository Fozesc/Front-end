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
      <div class="bg-slate-900 px-6 py-4 flex justify-between items-center">
        <h2 class="text-lg font-bold text-white flex items-center gap-2">
          <FileText class="w-5 h-5 text-indigo-400" /> Detalhes do Lançamento
        </h2>
        <button @click="$emit('close')" class="text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors">
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="p-6 space-y-6">
        
        <div class="text-center p-4 rounded-xl border-2" 
             :class="lancamento.tipo === 'entrada' ? 'border-emerald-100 bg-emerald-50' : 'border-red-100 bg-red-50'">
          <span class="text-xs font-bold uppercase tracking-wider block mb-1" 
                :class="lancamento.tipo === 'entrada' ? 'text-emerald-600' : 'text-red-600'">
            {{ lancamento.tipo === 'entrada' ? 'Entrada Confirmada' : 'Saída Confirmada' }}
          </span>
          <div class="text-3xl font-black" 
               :class="lancamento.tipo === 'entrada' ? 'text-emerald-700' : 'text-red-700'">
            {{ formatMoney(lancamento.valor) }}
          </div>
        </div>

        <div class="space-y-4">
          
          <div class="flex items-start gap-3">
            <div class="bg-slate-100 p-2 rounded-lg"><FileText class="w-5 h-5 text-slate-500" /></div>
            <div>
              <p class="text-xs text-slate-400 font-bold uppercase">Descrição / Histórico</p>
              <p class="text-sm font-semibold text-slate-800">{{ lancamento.descricao }}</p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="flex items-start gap-3">
              <div class="bg-slate-100 p-2 rounded-lg"><Calendar class="w-5 h-5 text-slate-500" /></div>
              <div>
                <p class="text-xs text-slate-400 font-bold uppercase">Data</p>
                <p class="text-sm font-semibold text-slate-800">{{ formatDate(lancamento.data) }}</p>
              </div>
            </div>

            <div class="flex items-start gap-3">
              <div class="bg-slate-100 p-2 rounded-lg"><Wallet class="w-5 h-5 text-slate-500" /></div>
              <div>
                <p class="text-xs text-slate-400 font-bold uppercase">Conta Origem</p>
                <p class="text-sm font-semibold text-slate-800">{{ lancamento.origem }}</p>
              </div>
            </div>
          </div>

          <div class="flex items-start gap-3">
            <div class="bg-slate-100 p-2 rounded-lg"><Tag class="w-5 h-5 text-slate-500" /></div>
            <div>
              <p class="text-xs text-slate-400 font-bold uppercase">Categoria</p>
              <p class="text-sm font-semibold text-slate-800">{{ lancamento.category || 'Geral' }}</p>
            </div>
          </div>

        </div>
      </div>

      <div class="bg-slate-50 px-6 py-4 flex justify-end border-t border-slate-200">
        <button @click="$emit('close')" class="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2 rounded-lg font-bold shadow-lg transition-transform active:scale-95">
          Fechar
        </button>
      </div>
    </div>
  </div>
</template>