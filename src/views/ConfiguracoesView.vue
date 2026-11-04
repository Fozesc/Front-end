<script setup>
import { ref, reactive, onMounted } from 'vue';
import { AJUDA } from '../utils/ajuda';
import DashboardLayout from '../layouts/DashboardLayout.vue';
import ConfigBackup from '../components/layout/ConfigBackup.vue';
import { documentoValido } from '../utils/documento';
import { textoClausula } from '../utils/contratoPdf';
import { 
  Save, Building, Percent, Users, 
  Plus, Edit2, Trash2, Shield, X, Check, Lock,
  AlertTriangle, CheckSquare, CheckCircle, // <-- Ícones novos para os modais
  HardDriveDownload, FileSignature
} from 'lucide-vue-next';
import api from '../services/api';

let usuario = {};
try { usuario = JSON.parse(localStorage.getItem('user') || '{}') || {}; } catch { usuario = {}; }
const ehAdmin = usuario.role === 'Admin';
// abas de Ajustes; Equipe e Backups so o Admin ve
const ABAS = [
  { id: 'empresa', nome: 'Empresa', icone: Building }, { id: 'taxas', nome: 'Taxas', icone: Percent },
  { id: 'contratos', nome: 'Contratos', icone: FileSignature }, { id: 'equipe', nome: 'Equipe', icone: Users, admin: true },
  { id: 'backups', nome: 'Backups', icone: HardDriveDownload, admin: true },
];
const aba = ref('empresa');

const loading = ref(false);
const saving = ref(false);
const users = ref([]);
const showUserModal = ref(false);

