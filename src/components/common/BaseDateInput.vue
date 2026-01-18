<script setup>
import { ref, watch } from 'vue';
import { Calendar } from 'lucide-vue-next';

const props = defineProps({
  modelValue: String, // Recebe YYYY-MM-DD
  placeholder: { type: String, default: 'DD/MM/AAAA' }
});

const emit = defineEmits(['update:modelValue', 'change']);

const displayValue = ref('');

// Converte YYYY-MM-DD (Banco) -> DD/MM/AAAA (Visual)
const formatDate = (iso) => {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return '';
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

// Converte DD/MM/AAAA (Visual) -> YYYY-MM-DD (Banco)
const parseDate = (br) => {
  if (!br || br.length < 10) return '';
  const parts = br.split('/');
  if (parts.length !== 3) return '';
  // Retorna YYYY-MM-DD
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
};

// A Mágica da Máscara
const handleInput = (e) => {
  let v = e.target.value.replace(/\D/g, ''); // Remove tudo que não é número
  
  if (v.length > 8) v = v.substring(0, 8); // Limita a 8 números

  // Adiciona as barras
  if (v.length >= 5) {
    v = v.replace(/(\d{2})(\d{2})(\d{1,4})/, '$1/$2/$3');
  } else if (v.length >= 3) {
    v = v.replace(/(\d{2})(\d{1,2})/, '$1/$2');
  }
  
  displayValue.value = v;
  e.target.value = v; 

  // Só atualiza o valor real se a data estiver completa
  if (v.length === 10) {
    const iso = parseDate(v);
    emit('update:modelValue', iso);
    emit('change', iso); // Avisa que mudou para recalcular juros
  } else if (v.length === 0) {
    emit('update:modelValue', '');
  }
};

// Observa se o valor mudou externamente (ex: carregou do banco)
watch(() => props.modelValue, (newVal) => {
  displayValue.value = formatDate(newVal);
}, { immediate: true });
</script>

<template>
  <div class="relative group">
    <div class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none">
      <Calendar class="w-4 h-4" />
    </div>
    <input 
      type="text" 
      :value="displayValue"
      @input="handleInput"
      placeholder="DD/MM/AAAA"
      class="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none font-medium text-slate-700 transition-all placeholder:text-slate-300"
      maxlength="10"
    />
  </div>
</template>