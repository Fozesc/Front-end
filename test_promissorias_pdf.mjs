// Confere o PDF das promissorias: 3 por folha, numero da parcela, valor, extenso, credor e assinatura.
// Roda com   node test_promissorias_pdf.mjs [pasta-para-salvar-o-pdf]
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { gerarPromissorias } from './src/utils/promissoriasPdf.js';

const credor = { nome: 'Fozesc Fomento Mercantil Ltda', cnpj: '12.345.678/0001-90', endereco: 'Foz do Iguacu - PR' };
const emitente = { nome: 'Maria da Silva Pereira', documento: '123.456.789-00', endereco: 'Rua das Flores, 100 - Centro - Foz do Iguacu/PR - CEP 85851-000' };
const parcelas = Array.from({ length: 7 }, (_, i) => ({ numero: `${i + 1}/7`, valor: 1234 + i, vencimento: `2026-${String(i + 1).padStart(2, '0')}-10` }));

const doc = await gerarPromissorias({ credor, emitente, avalista: { nome: 'Jose Avalista', documento: '987.654.321-00' }, operacaoId: 321, dataEmissao: '2025-12-10', parcelas });
assert.equal(doc.getNumberOfPages(), 3, '7 promissorias = 3 folhas (3 + 3 + 1)');
const pdf = doc.output();
for (const t of ['NOTA PROMISS', 'Nº 1/7', 'Nº 7/7', 'R$ 1.234,00', 'R$ 1.240,00', 'MIL DUZENTOS E TRINTA E QUATRO REAIS',
  'MIL DUZENTOS E QUARENTA REAIS', '10/01/2026', '10/07/2026', '12.345.678/0001-90', 'Fomento', 'ordem,', 'Assinatura do emitente',
  'Maria da Silva Pereira', '123.456.789-00', 'parcela 1 de 7', 'Border', 'Emiss', '10/12/2025', '85851-000', 'Assinatura do avalista', 'Jose Avalista', 'CPF/CNPJ 987.654.321-00']) {
  assert.ok(pdf.includes(t), `falta "${t}"`);
}
assert.ok(['10', 'janeiro', '2026,'].every(t => pdf.includes(`(${t})`)), 'vencimento por extenso no texto');

const sem = (await gerarPromissorias({ emitente: { nome: 'Joao' }, dataEmissao: '2026-11-03',
  parcelas: [{ numero: '1/1', valor: 0.5, vencimento: '2026-12-01' }] })).output();
assert.ok(sem.includes('CINQUENTA CENTAVOS') && sem.includes('SIMULA') && sem.includes('Fozesc') && sem.includes('______'),
  'sem credor/documento: nome padrao, linha em branco para preencher e marca de simulacao');
assert.ok(sem.includes('Assinatura do avalista') && sem.includes('Nome: ___') && sem.includes('CPF: ___'), 'avalista sem dados: linhas em branco');
assert.ok(!sem.includes(', CNPJ'), 'sem CNPJ do credor nao escreve CNPJ');

if (process.argv[2]) writeFileSync(`${process.argv[2]}/promissorias.pdf`, Buffer.from(doc.output('arraybuffer')));
console.log('OK: promissorias em PDF (3 por folha, numero da parcela, valor, extenso, vencimento, credor, emitente, assinatura, simulacao).');
