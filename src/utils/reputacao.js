// Reputacao do cliente (calculada no servidor, client_service.estatisticas): cor de cada nivel
// e as linhas que explicam a nota, na ordem da melhor para a pior.
export const COR_REPUTACAO = {
  'Excelente': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Bom': 'bg-teal-50 text-teal-700 border-teal-200',
  'Regular': 'bg-amber-50 text-amber-800 border-amber-200',
  'Ruim': 'bg-red-50 text-red-700 border-red-200',
  'Sem histórico': 'bg-slate-50 text-slate-600 border-slate-200',
};

export const TEXTO_REPUTACAO = {
  'Excelente': 'text-emerald-700', 'Bom': 'text-teal-700', 'Regular': 'text-amber-800', 'Ruim': 'text-red-700',
  'Sem histórico': 'text-slate-500',
};

// faixas do medidor de 0 a 100: as mesmas notas de corte do servidor (client_service._reputacao)
export const FAIXAS_REPUTACAO = [
  { de: 0, ate: 50, nivel: 'Ruim', cor: '#ef4444' },
  { de: 50, ate: 75, nivel: 'Regular', cor: '#f59e0b' },
  { de: 75, ate: 90, nivel: 'Bom', cor: '#14b8a6' },
  { de: 90, ate: 100, nivel: 'Excelente', cor: '#10b981' },
];

export const LINHAS_REPUTACAO = [
  { id: 'em_dia', nome: 'Pagos em dia', cor: 'text-emerald-700' },
  { id: 'prorrogado', nome: 'Prorrogados e pagos', cor: 'text-teal-700' },
  { id: 'atrasado', nome: 'Pagos com atraso', cor: 'text-amber-700' },
  { id: 'devolvido_pago', nome: 'Devolvidos e depois pagos', cor: 'text-orange-700' },
  { id: 'vencido', nome: 'Vencidos sem pagar', cor: 'text-red-700' },
  { id: 'devolvido', nome: 'Devolvidos em aberto', cor: 'text-red-700' },
  { id: 'juridico', nome: 'No jurídico', cor: 'text-purple-700' },
];

export const REGRA_REPUTACAO = 'Nota de 0 a 100 pelos títulos que já venceram, pesando pelo valor: pago em dia vale 100, '
  + 'prorrogado 70, pago com atraso 50, devolvido e depois pago 40, vencido sem pagar 20, devolvido ou jurídico 0. '
  + 'Até 3 dias depois do vencimento ainda conta como em dia (compensação). Com menos de 3 títulos vencidos fica '
  + '"Sem histórico". Com devolvido ou jurídico em aberto, não passa de Regular.';
