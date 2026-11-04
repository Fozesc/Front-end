// CPF/CNPJ com os digitos verificadores certos (igual ao servidor, app/utils/validacao.py). Aceita o CNPJ com
// letras da Receita (2026): cada caractere vale o codigo dele - 48. Vazio conta como valido (campo opcional).
const dvCnpj = (base) => {
  const pesos = [...Array(base.length - 8).keys()].map(i => base.length - 7 - i).concat([9, 8, 7, 6, 5, 4, 3, 2]);
  const soma = [...base].reduce((t, c, i) => t + (c.charCodeAt(0) - 48) * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? '0' : String(11 - resto);
};

export function documentoValido(texto) {
  const doc = String(texto || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  if (!doc) return true;
  if (/^\d{11}$/.test(doc)) {
    if (doc === doc[0].repeat(11)) return false;
    for (const n of [9, 10]) {
      const soma = [...doc.slice(0, n)].reduce((t, d, i) => t + Number(d) * (n + 1 - i), 0);
      if (Number(doc[n]) !== (soma * 10 % 11) % 10) return false;
    }
    return true;
  }
  if (/^[0-9A-Z]{12}\d{2}$/.test(doc)) {
    if (doc === doc[0].repeat(14)) return false;
    return dvCnpj(doc.slice(0, 12)) === doc[12] && dvCnpj(doc.slice(0, 13)) === doc[13];
  }
  return false;
}
