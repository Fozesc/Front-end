// Calculo do borderô num lugar so: o BorderoView e a prorrogacao usam estas mesmas
// funcoes, entao os dois nunca divergem. As expressoes foram movidas do BorderoView
// sem mudar a ordem das contas (ponto flutuante: a ordem muda o centavo).

export const IOF_BASE_PADRAO = 0.38;
export const IOF_DIARIO_PADRAO = 0.0041;
export const DIAS_COMPENSACAO_PADRAO = 2;

export const arredondar = (valor) => Math.round((valor + Number.EPSILON) * 100) / 100;

const getDataLimpa = (dataStr) => {
  if (!dataStr) return null;
  const [ano, mes, dia] = dataStr.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0));
};

export const calcularDias = (dataBase, dataVencimento, diasComp) => {
  if (!dataBase || !dataVencimento) return 0;
  const d1 = getDataLimpa(dataBase);
  const d2 = getDataLimpa(dataVencimento);
  const diffTime = d2.getTime() - d1.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + Number(diasComp);
};

// Mesma resolucao de campos que o borderô sempre usou para as taxas de IOF.
export const iofDasConfiguracoes = (data) => ({
  iofBase: Number(data.iof_base || data.iof_rate || data.iof_base_rate || IOF_BASE_PADRAO),
  iofDiario: Number(data.iof_daily || data.iof_daily_rate || IOF_DIARIO_PADRAO),
});

// Borderô padrao (bruto -> liquido): juros e IOF de um titulo de valor de face `valor`.
export const calcularLinha = ({ valor, dias, taxaMensal, iofEnabled, iofBase, iofDiario }) => {
  if (!valor || dias <= 0) {
    return { juros: 0, iof: 0, liquido: Number(valor) || 0 };
  }

  const valorFace = Number(valor);
  const taxaDecimal = Number(taxaMensal) / 100;
  const totalMes = dias / 30.0;

  const fator = Math.pow(1 + taxaDecimal, totalMes);
  const jurosCalculado = valorFace * (fator - 1);

  let iofCalculado = 0;
  if (iofEnabled) {
    const calcBase = valorFace * (iofBase / 100);
    const calcDiario = valorFace * (iofDiario / 100) * dias;
    iofCalculado = calcBase + calcDiario;
  }

  const juros = arredondar(jurosCalculado);
  const iof = arredondar(iofCalculado);
  return { juros, iof, liquido: arredondar(valorFace - juros - iof) };
};

// Borderô de Liquido (Inverso): quanto de valor de face rende 1 real de liquido numa
// data. Valor de face = liquido / soma dos divisores. Divisor <= 0 = prazo longo
// demais para a conta inversa fechar.
export const divisorInverso = ({ dias, taxaMensal, iofEnabled, iofBase, iofDiario }) => {
  const taxaDecimal = Number(taxaMensal) / 100;
  const iofBaseDecimal = iofEnabled ? (iofBase / 100) : 0;
  const iofDiarioDecimal = iofEnabled ? (iofDiario / 100) : 0;
  const tempoMeses = dias / 30.0;
  const fator = Math.pow(1 + taxaDecimal, tempoMeses);
  const iofCompleto = iofBaseDecimal + (iofDiarioDecimal * dias);
  return 2 - fator - iofCompleto;
};

// Tela de prorrogacao.
// 1. juros desta prorrogacao = Borderô de Liquido (Inverso) sobre o saldo devido: o saldo
//    e' o "liquido" e o valor de face na nova data e' saldo + juros;
// 2. o pagamento quita primeiro esses juros e o que passar abate o saldo; se nao cobrir
//    os juros, a diferenca soma no valor devido;
// 3. sem valor digitado, o cliente paga exatamente os juros (o saldo fica igual).
// O backend (check_service.prorrogate_check) refaz o passo 2 e confere o resto.
export const calcularProrrogacao = ({
  valorAnterior, pago = null, saldoManual = null,
  prorrogar = true, dataBase, novaData, taxaMensal, diasCompensacao,
  iofEnabled, iofBase, iofDiario, jurosManual = null
}) => {
  const total = arredondar(Number(valorAnterior) || 0);
  const saldoBase = saldoManual !== null ? arredondar(saldoManual) : total;

  const dias = calcularDias(dataBase, novaData, diasCompensacao);
  const params = { dias, taxaMensal, iofEnabled, iofBase, iofDiario };
  const divisor = divisorInverso(params);
  let calculado = { encargos: 0, juros: 0, iof: 0 };
  if (prorrogar && novaData && dias > 0 && divisor > 0 && saldoBase > 0) {
    const face = arredondar(saldoBase / divisor);
    const { juros } = calcularLinha({ valor: face, ...params });
    const encargos = arredondar(face - saldoBase);
    calculado = { encargos, juros, iof: arredondar(encargos - juros) };
  }
  const juros = !prorrogar ? 0 : (jurosManual !== null ? arredondar(jurosManual) : calculado.encargos);
  const totalComJuros = arredondar(saldoBase + juros);

  const valorPago = pago === null ? juros : arredondar(Number(pago) || 0);
  const jurosPagos = Math.min(valorPago, juros);
  return {
    total, saldoBase, ajuste: arredondar(saldoBase - total),
    dias, divisor, calculado, juros, totalComJuros,
    pago: valorPago, jurosPagos,
    abatido: arredondar(valorPago - jurosPagos),
    jurosNaoPagos: arredondar(juros - jurosPagos),
    novoTotal: arredondar(totalComJuros - valorPago)
  };
};
