// Relatorio da tela Titulos (A4 deitado): TODOS os titulos do filtro, nao so a pagina
// da tela. `dados` e' a resposta de /checks/relatorio; `filtros` sao os da tela.
import { novoPdf, moeda, dataBR, COR_SITUACAO, NOME_SITUACAO, NOME_TIPO, VERMELHO, VERDE, LARANJA, AZUL } from './pdfBase.js';

const ORDEM = { due_date: 'vencimento', issuer_name: 'emitente', amount: 'valor' };
const CALCULO = { '': 'todos', dentro: 'só os que contam', fora: 'só histórico (fora do cálculo)' };
const EM_ABERTO = ['Aguardando', 'Atrasado', 'Devolvido', 'Juridico'];
const TODOS = [...EM_ABERTO, 'Pago'];

export function descreverFiltros(f) {
  const st = f.status || [];
  const status = !st.length || TODOS.every(s => st.includes(s)) ? 'todos'
    : st.length === EM_ABERTO.length && EM_ABERTO.every(s => st.includes(s)) ? 'em aberto (a vencer, atrasado, devolvido, jurídico)'
    : st.map(s => (NOME_SITUACAO[s] || s).toLowerCase()).join(', ');
  const periodo = f.date_start && f.date_end ? `${dataBR(f.date_start)} a ${dataBR(f.date_end)}`
    : f.date_start ? `a partir de ${dataBR(f.date_start)}` : f.date_end ? `até ${dataBR(f.date_end)}` : 'qualquer data';
  return [
    ['Busca', f.search?.trim() ? `"${f.search.trim()}"` : 'nenhuma'],
    ['Vencimento', periodo],
    ['Situação', status],
    ['Cálculo', CALCULO[f.calculo || ''] || f.calculo],
    ['Ordem', `${ORDEM[f.sort_by] || f.sort_by} ${f.sort_order === 'desc' ? '(decrescente)' : '(crescente)'}`],
  ];
}

