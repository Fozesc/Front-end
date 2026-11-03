// Data AAAA-MM-DD no horario de quem esta usando (versao 2.11.3). toISOString() devolve a data em
// UTC: depois das 21h (Brasil) ja e' o dia seguinte - o borderô saia com a data de amanha e um dia
// a menos de juros. Usar sempre estas duas.
export const dataLocal = (d) => d.toLocaleDateString('en-CA');
export const hojeLocal = () => dataLocal(new Date());
export const somarDiasLocal = (dias, base = new Date()) => {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dias);
  return dataLocal(d);
};
