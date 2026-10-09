// Confere o PDF do relatorio do caixa (geral e de uma conta, com varias paginas).
// Sem framework nenhum: roda com   node test_relatorio_caixa_pdf.mjs [pasta-para-salvar-os-pdfs]
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { gerarRelatorioCaixaPdf } from './src/utils/relatorioCaixaPdf.js';

const dados = {
  empresa: 'Fozesc', cnpj: '12.345.678/0001-90', conta: 'todas', tipo: 'todos',
  inicio: '2026-09-01', fim: '2026-09-30', gerado_em: '09/10/2026 10:00',
  resumo: { saldo_anterior: 1500, entradas: 380, saidas: 450, saldo_final: 1430, qtd: 80 },
  por_conta: [
    { conta: 'Dinheiro', saldo_anterior: 1000, entradas: 200, saidas: 400, saldo_final: 800 },
    { conta: 'BB', saldo_anterior: 500, entradas: 100, saidas: 50, saldo_final: 550 },
    { conta: 'Caixa', saldo_anterior: 0, entradas: 80, saidas: 0, saldo_final: 80 },
  ],
  categorias: {
    entrada: [{ categoria: 'Recebimento de Cheque', total: 200, qtd: 1 }, { categoria: 'Troca', total: 100, qtd: 1 }],
    saida: [{ categoria: 'Compra de Ativos', total: 300, qtd: 1 }, { categoria: 'Comissão', total: 239.74, qtd: 1 }],
  },
};
const itens = Array.from({ length: 80 }, (_, i) => ({
  data: `2026-09-${String(1 + (i % 28)).padStart(2, '0')}`,
  descricao: i === 3 ? 'Pgto Borderô #167 - A. D. Multimarcas - Daniel com um nome bem comprido que não cabe na coluna inteira da descrição' : `Lançamento ${i + 1}`,
  categoria: i % 2 ? 'Recebimento de Cheque' : 'Compra de Ativos', conta: i % 3 ? 'Dinheiro' : 'Sistema (BB)',
  entrada: i % 2 ? 100 : null, saida: i % 2 ? null : 50, saldo: 1500 - i * 25,
}));

const geral = await gerarRelatorioCaixaPdf(dados, itens);
const legivel = (doc) => doc.output().replace(/\\([()])/g, '$1');   // o PDF escreve \( e \)
const txt = legivel(geral);
assert.ok(txt.startsWith('%PDF-'));
assert.ok(geral.internal.getNumberOfPages() >= 2, 'extrato grande vai para mais de uma pagina');
for (const t of ['Relatório do Caixa', 'Todas as contas', 'Por conta', 'Entradas por categoria', 'Saídas por categoria',
                 'Extrato (80 lançamento(s))', 'R$ 1.430,00', 'Compra de Ativos', 'Página 1 de']) {
  assert.ok(txt.includes(t), `faltou: ${t}`);
}
assert.ok(!txt.includes('que não cabe na coluna inteira da descrição'), 'descrição comprida é cortada');

const so = await gerarRelatorioCaixaPdf({ ...dados, conta: 'caixa', tipo: 'saida' }, []);
const txt2 = legivel(so);
assert.ok(txt2.includes('Caixa Econômica') && txt2.includes('só saídas') && txt2.includes('Nenhum lançamento no período'));
assert.ok(!txt2.includes('Por conta'), 'o quadro por conta só aparece no geral');

if (process.argv[2]) {
  writeFileSync(`${process.argv[2]}/relatorio-geral.pdf`, Buffer.from(geral.output('arraybuffer')));
  writeFileSync(`${process.argv[2]}/relatorio-caixa.pdf`, Buffer.from(so.output('arraybuffer')));
}
console.log('OK: PDF do relatório do caixa (geral com por conta, categorias e extrato em várias páginas; conta só, sem lançamentos).');
