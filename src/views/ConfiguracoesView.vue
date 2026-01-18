<script setup>
import { ref } from 'vue';
import DashboardLayout from '../layouts/DashboardLayout.vue';
import { Save, Settings, Building, Percent } from 'lucide-vue-next';

// Simulação de dados salvos
const config = ref({
  nomeEmpresa: 'Fozesc Gestão Financeira',
  cnpj: '00.000.000/0001-00',
  endereco: 'Av. Brasil, 1234 - Centro, Foz do Iguaçu - PR',
  telefone: '(45) 99999-9999',
  taxaPadrao: 4.00,
  diasCompensacaoPadrao: 2
});

const salvar = () => {
  alert('Configurações salvas com sucesso! (Estariam no banco de dados)');
  // Aqui enviariamos para o backend
};
</script>

<template>
  <DashboardLayout>
    <div class="flex items-center gap-3 mb-8">
      <div class="bg-indigo-600 p-2 rounded-lg text-white shadow-lg shadow-indigo-200">
        <Settings class="w-6 h-6" />
      </div>
      <div>
        <h1 class="text-3xl font-bold text-slate-900">Configurações do Sistema</h1>
        <p class="text-slate-500 text-sm">Parâmetros globais e dados para impressão.</p>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      
      <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div class="flex items-center gap-2 mb-6 text-slate-800 font-bold border-b border-slate-100 pb-2">
          <Building class="w-5 h-5 text-indigo-500" /> Dados da Empresa (Cabeçalho)
        </div>
        
        <div class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Fantasia</label>
            <input v-model="config.nomeEmpresa" type="text" class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase mb-1">CNPJ (Opcional)</label>
              <input v-model="config.cnpj" type="text" class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone Contato</label>
              <input v-model="config.telefone" type="text" class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Endereço Completo</label>
            <input v-model="config.endereco" type="text" class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>
      </div>

      <div class="space-y-6">
        <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div class="flex items-center gap-2 mb-6 text-slate-800 font-bold border-b border-slate-100 pb-2">
            <Percent class="w-5 h-5 text-emerald-500" /> Parâmetros de Cálculo
          </div>
          
          <div class="space-y-4">
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Taxa de Juros Padrão (% a.m.)</label>
              <div class="relative">
                <input v-model="config.taxaPadrao" type="number" step="0.01" class="w-full pl-4 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-slate-800" />
                <span class="absolute right-4 top-2 text-slate-400 font-bold">%</span>
              </div>
              <p class="text-xs text-slate-400 mt-1">Essa taxa virá preenchida automaticamente no Novo Borderô.</p>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Dias de Compensação (Float)</label>
              <input v-model="config.diasCompensacaoPadrao" type="number" class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-slate-800" />
              <p class="text-xs text-slate-400 mt-1">Dias adicionados automaticamente ao cálculo de vencimento.</p>
            </div>
          </div>
        </div>

        <button @click="salvar" class="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
          <Save class="w-5 h-5" /> Salvar Alterações
        </button>
      </div>

    </div>
  </DashboardLayout>
</template>