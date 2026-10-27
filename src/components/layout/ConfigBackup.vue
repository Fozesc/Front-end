<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { Mail, Plus, Trash2, CalendarClock, KeyRound, Save, Loader2, AlertTriangle, CircleCheck, CircleAlert, Info, Database, FileSpreadsheet, FileText, ShieldCheck } from 'lucide-vue-next';
import settingsService from '../../services/settingsService';
import { avisar } from '../../utils/avisos';

const MAX_EMAILS = 20;
const FREQUENCIAS = [
  { valor: 'diario', nome: 'Todo dia útil' },
  { valor: 'semanal', nome: 'Toda semana' },
  { valor: 'mensal', nome: 'Todo mês' },
  { valor: 'desligado', nome: 'Não enviar' },
];
const ARQUIVOS = [
  { campo: 'freq_relatorio', nome: 'Relatório PDF', sub: 'Resumo do movimento do período: caixa, borderôs, recebimentos, vales.', icone: FileText },
  { campo: 'freq_planilha', nome: 'Planilha', sub: 'Todos os dados, uma aba por assunto (títulos, clientes, caixa...).', icone: FileSpreadsheet },
  { campo: 'freq_banco', nome: 'Cópia do banco', sub: 'O sistema inteiro, para restaurar. Só vai para quem estiver marcado.', icone: Database },
];

const carregando = ref(true);
const erroCarga = ref('');
const cfg = reactive({ destinatarios: [], freq_banco: 'diario', freq_planilha: 'semanal', freq_relatorio: 'mensal', tem_senha: false, configurado: false, ultimo_envio: null });
const novoEmail = ref('');
const erroEmail = ref('');
const senha = reactive({ nova: '', repetir: '' });
const confirmar = reactive({ visivel: false, senha: '', erro: '', salvando: false });

const carregar = async () => {
  erroCarga.value = '';
  try {
    Object.assign(cfg, await settingsService.getBackup());
  } catch (e) {
    erroCarga.value = e.response?.data?.error || 'Não foi possível carregar a configuração do backup.';
  } finally {
    carregando.value = false;
  }
};
onMounted(carregar);

