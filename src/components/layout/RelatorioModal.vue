<script setup>
import { ref } from 'vue';
import { X, FileText, Printer, Calendar } from 'lucide-vue-next';

const emit = defineEmits(['close']);
const isPrinting = ref(false);

const filtro = ref({
  tipo: 'geral', 
  inicio: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
  fim: new Date().toISOString().split('T')[0]
});

const gerarRelatorio = () => {
  isPrinting.value = true;
  setTimeout(() => {
    window.print();
    isPrinting.value = false;
  }, 300);
};


</script>

<template>
  <div class="fixed inset-0 z-[70] flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="$emit('close')"></div>
    
    <div v-if="!isPrinting" class="bg-white w-full max-w-md rounded-2xl shadow-2xl relative z-10 animate-scale-in overflow-hidden">
      <div class="bg-slate-900 p-5 flex justify-between items-center">
        <h2 class="text-white text-lg font-bold flex items-center gap-2"><FileText class="w-5 h-5 text-emerald-400" /> Gerar Relatório</h2>
        <button @click="$emit('close')" class="text-slate-400 hover:text-white"><X class="w-5 h-5" /></button>
      </div>
      
      <div class="p-6 space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de Relatório</label>
          <select v-model="filtro.tipo" class="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="geral">Resumo Geral (Fluxo)</option>
            <option value="inadimplencia">Relatório de Inadimplência</option>
            <option value="lucro">Demonstrativo de Lucros</option>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">De</label>
            <input v-model="filtro.inicio" type="date" class="w-full p-2 border border-slate-300 rounded-lg outline-none" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Até</label>
            <input v-model="filtro.fim" type="date" class="w-full p-2 border border-slate-300 rounded-lg outline-none" />
          </div>
        </div>
      </div>

      <div class="bg-slate-50 p-4 border-t border-slate-200 flex justify-end gap-2">
        <button @click="$emit('close')" class="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg transition-colors">Cancelar</button>
        <button @click="gerarRelatorio" class="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-md flex items-center transition-all">
          <Printer class="w-4 h-4 mr-2" /> Gerar PDF / Imprimir
        </button>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="isPrinting" class="print-overlay">
        <div class="print-paper">
          <div class="border-b-2 border-black pb-4 mb-6 flex justify-between items-end">
            <div>
              <h1 class="text-3xl font-bold uppercase tracking-widest">Relatório Gerencial</h1>
              <p class="text-sm text-gray-500 uppercase mt-1">Fozesc Management System</p>
            </div>
            <div class="text-right">
              <p class="text-sm font-bold">Período</p>
              <p class="text-sm">{{ filtro.inicio.split('-').reverse().join('/') }} a {{ filtro.fim.split('-').reverse().join('/') }}</p>
            </div>
          </div>

          <div class="mb-8">
            <h2 class="text-lg font-bold uppercase border-b border-gray-300 pb-1 mb-4">
              {{ filtro.tipo === 'geral' ? 'Resumo de Caixa e Operações' : filtro.tipo === 'inadimplencia' ? 'Relatório de Cheques em Atraso' : 'Demonstrativo de Resultados (Lucro)' }}
            </h2>
            
            <div class="space-y-2 text-sm">
              <div class="flex justify-between bg-gray-100 p-2 font-bold">
                <span>Descrição</span>
                <span>Valor</span>
              </div>
              <div class="flex justify-between p-2 border-b border-gray-200"><span>Saldo Anterior</span><span>R$ 1.000,00</span></div>
              <div class="flex justify-between p-2 border-b border-gray-200"><span>Entradas Totais</span><span class="text-emerald-700 font-bold">R$ 15.000,00</span></div>
              <div class="flex justify-between p-2 border-b border-gray-200"><span>Saídas Totais</span><span class="text-red-700 font-bold">- R$ 5.000,00</span></div>
              <div class="flex justify-between p-2 border-b border-gray-200 bg-gray-50 font-bold"><span>Resultado do Período</span><span>R$ 11.000,00</span></div>
            </div>

            <div class="mt-8 p-4 border border-dashed border-gray-400 text-center text-xs text-gray-500">
              Relatório gerado automaticamente em {{ new Date().toLocaleString() }}.<br>
              Este documento é para controle interno.
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.animate-scale-in { animation: scaleIn 0.2s ease-out; }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }

@media print {
  #app { display: none !important; }
  @page { margin: 0; size: auto; }
  body { margin: 0 !important; padding: 0 !important; background-color: white !important; }
  .print-overlay { display: block !important; position: absolute; top: 0; left: 0; width: 100%; min-height: 100vh; background: white; z-index: 999999; }
  .print-paper { padding: 15mm; background: white; }
}
</style>