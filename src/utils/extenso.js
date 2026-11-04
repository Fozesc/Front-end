// Valor em reais por extenso, para promissoria: 1234,56 -> "mil duzentos e trinta e quatro reais e
// cinquenta e seis centavos". Conta em centavos inteiros (sem erro de ponto flutuante).
const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze',
  'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos',
  'oitocentos', 'novecentos'];
const ESCALAS = [null, ['mil', 'mil'], ['milhão', 'milhões'], ['bilhão', 'bilhões']];

const ate999 = (n) => {
  if (n === 100) return 'cem';
  const resto = n % 100;
  const partes = [CENTENAS[Math.floor(n / 100)]];
  if (resto < 20) partes.push(UNIDADES[resto]);
  else partes.push(DEZENAS[Math.floor(resto / 10)] + (resto % 10 ? ` e ${UNIDADES[resto % 10]}` : ''));
  return partes.filter(Boolean).join(' e ');
};

const inteiro = (n) => {
  const grupos = [];
  for (let i = 0; n > 0; i++, n = Math.floor(n / 1000)) if (n % 1000) grupos.unshift([n % 1000, i]);
  return grupos.map(([g, i], k) => {
    const nome = i === 0 ? ate999(g) : i === 1 && g === 1 ? 'mil' : `${ate999(g)} ${ESCALAS[i][g === 1 ? 0 : 1]}`;
    // "e" antes do ultimo grupo quando ele e' menor que 100 ou centena redonda: "mil e cem", "mil e um"
    const ultimo = k === grupos.length - 1 && k > 0;
    return (k === 0 ? '' : ultimo && (g < 100 || g % 100 === 0) ? ' e ' : ' ') + nome;
  }).join('');
};

// numero inteiro por extenso: 2026 -> "dois mil e vinte e seis"
export const numeroPorExtenso = (n) => (Number(n) ? inteiro(Math.floor(Math.abs(Number(n)))) : 'zero');

export function valorPorExtenso(valor) {
  const centavos = Math.round(Math.abs(Number(valor) || 0) * 100);
  const reais = Math.floor(centavos / 100), cent = centavos % 100;
  if (!reais && !cent) return 'zero real';
  const partes = [];
  if (reais) partes.push(`${inteiro(reais)}${reais % 1000000 === 0 ? ' de' : ''} ${reais === 1 ? 'real' : 'reais'}`);
  if (cent) partes.push(`${ate999(cent)} ${cent === 1 ? 'centavo' : 'centavos'}`);
  return partes.join(' e ');
}

// 1 -> "um por cento"; 1.5 -> "um vírgula cinco por cento" (texto das clausulas do contrato)
export function percentualPorExtenso(valor) {
  const [inteiro, decimais = ''] = Number(valor || 0).toFixed(2).replace(/0+$/, '').replace(/\.$/, '').split('.');
  const parte = numeroPorExtenso(Number(inteiro));
  if (!decimais) return `${parte} por cento`;
  const zeros = decimais.match(/^0*/)[0].length;
  return `${parte} vírgula ${'zero '.repeat(zeros)}${numeroPorExtenso(Number(decimais))} por cento`;
}

// feminino para "vias": 2 -> "duas", 1 -> "uma", 22 -> "vinte e duas"
export const numeroFemininoPorExtenso = (n) => numeroPorExtenso(n).replace(/\bum\b/g, 'uma').replace(/\bdois\b/g, 'duas')
  .replace(/entos\b/g, 'entas');

