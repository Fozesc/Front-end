<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { Lock, User, ArrowRight, Wallet } from 'lucide-vue-next';

const router = useRouter();
const email = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');

const handleLogin = () => {
  loading.value = true;
  error.value = '';

  // Simulação de delay de rede
  setTimeout(() => {
    // Aqui virá a lógica real do Backend
    if (email.value === 'admin' && password.value === 'admin') {
      router.push('/');
    } else {
      error.value = 'Credenciais inválidas. Tente admin/admin';
      loading.value = false;
    }
  }, 1000);
};
</script>

<template>
  <div class="min-h-screen bg-slate-900 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row">
      
      <div class="md:w-1/2 bg-indigo-600 p-12 text-white flex flex-col justify-between relative overflow-hidden">
        <div class="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <Wallet class="w-96 h-96 -translate-x-10 -translate-y-10" />
        </div>
        
        <div class="relative z-10">
          <div class="bg-white/20 w-12 h-12 rounded-lg flex items-center justify-center mb-6 backdrop-blur-sm">
            <Wallet class="w-6 h-6" />
          </div>
          <h1 class="text-3xl font-bold mb-2">Fozesc Management</h1>
          <p class="text-indigo-200">Gestão financeira profissional, controle de borderôs e custódia de cheques.</p>
        </div>

        <div class="relative z-10 text-xs text-indigo-300 mt-12">
          &copy; 2026 Fozesc Financeira. Todos os direitos reservados.
        </div>
      </div>

      <div class="md:w-1/2 p-12 flex flex-col justify-center">
        <h2 class="text-2xl font-bold text-slate-800 mb-1">Bem-vindo de volta!</h2>
        <p class="text-slate-500 mb-8 text-sm">Insira suas credenciais para acessar o painel.</p>

        <form @submit.prevent="handleLogin" class="space-y-5">
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Usuário / Email</label>
            <div class="relative group">
              <div class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                <User class="w-5 h-5" />
              </div>
              <input 
                v-model="email" 
                type="text" 
                class="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                placeholder="Ex: admin"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Senha</label>
            <div class="relative group">
              <div class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                <Lock class="w-5 h-5" />
              </div>
              <input 
                v-model="password" 
                type="password" 
                class="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div v-if="error" class="text-red-500 text-sm font-bold bg-red-50 p-3 rounded-lg flex items-center gap-2">
            <AlertTriangle class="w-4 h-4" /> {{ error }}
          </div>

          <button 
            type="submit" 
            :disabled="loading"
            class="w-full bg-slate-900 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-slate-800 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <span v-if="!loading">Acessar Sistema</span>
            <span v-else>Entrando...</span>
            <ArrowRight v-if="!loading" class="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  </div>
</template>