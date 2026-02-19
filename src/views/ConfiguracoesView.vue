<script setup>
import { ref, onMounted } from 'vue';
import DashboardLayout from '../layouts/DashboardLayout.vue';
import { 
  Save, Settings, Building, Percent, Users, 
  Plus, Edit2, Trash2, Shield, X, Check, Lock 
} from 'lucide-vue-next';
import api from '../services/api';


const loading = ref(false);
const saving = ref(false);
const users = ref([]);
const showUserModal = ref(false);


const config = ref({
  nomeEmpresa: '',
  cnpj: '',
  endereco: '',
  telefone: '',
  taxaPadrao: 4.00,
  diasCompensacaoPadrao: 2,
  iof_rate: 0.38,
  extension_rate: 4.00,
  fine_rate: 2.00
});


const userForm = ref({
  id: null,
  name: '',
  email: '',
  password: '',
  role: 'Operador'
});

const roles = ['Admin', 'Gerente', 'Operador'];


const fetchSettings = async () => {
  try {
    const { data } = await api.get('/settings/');
    config.value = data;
  } catch (error) {
    console.error("Erro ao carregar configurações", error);
  }
};

const fetchUsers = async () => {
  try {
   
    const { data } = await api.get('/users/'); 
    users.value = data;
  } catch (error) {
    console.error("Erro ao buscar usuários", error);
  }
};


const salvarConfig = async () => {
  saving.value = true;
  try {
    await api.put('/settings/', config.value);
    alert('Preferências salvas com sucesso!');
  } catch (error) {
    alert("Erro ao salvar configurações.");
  } finally {
    saving.value = false;
  }
};

const openUserModal = (user = null) => {
  if (user) {
    userForm.value = { ...user, password: '' }; 
  } else {
    userForm.value = { id: null, name: '', email: '', password: '', role: 'Operador' };
  }
  showUserModal.value = true;
};

const saveUser = async () => {
  if (!userForm.value.name || !userForm.value.email) return alert("Preencha nome e email.");
  if (!userForm.value.id && !userForm.value.password) return alert("Senha é obrigatória.");

  loading.value = true;
  try {
    if (userForm.value.id) {
      await api.put(`/users/${userForm.value.id}`, userForm.value);
    } else {
      await api.post('/users/', userForm.value);
    }
    showUserModal.value = false;
    fetchUsers(); 
  } catch (error) {
    alert(error.response?.data?.error || "Erro ao salvar usuário.");
  } finally {
    loading.value = false;
  }
};

const deleteUser = async (id) => {
  if (!confirm("Tem certeza que deseja excluir este usuário?")) return;
  try {
    await api.delete(`/users/${id}`);
    fetchUsers();
  } catch (error) {
    alert("Erro ao excluir.");
  }
};

onMounted(() => {
  fetchSettings();
  fetchUsers();
});
</script>

