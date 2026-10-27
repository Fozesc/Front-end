// Mensagens do sistema no lugar do alert()/confirm() do navegador: avisos no canto da tela
// e uma pergunta que diz o que vai acontecer antes de confirmar. Quem mostra e' o Avisos.vue.
import { reactive } from 'vue';

export const avisos = reactive({ lista: [], pergunta: null });
let proximoId = 1;

// tipo: 'erro' (vermelho), 'ok' (verde) ou 'info'
export function avisar(texto, tipo = 'erro') {
  const id = proximoId++;
  avisos.lista.push({ id, texto, tipo });
  setTimeout(() => fecharAviso(id), tipo === 'erro' ? 7000 : 5000);
}

export function fecharAviso(id) {
  const i = avisos.lista.findIndex(a => a.id === id);
  if (i >= 0) avisos.lista.splice(i, 1);
}

// erro de uma chamada ao backend: a mensagem dele, ou a padrao da tela
export const avisarErro = (e, padrao) => avisar(e?.response?.data?.error || padrao);

// await confirmar({ titulo, mensagem, consequencias: [...], botao, perigo }) -> true/false
export function confirmar({ titulo, mensagem = '', consequencias = [], botao = 'Confirmar', perigo = false }) {
  avisos.pergunta?.responder(false);
  return new Promise((resolve) => {
    avisos.pergunta = {
      titulo, mensagem, consequencias, botao, perigo,
      responder: (sim) => { avisos.pergunta = null; resolve(sim); },
    };
  });
}
