// Calculadora das folhas (a mesma do Smaug): uma conta por linha, resultado ao lado.
//
//   capital = 10.000            -> variavel (usa depois como `capital`)
//   juros: capital * 4%         -> antes do ":" e' so rotulo
//   aluguel 1.200 + luz 237,50  -> palavras soltas sao ignoradas
//   @cliente.maria              -> valor puxado do sistema
//   soma                        -> soma tudo com resultado desde a ultima soma

// "Banco do Brasil" -> "banco_do_brasil": como nomes viram chaves de @ (o backend usa a mesma regra)
export function slug(texto) {
  return String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export const refKey = (raw) => raw.replace(/^@/, '').split('.').map(slug).join('.');

// pt-BR primeiro: "10.000,50", "10.000" (mil). Ponto sem grupo de 3 e' decimal: "4.99".
function numero(raw) {
  if (raw.includes(',')) return Number(raw.replace(/\./g, '').replace(',', '.'));
  if (/^\d{1,3}(\.\d{3})+$/.test(raw)) return Number(raw.replace(/\./g, ''));
  return Number(raw);
}

const TOKEN = /(@[\p{L}\p{N}_.]+)|(\d[\d.]*(?:,\d+)?)|([\p{L}_][\p{L}\p{N}_]*)|([-+*/×÷%()])/uy;
const SOMA = new Set(['soma', 'total']);

function tokens(texto, vars) {
  const lista = [];
  let i = 0;
  while (i < texto.length) {
    TOKEN.lastIndex = i;
    const m = TOKEN.exec(texto);
    if (!m) { i++; continue; } // espaco, "R$", ":" etc. - nao e' conta
    i = TOKEN.lastIndex;
    if (m[1]) lista.push({ t: 'ref', v: refKey(m[1].replace(/\.+$/, '')) });
    else if (m[2]) lista.push({ t: 'num', v: numero(m[2].replace(/\.$/, '')) });
    else if (m[3]) {
      const nome = slug(m[3]);
      // palavra que nao e' variavel nem "soma" e' texto: fica fora da conta
      if (nome in vars || SOMA.has(nome)) lista.push({ t: 'nome', v: nome });
    } else lista.push({ t: 'op', v: m[4] === '×' ? '*' : m[4] === '÷' ? '/' : m[4] });
  }
  return lista;
}

function calcular(lista, valorDe) {
  let pos = 0;
  const op = (v) => lista[pos]?.t === 'op' && lista[pos].v === v;
  const expr = () => {
    let v = termo();
    while (op('+') || op('-')) v = lista[pos++].v === '+' ? v + termo() : v - termo();
    return v;
  };
  const termo = () => {
    let v = unario();
    while (op('*') || op('/')) {
      const o = lista[pos++].v;
      const d = unario();
      if (o === '/' && d === 0) throw new Error('divisão por zero');
      v = o === '*' ? v * d : v / d;
    }
    return v;
  };
  const unario = () => {
    if (op('-')) { pos++; return -unario(); }
    if (op('+')) { pos++; return unario(); }
    let v = primario();
    if (op('%')) { pos++; v /= 100; }
    return v;
  };
  const primario = () => {
    const t = lista[pos++];
    if (!t) throw new Error('conta incompleta');
    if (t.t === 'op' && t.v === '(') {
      const v = expr();
      if (!op(')')) throw new Error('falta fechar o parêntese');
      pos++;
      return v;
    }
    if (t.t === 'op') throw new Error(`"${t.v}" fora do lugar`);
    return valorDe(t);
  };
  const v = expr();
  if (pos < lista.length) throw new Error('dois valores sem conta entre eles');
  return v;
}

// [{ tipo: 'vazio' } | { tipo: 'valor', valor } | { tipo: 'erro', msg }] - um por linha
export function calcularFolha(texto, refs) {
  const vars = {};
  let subtotal = 0;
  return texto.split('\n').map((linha) => {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith('#') || limpa.startsWith('//')) return { tipo: 'vazio' };
    let corpo = linha;
    let variavel;
    const atrib = linha.match(/^\s*([\p{L}_][\p{L}\p{N}_]*)\s*=(.*)$/u);
    if (atrib) { variavel = slug(atrib[1]); corpo = atrib[2]; }
    else if (linha.includes(':')) corpo = linha.slice(linha.indexOf(':') + 1);

    const lista = tokens(corpo, vars);
    if (!lista.some((t) => t.t !== 'op')) return { tipo: 'vazio' };
    let usouSoma = false;
    try {
      const valor = calcular(lista, (t) => {
        if (t.t === 'num') return t.v;
        if (t.t === 'ref') {
          if (!(t.v in refs)) throw new Error(`@${t.v} não existe`);
          return refs[t.v];
        }
        if (SOMA.has(t.v) && !(t.v in vars)) { usouSoma = true; return subtotal; }
        return vars[t.v];
      });
      if (!Number.isFinite(valor)) throw new Error('resultado inválido');
      if (variavel) vars[variavel] = valor;
      // a soma fecha um bloco: o proximo comeca do zero e nao conta esta
      subtotal = usouSoma ? 0 : subtotal + valor;
      return { tipo: 'valor', valor };
    } catch (e) {
      return { tipo: 'erro', msg: e.message };
    }
  });
}
