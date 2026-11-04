// Sessao do login guardada no navegador. O token JWT traz a hora em que vence (`exp`): conferir
// antes de abrir cada tela evita a pessoa montar um borderô inteiro e perder tudo no Efetivar.
const CHAVE_AVISO = 'fozesc_aviso_login';

export const lerSessao = () => {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
};

// apagar borderô, cliente, titulo, lancamento do caixa e vale: so o Admin (o servidor tambem barra)
export const ehAdmin = () => lerSessao()?.role === 'Admin';

// segundos desde 1970 em que o login vence (null se nao der para ler)
export const venceEm = (token) => {
  try {
    const parte = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(parte.padEnd(parte.length + (4 - parte.length % 4) % 4, '='))).exp || null;
  } catch { return null; }
};

export const sessaoVencida = (sessao, agora = Date.now()) => {
  if (!sessao?.token) return true;
  const exp = venceEm(sessao.token);
  return exp !== null && exp * 1000 <= agora;
};

export const encerrarSessao = (aviso) => {
  localStorage.removeItem('user');
  try { if (aviso) sessionStorage.setItem(CHAVE_AVISO, aviso); } catch { /* aba anonima */ }
};

export const lerAvisoLogin = () => {
  try {
    const aviso = sessionStorage.getItem(CHAVE_AVISO);
    sessionStorage.removeItem(CHAVE_AVISO);
    return aviso;
  } catch { return null; }
};
