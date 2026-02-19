<script setup>
import { ref, watch } from 'vue';
import { Calendar } from 'lucide-vue-next';

const props = defineProps({
  modelValue: String, // Recebe YYYY-MM-DD do banco
});

const emit = defineEmits(['update:modelValue', 'change']);

const displayValue = ref('');
const dateInputRef = ref(null); // Referência para o input invisível

// --- Funções Auxiliares ---

// Converte YYYY-MM-DD -> DD/MM/AAAA
const formatToBr = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return (d && m && y) ? `${d}/${m}/${y}` : '';
};

// Converte DD/MM/AAAA -> YYYY-MM-DD
const parseToIso = (br) => {
  if (!br || br.length !== 10) return '';
  const [d, m, y] = br.split('/');
  if (!d || !m || !y) return '';
  // Validação básica de data
  const date = new Date(`${y}-${m}-${d}`);
  if (isNaN(date.getTime())) return '';
  return `${y}-${m}-${d}`;
};

// --- Lógica de Máscara Inteligente ---

const handleInput = (e) => {
  const input = e.target;
  const cursorPosition = input.selectionStart; // Salva onde o cursor está
  const oldValue = displayValue.value;
  let newValue = input.value;

  // 1. Permite apenas números e barras
  newValue = newValue.replace(/[^\d/]/g, '');

  // 2. Lógica de Adição Automática de Barras (Só se estiver digitando no final)
  // Isso resolve o problema de "não consigo editar o meio".
  // Só adicionamos a barra se o usuário acabou de digitar um número e está no final da string.
  const isTypingAtEnd = cursorPosition === input.value.length;
  const justAddedChar = newValue.length > oldValue.length;

  if (isTypingAtEnd && justAddedChar) {
    if (newValue.length === 2 || newValue.length === 5) {
      newValue += '/';
    }
  }

  // 3. Limite de caracteres
  if (newValue.length > 10) newValue = newValue.slice(0, 10);

  // 4. Atualiza o visual
  displayValue.value = newValue;
  input.value = newValue; // Força atualização no DOM

  // 5. Emite valor ISO se a data estiver completa (10 chars)
  if (newValue.length === 10) {
    const iso = parseToIso(newValue);
    if (iso) {
      emit('update:modelValue', iso);
      emit('change', iso);
    }
  } else if (newValue.length === 0) {
    emit('update:modelValue', '');
  }
};

// --- Lógica do Calendário ---

// Abre o calendário nativo do input invisível
const openCalendar = () => {
  if (dateInputRef.value && dateInputRef.value.showPicker) {
    dateInputRef.value.showPicker();
  } else {
    // Fallback: foca no input invisível para tentar abrir em mobile
    dateInputRef.value.click(); 
  }
};

// Quando o usuário escolhe uma data no calendário visual
const handleDateSelect = (e) => {
  const isoDate = e.target.value; // YYYY-MM-DD
  displayValue.value = formatToBr(isoDate);
  emit('update:modelValue', isoDate);
  emit('change', isoDate);
};

// --- Watchers ---

// Sincroniza quando o valor vem de fora (do banco de dados)
watch(() => props.modelValue, (newVal) => {
  // Só atualiza se o valor formatado for diferente do atual para não atrapalhar digitação
  const formatted = formatToBr(newVal);
  if (formatted !== displayValue.value) {
    displayValue.value = formatted;
  }
}, { immediate: true });
</script>

<template>
  <div class="relative w-full">
    <button 
      type="button"
      @click="openCalendar"
      class="absolute left-0 top-0 bottom-0 px-3 text-slate-400 hover:text-emerald-500 transition-colors flex items-center z-10 cursor-pointer focus:outline-none"
      title="Selecionar Data"
    >
      <Calendar class="w-5 h-5" />
    </button>
    
    <input 
      type="text"
      :value="displayValue"
      @input="handleInput"
      placeholder="DD/MM/AAAA"
      class="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 font-medium text-slate-700 transition-all placeholder:text-slate-300"
      inputmode="numeric" 
      maxlength="10"
    />

    <input 
      ref="dateInputRef"
      type="date"
      class="absolute inset-0 w-full h-full opacity-0 pointer-events-none -z-10"
      :value="props.modelValue"
      @input="handleDateSelect"
      tabindex="-1"
    />
  </div>
</template>