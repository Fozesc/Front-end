<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { Search, X, Check, Loader2, ChevronDown, User } from 'lucide-vue-next';
import clientService from '../../services/clientService';

const props = defineProps({
  modelValue: [Number, String], // O ID do cliente selecionado
  initialName: String // O nome inicial (caso esteja editando)
});

const emit = defineEmits(['update:modelValue', 'select']);

const isOpen = ref(false);
const searchTerm = ref('');
const options = ref([]);
const loading = ref(false);
const selectedLabel = ref(props.initialName || '');

// Elemento do menu para fechar ao clicar fora
const containerRef = ref(null);

// --- LÓGICA DE BUSCA ---
const searchClients = async (term = '') => {
  loading.value = true;
  try {
    const params = {
      page: 1,
      per_page: 10, // Traz apenas os 10 primeiros resultados
      search: term
    };
    
    // Usa o serviço paginado que já criamos
    const res = await clientService.getAll(params);
    options.value = res.items;
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
};

// Debounce (espera parar de digitar para buscar)
let timeout = null;
const onInput = () => {
  isOpen.value = true;
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    searchClients(searchTerm.value);
  }, 300);
};

// --- SELEÇÃO ---
const selectOption = (client) => {
  selectedLabel.value = client.name;
  emit('update:modelValue', client.id);
  emit('select', client); // Emite o objeto completo se precisar (taxa, etc)
  isOpen.value = false;
  searchTerm.value = ''; // Limpa a busca interna
};

const clearSelection = (e) => {
  e.stopPropagation();
  selectedLabel.value = '';
  emit('update:modelValue', null);
  searchTerm.value = '';
  searchClients(''); // Reseta a lista
};

const toggleOpen = () => {
  if (isOpen.value) {
    isOpen.value = false;
  } else {
    isOpen.value = true;
    // Se não tiver opções carregadas, busca as primeiras
    if (options.value.length === 0) searchClients('');
    // Foca no input de busca
    setTimeout(() => document.getElementById('client-search-input')?.focus(), 100);
  }
};

// Fecha ao clicar fora
const handleClickOutside = (event) => {
  if (containerRef.value && !containerRef.value.contains(event.target)) {
    isOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <div class="relative" ref="containerRef">
    <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Cliente</label>
    
    <div 
      @click="toggleOpen"
      class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex justify-between items-center cursor-pointer hover:border-indigo-400 transition-colors h-[42px]"
      :class="{'ring-2 ring-indigo-100 border-indigo-500': isOpen}"
    >
      <div v-if="selectedLabel" class="flex items-center gap-2 font-bold text-slate-800">
        <div class="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs">
          {{ selectedLabel.charAt(0) }}
        </div>
        {{ selectedLabel }}
      </div>
      <div v-else class="text-slate-400 text-sm">Selecione um cliente...</div>

      <div class="flex items-center gap-1">
        <button v-if="selectedLabel" @click="clearSelection" class="p-1 hover:bg-slate-200 rounded-full text-slate-400">
          <X class="w-3 h-3" />
        </button>
        <ChevronDown class="w-4 h-4 text-slate-400 transition-transform" :class="{'rotate-180': isOpen}" />
      </div>
    </div>

    <div v-if="isOpen" class="absolute left-0 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
      
      <div class="p-2 border-b border-slate-100 bg-slate-50">
        <div class="relative">
          <Search class="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input 
            id="client-search-input"
            v-model="searchTerm" 
            @input="onInput"
            placeholder="Digite para buscar..." 
            class="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
            autocomplete="off"
          />
          <div v-if="loading" class="absolute right-3 top-2.5">
            <Loader2 class="w-4 h-4 text-indigo-500 animate-spin" />
          </div>
        </div>
      </div>

      <ul class="max-h-60 overflow-y-auto p-1">
        <li v-if="options.length === 0 && !loading" class="text-center py-4 text-xs text-slate-400">
          Nenhum cliente encontrado.
        </li>
        
        <li 
          v-for="client in options" 
          :key="client.id"
          @click="selectOption(client)"
          class="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer hover:bg-indigo-50 transition-colors group"
          :class="{'bg-indigo-50': modelValue === client.id}"
        >
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600 flex items-center justify-center font-bold text-xs transition-colors">
              {{ client.name.charAt(0) }}
            </div>
            <div>
              <div class="text-sm font-bold text-slate-700 group-hover:text-indigo-900">{{ client.name }}</div>
              <div class="text-[10px] text-slate-400">{{ client.document || 'Sem documento' }}</div>
            </div>
          </div>
          <Check v-if="modelValue === client.id" class="w-4 h-4 text-indigo-600" />
        </li>
      </ul>
    </div>
  </div>
</template>