export async function gerarRelatorioTitulosPdf(dados, filtros) {
  const itens = dados.itens;
  const pdf = await novoPdf({
    orientacao: 'landscape', empresa: dados.empresa, cnpj: dados.cnpj, titulo: 'Relatório de Títulos',
    detalhe: `${itens.length} título(s)`, geradoEm: dados.gerado_em,
  });
  const { ESQ } = pdf;

  pdf.filtros(descreverFiltros(filtros));

  // ------------------------------------------------------------ resumo (todos do filtro, do banco)
  const r = dados.resumo;
  const de = (s) => r.por_status.find(x => x.status === s) || { qtd: 0, valor: 0 };
  const inad = ['Devolvido', 'Juridico'].map(de);
  pdf.quadros([
    ['Total do filtro', moeda(r.valor), `${r.qtd} título(s)${r.fora.qtd ? ` · ${r.fora.qtd} fora do cálculo` : ''}`, [15, 23, 42]],
    ['A vencer', moeda(de('Aguardando').valor), `${de('Aguardando').qtd} título(s)`, AZUL],
    ['Atrasados', moeda(de('Atrasado').valor), `${de('Atrasado').qtd} título(s)`, de('Atrasado').qtd ? VERMELHO : 20],
    ['Devolvidos / jurídico', moeda(inad[0].valor + inad[1].valor), `${inad[0].qtd} devolvido(s) · ${inad[1].qtd} jurídico`, inad[0].qtd + inad[1].qtd ? LARANJA : 20],
    ['Pagos', moeda(de('Pago').valor), `${de('Pago').qtd} título(s)`, VERDE],
  ]);

  // ------------------------------------------------------------ por cliente (so com mais de um)
  const porCliente = {};
  itens.forEach(i => {
    const c = (porCliente[i.cliente] ??= { qtd: 0, valor: 0, atrasado: 0 });
    c.qtd += 1; c.valor += i.valor;
    if (['Atrasado', 'Devolvido', 'Juridico'].includes(i.situacao)) c.atrasado += i.valor;
  });
  const clientes = Object.entries(porCliente).sort((a, b) => b[1].valor - a[1].valor);
  if (clientes.length > 1) {
    const LIMITE = 15;
    pdf.secao('Por cliente', clientes.length > LIMITE ? `os ${LIMITE} maiores de ${clientes.length} clientes` : `${clientes.length} clientes`);
    const total = r.valor || 1;
    const linhas = clientes.slice(0, LIMITE).map(([nome, c]) => ({
      valores: [nome, c.qtd, moeda(c.valor), `${(c.valor / total * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`, c.atrasado ? moeda(c.atrasado) : '—'],
      cores: [20, 20, 20, 90, c.atrasado ? VERMELHO : 140],
    }));
    if (clientes.length > LIMITE) {
      const resto = clientes.slice(LIMITE).reduce((t, [, c]) => ({ qtd: t.qtd + c.qtd, valor: t.valor + c.valor, atrasado: t.atrasado + c.atrasado }), { qtd: 0, valor: 0, atrasado: 0 });
      linhas.push({ valores: [`Outros ${clientes.length - LIMITE} clientes`, resto.qtd, moeda(resto.valor), `${(resto.valor / total * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`, resto.atrasado ? moeda(resto.atrasado) : '—'], cores: [90, 90, 90, 90, 90] });
    }
    pdf.tabela([
      { titulo: 'Cliente', largura: 113 }, { titulo: 'Títulos', largura: 25, alinhar: 'right' },
      { titulo: 'Valor', largura: 45, alinhar: 'right' }, { titulo: '% do total', largura: 35, alinhar: 'right' },
      { titulo: 'Atrasado / dev. / jurídico', largura: 55, alinhar: 'right' },
    ], linhas, { alturaLinha: 5.6, tam: 8 });
    pdf.y += 7;
  }

  // ------------------------------------------------------------ lista completa
  const legenda = ['valor = o que o título deve hoje'];
  if (itens.some(i => i.vencimento_original)) legenda.push('* vencimento prorrogado');
  if (itens.some(i => i.fora_do_calculo)) legenda.push('(fora) = histórico, fora dos números do painel');
  pdf.secao(`Títulos (${itens.length})`, legenda.join(' · '));
  const situacao = (i) => {
    const nome = NOME_SITUACAO[i.situacao] || i.situacao;
    const base = i.situacao === 'Pago' && i.pagamento ? `Pago ${dataBR(i.pagamento)}` : nome;
    return i.fora_do_calculo ? `${base} (fora)` : base;
  };
  pdf.tabela([
    { titulo: 'Vencimento', largura: 22 }, { titulo: 'Atraso', largura: 16, alinhar: 'right' },
    { titulo: 'Cliente', largura: 48 }, { titulo: 'Emitente', largura: 48 }, { titulo: 'Banco / Nº', largura: 38 },
    { titulo: 'Borderô', largura: 17 }, { titulo: 'Tipo', largura: 20 },
    { titulo: 'Valor', largura: 26, alinhar: 'right' }, { titulo: 'Situação', largura: 38 },
  ], itens.length ? itens.map(i => ({
    valores: [
      `${dataBR(i.vencimento)}${i.vencimento_original ? '*' : ''}`, i.dias_atraso ? `${i.dias_atraso} d` : '',
      i.cliente, i.emitente, [i.banco, i.numero].filter(Boolean).join(' - '), `#${i.bordero}`,
      NOME_TIPO[i.tipo] || i.tipo || '', moeda(i.valor), situacao(i),
    ],
    cores: i.fora_do_calculo ? Array(9).fill(140)
      : [20, VERMELHO, 20, 70, 90, 90, 90, 20, COR_SITUACAO[i.situacao] || 20],
  })) : [['', '', 'Nenhum título com esses filtros', '', '', '', '', '', '']], {
    alturaLinha: 5.6, tam: 8,
    total: itens.length ? { valores: ['Total', '', `${itens.length} título(s)`, '', '', '', '', moeda(itens.reduce((t, i) => t + i.valor, 0)), ''] } : null,
  });

  if (dados.cortado) {
    pdf.y += 6;
    pdf.novaPaginaSe(6);
    pdf.texto(`Atenção: o relatório parou em ${itens.length} títulos. Use filtros para dividir.`, ESQ, pdf.y, { tam: 8.5, negrito: true, cor: VERMELHO });
  }
  return pdf.finalizar();
}

export async function baixarRelatorioTitulosPdf(dados, filtros) {
  const doc = await gerarRelatorioTitulosPdf(dados, filtros);
  doc.save(`relatorio-titulos-${new Date().toLocaleDateString('en-CA')}.pdf`);
}
