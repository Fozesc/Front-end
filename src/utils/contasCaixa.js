import { Banknote, Landmark, Building2 } from 'lucide-vue-next';

// As tres contas do caixa. O `id` e' o texto que o backend usa para saber em qual
// saldo o dinheiro entra - nao inventar valor novo aqui sem mexer no backend.
export const CONTAS = [
  { id: 'Dinheiro', nome: 'Dinheiro', curto: 'Dinheiro', sub: 'Cofre', icone: Banknote },
  { id: 'BB', nome: 'Banco do Brasil', curto: 'BB', sub: 'Conta BB', icone: Landmark },
  { id: 'Caixa', nome: 'Caixa Econômica', curto: 'Caixa', sub: 'Conta CEF', icone: Building2 }
];

// Formas que fazem sentido em cada conta (PIX no cofre nao existe).
export const FORMAS = {
  Dinheiro: ['Dinheiro', 'Outro'],
  BB: ['PIX', 'TED/DOC', 'Depósito', 'Cheque', 'Outro'],
  Caixa: ['PIX', 'TED/DOC', 'Depósito', 'Cheque', 'Outro']
};

// Classes escritas inteiras de proposito: o Tailwind so gera o que ele ve no codigo.
export const ESTILO = {
  Dinheiro: {
    barra: 'bg-emerald-500',
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    ativo: 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm',
    ponto: 'bg-emerald-500'
  },
  BB: {
    barra: 'bg-blue-500',
    chip: 'bg-blue-50 text-blue-700 border-blue-200',
    ativo: 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm',
    ponto: 'bg-blue-500'
  },
  Caixa: {
    barra: 'bg-sky-500',
    chip: 'bg-sky-50 text-sky-700 border-sky-200',
    ativo: 'border-sky-500 bg-sky-50 text-sky-700 shadow-sm',
    ponto: 'bg-sky-500'
  }
};

export const arred = (v) => Math.round((Number(v) || 0) * 100) / 100;
export const somaPartes = (partes) => arred(partes.reduce((t, p) => t + (Number(p.valor) || 0), 0));
// a soma das partes tem que fechar com o valor (o backend confere de novo)
export const partesFecham = (partes, total) =>
  partes.length > 0 && partes.every(p => (Number(p.valor) || 0) > 0) &&
  Math.abs(arred(total) - somaPartes(partes)) < 0.005;
export const partesParaEnviar = (partes) => partes.map(p => ({ conta: p.conta, forma: p.forma, valor: arred(p.valor) }));
