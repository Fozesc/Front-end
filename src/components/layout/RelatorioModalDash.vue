<script setup>
import { ref, watch } from 'vue';
import { X, FileText, Download, Loader2, Calendar, CheckCircle2, Circle, Archive, Database } from 'lucide-vue-next';
import api from '../../services/api';

const emit = defineEmits(['close']);
const loading = ref(false);
const exportarTudo = ref(false);

const form = ref({
  type: 'geral', 
  start_date: '',
  end_date: ''
});

watch(exportarTudo, (novoValor) => {
  if (novoValor) {
    form.value.start_date = '';
    form.value.end_date = '';
  }
});

const gerarRelatorio = async () => {
  loading.value = true;
  try {
    const response = await api.post('/reports/export', form.value, {
      responseType: 'blob' 
    });

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    
    const timestamp = new Date().toISOString().slice(0,10);
    link.setAttribute('download', `relatorio_${form.value.type}_${timestamp}.xlsx`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    emit('close');
  } catch (error) {
    alert("Erro ao gerar relatório. Verifique se existem dados no período.");
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="$emit('close')"></div>
    
    <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
      <div class="bg-slate-900 px-6 py-4 flex justify-between items-center">
        <h2 class="text-lg font-bold text-white flex items-center gap-2">
          <FileText class="w-5 h-5 text-indigo-400" /> Exportar Dados
        </h2>
        <button @click="$emit('close')" class="text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors">
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="p-6 space-y-6">
        
        <div>
          <label class="block text-xs font-bold text-slate-500 uppercase mb-3">Escolha o Formato</label>
          <div class="flex flex-col gap-3">
            
            <button @click="form.type = 'legacy'" 
              :class="form.type === 'legacy' ? 'bg-amber-50 border-amber-500 ring-1 ring-amber-500' : 'border-slate-200 hover:bg-slate-50'" 
              class="p-4 rounded-xl border text-left flex items-start gap-4 transition-all group">
              <div class="bg-amber-100 p-2.5 rounded-full group-hover:scale-110 transition-transform">
                <Archive class="w-5 h-5 text-amber-700"/>
              </div>
              <div>
                <span class="block text-sm font-bold text-slate-800" :class="{'text-amber-800': form.type === 'legacy'}">
                  Formatado para Reimportação
                </span>
                <span class="block text-xs text-slate-500 mt-1">
                  Gera um Excel idêntico à planilha antiga. Ideal para backups de segurança e restauração do sistema.
                </span>
              </div>
            </button>

            <button @click="form.type = 'geral'" 
              :class="form.type === 'geral' ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-200 hover:bg-slate-50'" 
              class="p-4 rounded-xl border text-left flex items-start gap-4 transition-all group">
              <div class="bg-indigo-100 p-2.5 rounded-full group-hover:scale-110 transition-transform">
                <Database class="w-5 h-5 text-indigo-700"/>
              </div>
              <div>
                <span class="block text-sm font-bold text-slate-800" :class="{'text-indigo-800': form.type === 'geral'}">
                  Relatório Geral Completo
                </span>
                <span class="block text-xs text-slate-500 mt-1">
                  Exporta todas as tabelas do sistema (Cheques, Fluxo, Clientes) em abas separadas para análise.
                </span>
              </div>
            </button>

          </div>
        </div>

        <div class="pt-4 border-t border-slate-100">
          <div class="flex justify-between items-center mb-3">
            <label class="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
              <Calendar class="w-4 h-4" /> Período
            </label>
            
            <button 
              @click="exportarTudo = !exportarTudo"
              class="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full transition-colors cursor-pointer"
              :class="exportarTudo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'"
            >
              <CheckCircle2 v-if="exportarTudo" class="w-4 h-4" />
              <Circle v-else class="w-4 h-4" />
              Exportar Todo o Histórico
            </button>
          </div>

          <div class="grid grid-cols-2 gap-4 transition-opacity duration-200" :class="{'opacity-40 pointer-events-none': exportarTudo}">
            <div>
              <span class="text-xs text-slate-400 mb-1 block font-bold">Data Inicial</span>
              <input v-model="form.start_date" :disabled="exportarTudo" type="date" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <div>
              <span class="text-xs text-slate-400 mb-1 block font-bold">Data Final</span>
              <input v-model="form.end_date" :disabled="exportarTudo" type="date" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
          </div>
        </div>

      </div>

      <div class="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-200">
        <button @click="$emit('close')" class="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg transition-colors">Cancelar</button>
        <button @click="gerarRelatorio" :disabled="loading" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg flex items-center disabled:opacity-50 transition-all active:scale-95">
          <Loader2 v-if="loading" class="w-4 h-4 mr-2 animate-spin" />
          <Download v-else class="w-4 h-4 mr-2" /> 
          {{ loading ? 'Gerando...' : 'Baixar Arquivo' }}
        </button>
      </div>
    </div>
  </div>
</template>