const config = ref({
  nomeEmpresa: '',
  cnpj: '',
  endereco: '',
  telefone: '',
  pqNome: '',
  pqCnpj: '',
  pqEndereco: '',
  email: '', esc: true, pqEmail: '', pqTelefone: '', pqEsc: false,
  contratoJurosMora: 1, contratoMulta: 2, contratoHonorarios: 10, contratoPrazoReembolso: 30, contratoVias: 2, contratoCidade: 'Foz do Iguaçu',
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

// --- ESTADO DO MODAL DE ALERTA (Sucesso/Erro) ---
const alertModal = reactive({
  visible: false,
  title: '',
  message: '',
  type: 'success'
});

const showAlert = (title, message, type = 'success') => {
  alertModal.title = title;
  alertModal.message = message;
  alertModal.type = type;
  alertModal.visible = true;
};

// --- ESTADO DO MODAL DE CONFIRMAÇÃO (Exclusão) ---
const confirmModal = reactive({
  visible: false,
  title: '',
  message: '',
  action: null,
  type: 'danger'
});

const openConfirm = (title, message, actionCallback, type = 'danger') => {
  confirmModal.title = title;
  confirmModal.message = message;
  confirmModal.action = actionCallback;
  confirmModal.type = type;
  confirmModal.visible = true;
};
// ------------------------------------------------

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

// como as clausulas vao ficar com os padroes digitados (aba Contratos)
const previaClausulas = () => {
  const c = { jurosMora: Number(String(config.value.contratoJurosMora).replace(',', '.')) || 0, multa: Number(String(config.value.contratoMulta).replace(',', '.')) || 0,
    honorarios: Number(String(config.value.contratoHonorarios).replace(',', '.')) || 0,
    prazoReembolso: Math.max(1, parseInt(config.value.contratoPrazoReembolso, 10) || 1), vias: Math.max(1, parseInt(config.value.contratoVias, 10) || 1) };
  return ['contará com prazo de reembolso de {{prazo}} dias', 'juros de mora fixados em {{mora}} ao mês',
    'multa contratual, fixada em {{multa}}', 'honorários advocatícios, estes fixados em {{honorarios}}',
    'firmam o presente instrumento em {{vias}} vias de igual teor'].map(t => textoClausula(t, c));
};

const salvarConfig = async () => {
  saving.value = true;
  try {
    await api.put('/settings/', config.value);
    showAlert('Sucesso!', 'Preferências salvas com sucesso!', 'success');
  } catch (error) {
    showAlert('Erro', error.response?.data?.error || 'Erro ao salvar configurações.', 'error');
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
  if (!userForm.value.name || !userForm.value.email) return showAlert('Atenção', 'Preencha nome e email.', 'error');
  if (!userForm.value.id && !userForm.value.password) return showAlert('Atenção', 'A senha é obrigatória.', 'error');

  loading.value = true;
  try {
    if (userForm.value.id) {
      await api.put(`/users/${userForm.value.id}`, userForm.value);
    } else {
      await api.post('/users/', userForm.value);
    }
    showUserModal.value = false;
    fetchUsers(); 
    showAlert('Sucesso', 'Usuário salvo com sucesso!', 'success');
  } catch (error) {
    showAlert('Erro', error.response?.data?.error || "Erro ao salvar usuário.", 'error');
  } finally {
    loading.value = false;
  }
};

const deleteUser = (id) => {
  openConfirm(
    'Excluir Usuário', 
    'Tem certeza que deseja excluir este usuário? Ele perderá o acesso ao sistema e esta ação não pode ser desfeita.', 
    async () => {
      try {
        await api.delete(`/users/${id}`);
        fetchUsers();
        showAlert('Sucesso', 'Usuário excluído com sucesso!', 'success');
      } catch (error) {
        showAlert('Erro', error.response?.data?.error || 'Erro ao excluir usuário.', 'error');
      }
    }, 
    'danger'
  );
};

onMounted(() => {
  fetchSettings();
  if (ehAdmin) fetchUsers();
});
</script>

<template>
  <DashboardLayout>
    
    <div v-if="alertModal.visible" class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm transition-opacity p-4">
      <div class="bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full text-center animate-scale-in relative z-10">
        <div :class="`mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 ${alertModal.type === 'error' ? 'bg-red-100' : 'bg-emerald-100'}`">
          <CheckCircle v-if="alertModal.type === 'success'" class="h-6 w-6 text-emerald-600" />
          <AlertTriangle v-else class="h-6 w-6 text-red-600" />
        </div>
        <h3 class="text-lg font-semibold text-slate-900 mb-1">{{ alertModal.title }}</h3>
        <p class="text-slate-500 text-sm mb-6">{{ alertModal.message }}</p>
        <button @click="alertModal.visible = false" :class="`w-full py-2.5 px-4 rounded-lg text-white font-semibold text-sm shadow-xs ${alertModal.type === 'error' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`">Entendido</button>
      </div>
    </div>

    <div v-if="confirmModal.visible" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="confirmModal.visible = false"></div>
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm relative z-10 p-6 text-center animate-scale-in">
        
        <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4"
             :class="confirmModal.type === 'danger' ? 'bg-red-100 text-red-600' : (confirmModal.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600')">
          <AlertTriangle v-if="confirmModal.type !== 'success'" class="h-6 w-6" />
          <CheckSquare v-else class="h-6 w-6" />
        </div>
        
        <h3 class="text-lg font-semibold text-slate-900 mb-1">{{ confirmModal.title }}</h3>
        <p class="text-slate-500 text-sm mb-6">{{ confirmModal.message }}</p>
        
        <div class="flex gap-3 justify-center">
          <button @click="confirmModal.visible = false" class="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 font-semibold text-sm rounded-lg shadow-xs hover:bg-slate-50 transition-colors w-full">
            Cancelar
          </button>
          <button @click="() => { confirmModal.action(); confirmModal.visible = false; }" 
                  class="px-4 py-2.5 text-white font-semibold text-sm rounded-lg shadow-xs transition-colors w-full"
                  :class="confirmModal.type === 'danger' ? 'bg-red-600 hover:bg-red-700' : (confirmModal.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-500 hover:bg-amber-600')">
            Confirmar
          </button>
        </div>
      </div>
    </div>
    
    <div v-if="showUserModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="showUserModal = false"></div>
      <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl relative z-10 overflow-hidden animate-scale-in">
        <div class="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h3 class="text-base font-semibold text-slate-900 flex items-center gap-3"><span class="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100 flex items-center justify-center"><Shield class="w-[18px] h-[18px]" /></span> {{ userForm.id ? 'Editar acesso' : 'Novo usuário' }}</h3>
          <button @click="showUserModal = false" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"><X class="w-5 h-5" /></button>
        </div>
        
        <div class="p-6 space-y-4">
          <div><label class="block text-[13px] font-medium text-slate-700 mb-1.5">Nome Completo</label><input v-model="userForm.name" type="text" class="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" placeholder="Nome Completo" /></div>
          <div><label class="block text-[13px] font-medium text-slate-700 mb-1.5">Email (Login)</label><input v-model="userForm.email" type="email" class="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" placeholder="usuario@fozesc.com" /></div>
          
          <div>
            <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Senha {{ userForm.id ? '(Opcional)' : '' }}</label>
            <div class="relative">
              <Lock class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input v-model="userForm.password" type="password" class="w-full pl-10 border border-slate-300 rounded-lg p-2.5 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" placeholder="******" />
            </div>
          </div>

          <div>
            <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Nível de acesso</label>
            <div class="flex gap-1 bg-slate-100 p-1 rounded-lg">
              <button v-for="role in roles" :key="role" @click="userForm.role = role" 
                class="flex-1 py-1.5 text-xs font-semibold rounded-md transition-all"
                :class="userForm.role === role ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'">
                {{ role }}
              </button>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 bg-slate-50/70 flex justify-end gap-3 border-t border-slate-200">
          <button @click="showUserModal = false" class="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-semibold shadow-xs hover:bg-slate-50 rounded-lg text-sm">Cancelar</button>
          <button @click="saveUser" :disabled="loading" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-xs ring-1 ring-inset ring-white/10 flex items-center text-sm disabled:opacity-50">
            <Check class="w-4 h-4 mr-2" /> {{ loading ? 'Salvando...' : 'Salvar acesso' }}
          </button>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-3 mb-7">
      <div>
        <h1 class="text-2xl font-semibold text-slate-900 tracking-tight cursor-help" v-dica="AJUDA['/configuracoes']">Configurações</h1>
        <p class="text-slate-500 text-sm mt-1">Parâmetros do sistema e gestão de equipe.</p>
      </div>
    </div>

    <div class="flex flex-wrap bg-slate-100 p-1 rounded-lg gap-0.5 w-fit mb-6" role="tablist" data-campo="abas-config">
      <button v-for="a in ABAS.filter(x => ehAdmin || !x.admin)" :key="a.id" @click="aba = a.id" role="tab" :aria-selected="aba === a.id" :data-campo="`aba-${a.id}`"
              class="px-4 py-1.5 text-[13px] font-semibold rounded-md flex items-center gap-2 transition-all"
              :class="aba === a.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'">
        <component :is="a.icone" class="w-4 h-4" /> {{ a.nome }}
      </button>
    </div>

    <ConfigBackup v-if="aba === 'backups'" />

    <div v-if="aba === 'contratos'" class="grid grid-cols-1 lg:grid-cols-2 gap-6" data-campo="config-contratos">
      <fieldset :disabled="!ehAdmin" class="bg-white p-6 rounded-xl shadow-sm border border-slate-200/80 disabled:opacity-90">
        <div class="flex items-center gap-3 mb-2 text-sm text-slate-900 font-semibold">
          <span class="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100 flex items-center justify-center"><FileSignature class="w-[18px] h-[18px]" /></span> Padrões do contrato
        </div>
        <p class="text-xs text-slate-500 mb-5">Entram em cada contrato novo (e no "Montar de novo"). Cada contrato ainda pode ter os seus números, na tela de Contratos.</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Juros de mora</label>
            <div class="relative"><input v-model="config.contratoJurosMora" type="number" step="0.01" min="0" data-campo="contratoJurosMora" class="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow pr-16 font-semibold" /><span class="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400">% ao mês</span></div>
            <p class="text-[11px] text-slate-400 mt-1">Cláusula 8ª e Quadro 03</p>
          </div>
          <div>
            <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Multa contratual</label>
            <div class="relative"><input v-model="config.contratoMulta" type="number" step="0.01" min="0" data-campo="contratoMulta" class="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow pr-16 font-semibold" /><span class="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span></div>
            <p class="text-[11px] text-slate-400 mt-1">Cláusula 8ª</p>
          </div>
          <div>
            <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Honorários advocatícios</label>
            <div class="relative"><input v-model="config.contratoHonorarios" type="number" step="0.01" min="0" data-campo="contratoHonorarios" class="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow pr-16 font-semibold" /><span class="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span></div>
            <p class="text-[11px] text-slate-400 mt-1">Cláusula 8ª, parágrafo único</p>
          </div>
          <div>
            <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Prazo de reembolso</label>
            <div class="relative"><input v-model="config.contratoPrazoReembolso" type="number" step="1" min="0" data-campo="contratoPrazoReembolso" class="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow pr-16 font-semibold" /><span class="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400">dias</span></div>
            <p class="text-[11px] text-slate-400 mt-1">Cláusula 7ª e notificação de cobrança</p>
          </div>
          <div>
            <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Número de vias</label>
            <div class="relative"><input v-model="config.contratoVias" type="number" step="1" min="0" data-campo="contratoVias" class="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow pr-16 font-semibold" /><span class="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400">vias</span></div>
            <p class="text-[11px] text-slate-400 mt-1">Fecho do contrato</p>
          </div>
          <div>
            <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Cidade do contrato</label>
            <input v-model="config.contratoCidade" type="text" maxlength="100" data-campo="contratoCidade" class="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" />
            <p class="text-[11px] text-slate-400 mt-1">Linha da data, antes das assinaturas</p>
          </div>
        </div>
        <button v-if="ehAdmin" @click="salvarConfig" :disabled="saving" data-campo="salvar-contratos" class="mt-6 w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
          <Save class="w-4 h-4" /> {{ saving ? 'Salvando...' : 'Salvar padrões do contrato' }}
        </button>
      </fieldset>
      <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200/80 h-fit">
        <h3 class="text-sm font-semibold text-slate-900 mb-1">Como fica no texto</h3>
        <p class="text-xs text-slate-500 mb-4">Trechos das cláusulas com os números acima (o resto do texto é o do modelo).</p>
        <ul class="space-y-2.5 text-sm text-slate-700" style="font-family: 'Times New Roman', serif" data-campo="previa-clausulas">
          <li v-for="(t, i) in previaClausulas()" :key="i" class="border-l-2 border-indigo-200 pl-3">… {{ t }} …</li>
        </ul>
      </div>
    </div>

    <div v-show="aba === 'empresa'" data-campo="config-empresa">
    <p v-if="!ehAdmin" class="mb-4 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
      Só o administrador altera estes dados. Aqui você vê os valores em uso.
    </p>
    <p class="text-xs text-slate-500 mb-4">O borderô, as promissórias e o contrato usam os dados da empresa escolhida no topo do Borderô. E-mail e representante só aparecem no contrato.</p>
    <fieldset :disabled="!ehAdmin" class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 disabled:opacity-90">
      <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200/80 h-fit">
        <div class="flex items-center gap-3 mb-5 text-sm text-slate-900 font-semibold border-b border-slate-100 pb-4">
          <span class="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100 flex items-center justify-center"><Building class="w-[18px] h-[18px]" /></span>
          <div>Fozesc<div class="text-xs font-normal text-slate-500">empresa dos contratos</div></div>
        </div>
        <div class="space-y-4" data-campo="empresa-fozesc">
                    <div><label class="block text-[13px] font-medium text-slate-700 mb-1.5">Nome</label><input v-model="config.nomeEmpresa" type="text" class="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" /></div>
          <div class="grid grid-cols-2 gap-4">
            <div><label class="block text-[13px] font-medium text-slate-700 mb-1.5">CNPJ</label><input v-model="config.cnpj" type="text" class="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" /><p v-if="!documentoValido(config.cnpj)" class="text-xs text-red-600 mt-1" data-campo="aviso-cnpj">CNPJ inválido: confira os dígitos</p></div>
            <div><label class="block text-[13px] font-medium text-slate-700 mb-1.5">Telefone</label><input v-model="config.telefone" type="text" class="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" /></div>
          </div>
          <div><label class="block text-[13px] font-medium text-slate-700 mb-1.5">Endereço</label><input v-model="config.endereco" type="text" class="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" /></div>
          <div><label class="block text-[13px] font-medium text-slate-700 mb-1.5">E-mail</label><input v-model="config.email" type="email" maxlength="100" data-campo="fozesc-email" class="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" /></div>
          <label class="flex items-center gap-2 text-sm text-slate-700"><input v-model="config.esc" type="checkbox" data-campo="fozesc-esc" class="w-4 h-4 rounded border-slate-300 text-indigo-600" /> É Empresa Simples de Crédito (ESC)</label>
          <details class="rounded-lg border border-slate-200 px-3 py-2" data-campo="fozesc-representante">
            <summary class="cursor-pointer text-sm font-medium text-slate-700">Representante legal <span class="text-xs font-normal text-slate-500">· para os contratos</span></summary>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <div class="md:col-span-2"><label class="block text-xs font-medium text-slate-600 mb-1">Nome</label><input v-model="config.repNome" type="text" maxlength="100" data-campo="fozesc-repNome" class="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" /></div>
              <div class=""><label class="block text-xs font-medium text-slate-600 mb-1">CPF</label><input v-model="config.repCpf" type="text" maxlength="20" data-campo="fozesc-repCpf" class="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" /><p v-if="!documentoValido(config.repCpf)" class="text-xs text-red-600 mt-1" data-campo="aviso-repCpf">CPF inválido: confira os dígitos</p></div>
              <div class=""><label class="block text-xs font-medium text-slate-600 mb-1">RG / órgão emissor</label><input v-model="config.repRg" type="text" maxlength="30" data-campo="fozesc-repRg" class="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" /></div>
              <div class=""><label class="block text-xs font-medium text-slate-600 mb-1">Nacionalidade</label><input v-model="config.repNacionalidade" type="text" maxlength="50" data-campo="fozesc-repNacionalidade" class="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" /></div>
              <div class=""><label class="block text-xs font-medium text-slate-600 mb-1">Estado civil</label><input v-model="config.repEstadoCivil" type="text" maxlength="30" data-campo="fozesc-repEstadoCivil" class="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" /></div>
              <div class="md:col-span-2"><label class="block text-xs font-medium text-slate-600 mb-1">Endereço</label><input v-model="config.repEndereco" type="text" maxlength="200" data-campo="fozesc-repEndereco" class="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" /></div>
            </div>
          </details>
        </div>
      </div>
      <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200/80 h-fit">
        <div class="flex items-center gap-3 mb-5 text-sm text-slate-900 font-semibold border-b border-slate-100 pb-4">
          <span class="w-9 h-9 rounded-lg bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-100 flex items-center justify-center"><Building class="w-[18px] h-[18px]" /></span>
          <div>PQ<div class="text-xs font-normal text-slate-500">empresa do dia a dia (padrão no borderô)</div></div>
        </div>
        <div class="space-y-4" data-campo="empresa-pq">
                    <div><label for="pq-nome" class="block text-[13px] font-medium text-slate-700 mb-1.5">Nome</label><input id="pq-nome" v-model="config.pqNome" type="text" maxlength="100" class="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" /></div>
          <div class="grid grid-cols-2 gap-4">
            <div><label for="pq-cnpj" class="block text-[13px] font-medium text-slate-700 mb-1.5">CNPJ</label><input id="pq-cnpj" v-model="config.pqCnpj" type="text" maxlength="20" class="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" /><p v-if="!documentoValido(config.pqCnpj)" class="text-xs text-red-600 mt-1" data-campo="aviso-pqCnpj">CNPJ inválido: confira os dígitos</p></div>
            <div><label class="block text-[13px] font-medium text-slate-700 mb-1.5">Telefone</label><input v-model="config.pqTelefone" type="text" maxlength="20" data-campo="pq-telefone" class="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" /></div>
          </div>
          <div><label for="pq-endereco" class="block text-[13px] font-medium text-slate-700 mb-1.5">Endereço</label><input id="pq-endereco" v-model="config.pqEndereco" type="text" maxlength="200" class="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" /></div>
          <div><label class="block text-[13px] font-medium text-slate-700 mb-1.5">E-mail</label><input v-model="config.pqEmail" type="email" maxlength="100" data-campo="pq-email" class="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" /></div>
          <label class="flex items-center gap-2 text-sm text-slate-700"><input v-model="config.pqEsc" type="checkbox" data-campo="pq-esc" class="w-4 h-4 rounded border-slate-300 text-indigo-600" /> É Empresa Simples de Crédito (ESC)</label>
          <details class="rounded-lg border border-slate-200 px-3 py-2" data-campo="pq-representante">
            <summary class="cursor-pointer text-sm font-medium text-slate-700">Representante legal <span class="text-xs font-normal text-slate-500">· para os contratos</span></summary>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <div class="md:col-span-2"><label class="block text-xs font-medium text-slate-600 mb-1">Nome</label><input v-model="config.pqRepNome" type="text" maxlength="100" data-campo="pq-repNome" class="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" /></div>
              <div class=""><label class="block text-xs font-medium text-slate-600 mb-1">CPF</label><input v-model="config.pqRepCpf" type="text" maxlength="20" data-campo="pq-repCpf" class="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" /><p v-if="!documentoValido(config.pqRepCpf)" class="text-xs text-red-600 mt-1" data-campo="aviso-pqRepCpf">CPF inválido: confira os dígitos</p></div>
              <div class=""><label class="block text-xs font-medium text-slate-600 mb-1">RG / órgão emissor</label><input v-model="config.pqRepRg" type="text" maxlength="30" data-campo="pq-repRg" class="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" /></div>
              <div class=""><label class="block text-xs font-medium text-slate-600 mb-1">Nacionalidade</label><input v-model="config.pqRepNacionalidade" type="text" maxlength="50" data-campo="pq-repNacionalidade" class="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" /></div>
              <div class=""><label class="block text-xs font-medium text-slate-600 mb-1">Estado civil</label><input v-model="config.pqRepEstadoCivil" type="text" maxlength="30" data-campo="pq-repEstadoCivil" class="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" /></div>
              <div class="md:col-span-2"><label class="block text-xs font-medium text-slate-600 mb-1">Endereço</label><input v-model="config.pqRepEndereco" type="text" maxlength="200" data-campo="pq-repEndereco" class="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" /></div>
            </div>
          </details>
        </div>
      </div>
    </fieldset>
    <button v-if="ehAdmin" @click="salvarConfig" :disabled="saving" data-campo="salvar-empresas" class="w-full md:w-auto md:min-w-72 bg-indigo-600 text-white font-semibold text-sm py-2.5 px-6 rounded-lg shadow-xs ring-1 ring-inset ring-white/10 hover:bg-indigo-700 disabled:opacity-60 transition-all flex items-center justify-center gap-2">
      <Save v-if="!saving" class="w-4 h-4" /> {{ saving ? 'Salvando...' : 'Salvar dados das empresas' }}
    </button>
    </div>

    <div v-show="aba === 'taxas'" data-campo="config-taxas">
    <p v-if="!ehAdmin" class="mb-4 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
      Só o administrador altera estes dados. Aqui você vê os valores em uso.
    </p>
    <fieldset :disabled="!ehAdmin" class="max-w-2xl mb-6 disabled:opacity-90">
        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200/80">
          <div class="flex items-center gap-3 mb-5 text-sm text-slate-900 font-semibold border-b border-slate-100 pb-4">
            <span class="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100 flex items-center justify-center"><Percent class="w-[18px] h-[18px]" /></span> Taxas e automação
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Taxa Padrão (% a.m.)</label>
              <div class="relative"><input v-model="config.taxaPadrao" type="number" step="0.01" class="w-full pl-4 py-2 bg-white border border-slate-300 rounded-lg outline-none font-bold text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 shadow-xs transition-shadow" /><span class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">%</span></div>
            </div>
            <div>
              <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Dias Compensação</label>
              <input v-model="config.diasCompensacaoPadrao" type="number" class="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg outline-none font-bold text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 shadow-xs transition-shadow" />
            </div>
            
            <div>
              <label class="block text-[13px] font-medium text-slate-700 mb-1.5" title="Imposto sobre Operações Financeiras">IOF Base (%)</label>
              <input v-model="config.iof_rate" type="number" step="0.01" class="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg outline-none font-bold text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 shadow-xs transition-shadow" />
            </div>
            <div>
              <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Multa Devolução (%)</label>
              <input v-model="config.fine_rate" type="number" step="0.01" class="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg outline-none font-bold text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 shadow-xs transition-shadow" />
            </div>
             <div class="col-span-2">
              <label class="block text-[13px] font-medium text-slate-700 mb-1.5">Taxa de Prorrogação (% a.m.)</label>
              <input v-model="config.extension_rate" type="number" step="0.01" class="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg outline-none font-bold text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 shadow-xs transition-shadow" />
              <p class="text-xs text-slate-500 mt-1.5">Usado automaticamente ao prorrogar títulos.</p>
            </div>
          </div>
        </div>
    </fieldset>
    <button v-if="ehAdmin" @click="salvarConfig" :disabled="saving" data-campo="salvar-taxas" class="w-full md:w-auto md:min-w-72 bg-indigo-600 text-white font-semibold text-sm py-2.5 px-6 rounded-lg shadow-xs ring-1 ring-inset ring-white/10 hover:bg-indigo-700 disabled:opacity-60 transition-all flex items-center justify-center gap-2">
      <Save v-if="!saving" class="w-4 h-4" /> {{ saving ? 'Salvando...' : 'Salvar taxas' }}
    </button>
    </div>

    <div v-if="ehAdmin" v-show="aba === 'equipe'" data-campo="config-equipe">
    <div v-if="ehAdmin" class="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
      <div class="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100 flex items-center justify-center"><Users class="w-[18px] h-[18px]" /></div>
          <div>
            <h3 class="text-sm font-semibold text-slate-900">Equipe e acesso</h3>
            <p class="text-xs text-slate-500">Gerencie quem pode acessar o sistema.</p>
          </div>
        </div>
        <button @click="openUserModal()" class="bg-indigo-600 hover:bg-indigo-700 text-white h-9 px-3.5 rounded-lg font-semibold shadow-xs ring-1 ring-inset ring-white/10 flex items-center transition-colors text-sm">
          <Plus class="w-4 h-4 mr-2" /> Novo usuário
        </button>
      </div>

      <table class="w-full text-left">
        <thead class="bg-slate-50/80 text-slate-500 text-xs font-medium border-b border-slate-200">
          <tr>
            <th class="px-4 py-2.5">Usuário</th>
            <th class="px-4 py-2.5">Email</th>
            <th class="px-4 py-2.5">Nível</th>
            <th class="px-4 py-2.5 text-right">Ações</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="users.length === 0">
            <td colspan="4" class="px-6 py-8 text-center text-slate-400">Nenhum usuário cadastrado.</td>
          </tr>
          <tr v-for="user in users" :key="user.id" class="hover:bg-slate-50 transition-colors">
            <td class="px-4 py-3 font-medium text-slate-900 text-sm flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold text-xs">
                {{ user.name.charAt(0).toUpperCase() }}
              </div>
              {{ user.name }}
            </td>
            <td class="px-4 py-2.5 text-slate-600 text-sm">{{ user.email }}</td>
            <td class="px-4 py-2.5">
              <span class="px-2 py-0.5 rounded-md text-xs font-medium border"
                :class="{
                  'bg-purple-50 text-purple-700 border-purple-200': user.role === 'Admin',
                  'bg-blue-50 text-blue-700 border-blue-200': user.role === 'Gerente',
                  'bg-slate-50 text-slate-600 border-slate-200': user.role === 'Operador'
                }">
                {{ user.role }}
              </span>
            </td>
            <td class="px-4 py-2.5 text-right">
              <div class="flex justify-end gap-2">
                <button @click="openUserModal(user)" class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"><Edit2 class="w-4 h-4" /></button>
                <button @click="deleteUser(user.id)" class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"><Trash2 class="w-4 h-4" /></button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    </div>

  </DashboardLayout>
</template>

<style scoped>
.animate-scale-in { animation: scaleIn 0.2s ease-out; }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
</style>