const adicionar = () => {
  const email = novoEmail.value.trim().toLowerCase();
  erroEmail.value = '';
  if (!/^[^@\s,;<>"]+@[^@\s,;<>"]+\.[^@\s,;<>".]+$/.test(email)) return (erroEmail.value = 'Digite um e-mail válido.');
  if (cfg.destinatarios.some(d => d.email === email)) return (erroEmail.value = 'Esse e-mail já está na lista.');
  if (cfg.destinatarios.length >= MAX_EMAILS) return (erroEmail.value = `No máximo ${MAX_EMAILS} e-mails.`);
  cfg.destinatarios.push({ email, banco: false });
  novoEmail.value = '';
};
const retirar = (i) => cfg.destinatarios.splice(i, 1);

const ninguemComBanco = computed(() => cfg.freq_banco !== 'desligado' && cfg.destinatarios.length && !cfg.destinatarios.some(d => d.banco));
const erroSenha = computed(() => {
  if (!senha.nova && !senha.repetir) return '';
  if (senha.nova.length < 12) return 'A senha precisa ter pelo menos 12 caracteres.';
  if (senha.nova.length > 64) return 'A senha pode ter no máximo 64 caracteres.';
  if (senha.nova !== senha.repetir) return 'As duas senhas não são iguais.';
  return '';
});
const ultimo = computed(() => {
  const u = cfg.ultimo_envio;
  if (!u) return null;
  const [data, hora] = u.quando.split(' ');
  return { ...u, quando: `${data.split('-').reverse().join('/')} às ${hora}` };
});

const pedirSenha = () => {
  if (erroSenha.value) return avisar(erroSenha.value);
  if (novoEmail.value.trim()) return avisar('Clique em "Adicionar" no e-mail digitado ou apague o campo antes de salvar.');
  Object.assign(confirmar, { visivel: true, senha: '', erro: '', salvando: false });
};

const salvar = async () => {
  if (!confirmar.senha) return (confirmar.erro = 'Digite sua senha para confirmar.');
  confirmar.salvando = true;
  confirmar.erro = '';
  try {
    const salvo = await settingsService.updateBackup({
      senha_login: confirmar.senha,
      destinatarios: cfg.destinatarios,
      freq_banco: cfg.freq_banco,
      freq_planilha: cfg.freq_planilha,
      freq_relatorio: cfg.freq_relatorio,
      senha_arquivos: senha.nova,
    });
    Object.assign(cfg, salvo);
    senha.nova = senha.repetir = '';
    confirmar.visivel = false;
    avisar('Configuração do backup salva. Vale a partir do próximo envio, às 15h.', 'ok');
  } catch (e) {
    confirmar.erro = e.response?.data?.error || 'Não foi possível salvar.';
  } finally {
    confirmar.salvando = false;
  }
};
</script>

<template>
  <div v-if="carregando" class="text-center py-16 text-slate-400 flex flex-col items-center">
    <Loader2 class="w-8 h-8 animate-spin mb-2 text-indigo-500" /> Carregando...
  </div>
  <p v-else-if="erroCarga" class="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-4">
    <AlertTriangle class="w-4 h-4 shrink-0" /> {{ erroCarga }}
  </p>

  <div v-else class="space-y-6">
    <p v-if="!cfg.configurado" class="flex items-start gap-2 text-sm text-indigo-900 bg-indigo-50 border border-indigo-100 rounded-xl p-4">
      <Info class="w-4 h-4 mt-0.5 shrink-0 text-indigo-600" />
      Ainda não foi salvo aqui. Até salvar, o servidor continua mandando para os e-mails e com a senha que estão no .env dele.
    </p>

    <div v-if="ultimo" class="flex items-start gap-3 text-sm rounded-xl p-4 border"
         :class="ultimo.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'">
      <CircleCheck v-if="ultimo.ok" class="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
      <CircleAlert v-else class="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
      <div>
        <div class="font-semibold">Último envio: {{ ultimo.quando }} — {{ ultimo.ok ? 'chegou' : 'falhou' }}</div>
        <div class="text-xs mt-0.5 opacity-80 break-words">{{ ultimo.texto }}</div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden h-fit">
        <div class="px-6 py-4 border-b border-slate-200 flex items-center gap-3">
          <span class="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100 flex items-center justify-center"><Mail class="w-[18px] h-[18px]" /></span>
          <div>
            <h3 class="text-sm font-semibold text-slate-900">Quem recebe</h3>
            <p class="text-xs text-slate-500">Relatório e planilha vão para todos. A cópia do banco, só para quem você marcar.</p>
          </div>
        </div>

        <ul class="divide-y divide-slate-100">
          <li v-if="!cfg.destinatarios.length" class="px-6 py-8 text-center text-slate-400 text-sm">Ninguém na lista: o e-mail do backup fica desligado.</li>
          <li v-for="(d, i) in cfg.destinatarios" :key="d.email" class="px-6 py-3 flex items-center gap-3">
            <span class="flex-1 min-w-0 text-sm text-slate-800 truncate" :title="d.email">{{ d.email }}</span>
            <label class="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none shrink-0">
              <input v-model="d.banco" type="checkbox" class="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/30" />
              Recebe o banco
            </label>
            <button @click="retirar(i)" :aria-label="`Retirar ${d.email}`" class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors shrink-0"><Trash2 class="w-4 h-4" /></button>
          </li>
        </ul>

        <div class="px-6 py-4 bg-slate-50/70 border-t border-slate-200">
          <div class="flex gap-2">
            <input v-model="novoEmail" type="email" aria-label="Novo e-mail" placeholder="email@exemplo.com" maxlength="120" @keyup.enter="adicionar" @input="erroEmail = ''"
                   class="flex-1 min-w-0 px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" />
            <button @click="adicionar" class="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 h-9 px-3.5 rounded-lg text-sm font-semibold shadow-xs flex items-center gap-2 transition-colors shrink-0">
              <Plus class="w-4 h-4" /> Adicionar
            </button>
          </div>
          <p v-if="erroEmail" class="text-xs text-red-600 font-medium mt-1.5">{{ erroEmail }}</p>
          <p v-if="ninguemComBanco" class="flex items-start gap-2 text-xs text-amber-800 mt-2">
            <AlertTriangle class="w-3.5 h-3.5 mt-0.5 shrink-0" /> Ninguém marcado para receber o banco: a cópia do banco não vai sair por e-mail.
          </p>
        </div>
      </div>

      <div class="space-y-6">
        <div class="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div class="px-6 py-4 border-b border-slate-200 flex items-center gap-3">
            <span class="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100 flex items-center justify-center"><CalendarClock class="w-[18px] h-[18px]" /></span>
            <div>
              <h3 class="text-sm font-semibold text-slate-900">O que vai e quando</h3>
              <p class="text-xs text-slate-500">Sempre às 15h, só em dia útil.</p>
            </div>
          </div>
          <div class="divide-y divide-slate-100">
            <div v-for="a in ARQUIVOS" :key="a.campo" class="px-6 py-3.5 flex items-center gap-3">
              <component :is="a.icone" class="w-4 h-4 text-slate-400 shrink-0" />
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-slate-800">{{ a.nome }}</div>
                <div class="text-xs text-slate-500">{{ a.sub }}</div>
              </div>
              <select v-model="cfg[a.campo]" :aria-label="`Frequência: ${a.nome}`"
                      class="px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none text-sm font-medium text-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs shrink-0">
                <option v-for="f in FREQUENCIAS" :key="f.valor" :value="f.valor">{{ f.nome }}</option>
              </select>
            </div>
          </div>
          <p class="px-6 py-3 bg-slate-50/70 border-t border-slate-200 text-xs text-slate-500 leading-relaxed">
            <strong class="font-semibold text-slate-600">Toda semana</strong>: no último dia útil da semana (e no último do mês).
            <strong class="font-semibold text-slate-600">Todo mês</strong>: no último dia útil do mês. No fim do mês o relatório cobre o mês inteiro; nos outros dias, desde o último relatório.
          </p>
        </div>

        <div class="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div class="px-6 py-4 border-b border-slate-200 flex items-center gap-3">
            <span class="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100 flex items-center justify-center"><KeyRound class="w-[18px] h-[18px]" /></span>
            <div>
              <h3 class="text-sm font-semibold text-slate-900">Senha dos arquivos</h3>
              <p class="text-xs text-slate-500">A senha que abre o PDF, a planilha e a cópia do banco.</p>
            </div>
          </div>
          <div class="px-6 py-4 space-y-3">
            <p class="flex items-center gap-2 text-sm" :class="cfg.tem_senha ? 'text-emerald-700' : 'text-slate-500'">
              <ShieldCheck class="w-4 h-4 shrink-0" />
              {{ cfg.tem_senha ? 'Senha definida aqui. Por segurança ela não aparece; para trocar, digite uma nova.' : 'Ainda não definida aqui: vale a senha que está no servidor.' }}
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label for="backup-senha-nova" class="block text-[13px] font-medium text-slate-700 mb-1.5">Nova senha</label>
                <input id="backup-senha-nova" v-model="senha.nova" type="password" autocomplete="new-password" maxlength="64" placeholder="Mínimo 12 caracteres"
                       class="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" />
              </div>
              <div>
                <label for="backup-senha-repetir" class="block text-[13px] font-medium text-slate-700 mb-1.5">Repita a nova senha</label>
                <input id="backup-senha-repetir" v-model="senha.repetir" type="password" autocomplete="new-password" maxlength="64"
                       class="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" />
              </div>
            </div>
            <p v-if="erroSenha" class="text-xs text-red-600 font-medium">{{ erroSenha }}</p>
            <p v-if="senha.nova" class="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertTriangle class="w-4 h-4 shrink-0" />
              Os e-mails que já saíram continuam abrindo só com a senha antiga. Anote as duas fora do sistema e avise quem recebe.
            </p>
          </div>
        </div>
      </div>
    </div>

    <div class="flex justify-end">
      <button @click="pedirSenha" class="bg-indigo-600 hover:bg-indigo-700 text-white h-9 px-4 rounded-lg font-semibold shadow-xs ring-1 ring-inset ring-white/10 flex items-center gap-2 transition-colors text-sm">
        <Save class="w-4 h-4" /> Salvar backup
      </button>
    </div>
  </div>

  <div v-if="confirmar.visivel" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="confirmar.visivel = false"></div>
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm relative z-10 p-6">
      <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 text-indigo-600 mb-4">
        <KeyRound class="h-6 w-6" />
      </div>
      <h3 class="text-lg font-semibold text-slate-900 mb-1 text-center">Confirmar com sua senha</h3>
      <p class="text-slate-500 mb-4 text-sm text-center">Quem recebe o backup recebe os dados da empresa. Por isso essa mudança pede a sua senha de login.</p>
      <label for="backup-senha-login" class="block text-[13px] font-medium text-slate-700 mb-1.5">Sua senha</label>
      <input id="backup-senha-login" v-model="confirmar.senha" type="password" autocomplete="current-password" placeholder="Digite sua senha para confirmar" @keyup.enter="salvar"
             class="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg outline-none text-sm mb-2 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-xs transition-shadow" />
      <p v-if="confirmar.erro" class="text-xs text-red-600 font-medium mb-2">{{ confirmar.erro }}</p>
      <div class="flex gap-3 mt-4">
        <button @click="confirmar.visivel = false" class="flex-1 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg shadow-xs hover:bg-slate-50 transition-colors text-sm">Cancelar</button>
        <button @click="salvar" :disabled="confirmar.salvando" class="flex-1 px-4 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors shadow-xs text-sm">
          {{ confirmar.salvando ? 'Salvando...' : 'Salvar' }}
        </button>
      </div>
    </div>
  </div>
</template>