<template>
  <DashboardLayout>
    
    <div v-if="showUserModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="showUserModal = false"></div>
      <div class="bg-white w-full max-w-md rounded-xl shadow-2xl relative z-10 overflow-hidden animate-scale-in">
        <div class="bg-slate-900 p-5 flex justify-between items-center text-white">
          <h3 class="font-bold flex items-center gap-2"><Shield class="w-5 h-5 text-emerald-400" /> {{ userForm.id ? 'Editar Acesso' : 'Novo Usuário' }}</h3>
          <button @click="showUserModal = false" class="hover:text-slate-300"><X class="w-5 h-5" /></button>
        </div>
        
        <div class="p-6 space-y-4">
          <div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo</label><input v-model="userForm.name" type="text" class="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ex: Lucas Quadros" /></div>
          <div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Email (Login)</label><input v-model="userForm.email" type="email" class="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="usuario@fozesc.com" /></div>
          
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Senha {{ userForm.id ? '(Opcional)' : '' }}</label>
            <div class="relative">
              <Lock class="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input v-model="userForm.password" type="password" class="w-full pl-10 border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="******" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Nível de Acesso</label>
            <div class="flex gap-2">
              <button v-for="role in roles" :key="role" @click="userForm.role = role" 
                class="flex-1 py-2 text-xs font-bold rounded border transition-all"
                :class="userForm.role === role ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-500 hover:bg-slate-50'">
                {{ role }}
              </button>
            </div>
          </div>
        </div>

        <div class="p-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
          <button @click="showUserModal = false" class="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg text-sm">Cancelar</button>
          <button @click="saveUser" :disabled="loading" class="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-md flex items-center text-sm disabled:opacity-50">
            <Check class="w-4 h-4 mr-2" /> {{ loading ? 'Salvando...' : 'Salvar Acesso' }}
          </button>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-3 mb-8">
      <div class="bg-indigo-600 p-2 rounded-lg text-white shadow-lg shadow-indigo-200">
        <Settings class="w-6 h-6" />
      </div>
      <div>
        <h1 class="text-3xl font-bold text-slate-900">Configurações</h1>
        <p class="text-slate-500 text-sm">Parâmetros do sistema e gestão de equipe.</p>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
      
      <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit">
        <div class="flex items-center gap-2 mb-6 text-slate-800 font-bold border-b border-slate-100 pb-2">
          <Building class="w-5 h-5 text-indigo-500" /> Dados da Empresa
        </div>
        
        <div class="space-y-4">
          <div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Fantasia</label><input v-model="config.nomeEmpresa" type="text" class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" /></div>
          <div class="grid grid-cols-2 gap-4">
            <div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">CNPJ</label><input v-model="config.cnpj" type="text" class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" /></div>
            <div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone</label><input v-model="config.telefone" type="text" class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" /></div>
          </div>
          <div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Endereço</label><input v-model="config.endereco" type="text" class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" /></div>
        </div>
      </div>

      <div class="space-y-6">
        
        <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div class="flex items-center gap-2 mb-6 text-slate-800 font-bold border-b border-slate-100 pb-2">
            <Percent class="w-5 h-5 text-emerald-500" /> Taxas & Automação
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Taxa Padrão (% a.m.)</label>
              <div class="relative"><input v-model="config.taxaPadrao" type="number" step="0.01" class="w-full pl-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-slate-800" /><span class="absolute right-4 top-2 text-slate-400 font-bold">%</span></div>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Dias Compensação</label>
              <input v-model="config.diasCompensacaoPadrao" type="number" class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-slate-800" />
            </div>
            
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase mb-1" title="Imposto sobre Operações Financeiras">IOF Base (%)</label>
              <input v-model="config.iof_rate" type="number" step="0.01" class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-slate-800" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Multa Devolução (%)</label>
              <input v-model="config.fine_rate" type="number" step="0.01" class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-slate-800" />
            </div>
             <div class="col-span-2">
              <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Taxa de Prorrogação (% a.m.)</label>
              <input v-model="config.extension_rate" type="number" step="0.01" class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-slate-800" />
              <p class="text-[10px] text-slate-400 mt-1">Usado automaticamente ao prorrogar títulos.</p>
            </div>
          </div>
        </div>

        <button @click="salvarConfig" :disabled="saving" class="w-full bg-slate-800 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-slate-900 transition-all flex items-center justify-center gap-2">
          <Save v-if="!saving" class="w-5 h-5" /> 
          <span v-else>Salvando...</span>
          {{ saving ? 'Salvando...' : 'Salvar Preferências' }}
        </button>
      </div>
    </div>

    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div class="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div class="flex items-center gap-3">
          <div class="bg-indigo-100 p-2 rounded-lg text-indigo-600"><Users class="w-5 h-5" /></div>
          <div>
            <h3 class="font-bold text-slate-800">Equipe e Acesso</h3>
            <p class="text-xs text-slate-500">Gerencie quem pode acessar o sistema.</p>
          </div>
        </div>
        <button @click="openUserModal()" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold shadow-md shadow-emerald-200 flex items-center transition-all text-sm">
          <Plus class="w-4 h-4 mr-2" /> Novo Usuário
        </button>
      </div>

      <table class="w-full text-left">
        <thead class="bg-slate-50 text-slate-500 uppercase text-xs">
          <tr>
            <th class="px-6 py-4">Usuário</th>
            <th class="px-6 py-4">Email</th>
            <th class="px-6 py-4">Nível</th>
            <th class="px-6 py-4 text-right">Ações</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="users.length === 0">
            <td colspan="4" class="px-6 py-8 text-center text-slate-400">Nenhum usuário cadastrado.</td>
          </tr>
          <tr v-for="user in users" :key="user.id" class="hover:bg-slate-50 transition-colors">
            <td class="px-6 py-4 font-bold text-slate-700 flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm">
                {{ user.name.charAt(0).toUpperCase() }}
              </div>
              {{ user.name }}
            </td>
            <td class="px-6 py-4 text-slate-600 text-sm">{{ user.email }}</td>
            <td class="px-6 py-4">
              <span class="px-2.5 py-1 rounded-full text-xs font-bold border"
                :class="{
                  'bg-purple-50 text-purple-700 border-purple-100': user.role === 'Admin',
                  'bg-blue-50 text-blue-700 border-blue-100': user.role === 'Gerente',
                  'bg-slate-100 text-slate-600 border-slate-200': user.role === 'Operador'
                }">
                {{ user.role }}
              </span>
            </td>
            <td class="px-6 py-4 text-right">
              <div class="flex justify-end gap-2">
                <button @click="openUserModal(user)" class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"><Edit2 class="w-4 h-4" /></button>
                <button @click="deleteUser(user.id)" class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 class="w-4 h-4" /></button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

  </DashboardLayout>
</template>

<style scoped>
.animate-scale-in { animation: scaleIn 0.2s ease-out; }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
</style>