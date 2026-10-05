<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { Lock, User, ArrowRight, Wallet, AlertTriangle } from 'lucide-vue-next';
import api from '../services/api'; // Certifique-se que o axios está configurado

const router = useRouter();
const email = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');

const handleLogin = async () => {
  loading.value = true;
  error.value = '';

  try {

    const { data } = await api.post('/auth/login', {
      email: email.value,
      password: password.value
    });

   
    const sessionData = {
    ...data.user, 
    token: data.token 
    };
    localStorage.setItem('user', JSON.stringify(sessionData));
    
  
    router.push('/');

  } catch (err) {
    console.error(err);
    if (err.response && err.response.status === 401) {
      error.value = 'Usuário ou senha incorretos.';
    } else {
      error.value = 'Erro ao conectar com o servidor.';
    }
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-6 bg-slate-50 relative overflow-hidden">
    <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgb(99_102_241/0.14),transparent_60%)]"></div>

    <div class="relative w-full max-w-sm">
      <div class="flex flex-col items-center mb-8">
        <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 ring-1 ring-inset ring-white/20">
          <Wallet class="w-7 h-7" />
        </div>
        <h1 class="mt-4 text-3xl font-semibold tracking-tight text-slate-900">Fozesc</h1>
      </div>

      <div class="bg-white rounded-2xl shadow-xl ring-1 ring-slate-200/70 p-7">
        <form @submit.prevent="handleLogin" class="space-y-5">
          <div>
            <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Email</label>
            <div class="relative group">
              <div class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                <User class="w-[18px] h-[18px]" />
              </div>
              <input 
                v-model="email" 
                type="email" 
                class="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg outline-none transition-all text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs"
                placeholder="seu@email.com"
                required
              />
            </div>
          </div>

          <div>
            <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Senha</label>
            <div class="relative group">
              <div class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                <Lock class="w-[18px] h-[18px]" />
              </div>
              <input 
                v-model="password" 
                type="password" 
                class="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg outline-none transition-all text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <div v-if="error" class="text-red-700 text-sm font-medium bg-red-50 border border-red-200 p-3 rounded-lg flex items-center gap-2">
            <AlertTriangle class="w-4 h-4" /> {{ error }}
          </div>

          <button 
            type="submit" 
            :disabled="loading"
            class="w-full bg-indigo-600 text-white font-semibold text-sm py-2.5 rounded-lg shadow-xs ring-1 ring-inset ring-white/10 hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <span v-if="!loading">Entrar no sistema</span>
            <span v-else>Verificando...</span>
            <ArrowRight v-if="!loading" class="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  </div>
</template>