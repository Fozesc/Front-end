// Explicacao rapida de cada tela para quem esta comecando. Aparece ao parar o mouse em cima
// do nome da tela (titulo) ou do item no menu - nao muda nada no visual.
export const AJUDA = {
  '/': 'Visão geral: capital, lucro, o que está em carteira, inadimplência, status dos títulos e os próximos vencimentos. Bom lugar para começar o dia.',
  '/cheques': 'Todos os títulos (cheques e promissórias). Filtre por nome, data ou situação; clique na situação de um título para receber, prorrogar ou devolver. "Relatório" gera o PDF de tudo que está no filtro.',
  '/bordero': 'Monte uma operação: escolha o cliente, a taxa e os títulos. O sistema calcula juros, IOF e o líquido do cliente; ao salvar, o pagamento sai do caixa sozinho.',
  '/clientes': 'Cadastro dos clientes, com limite de crédito e taxa. Clique num cliente para ver borderôs, títulos, anotações e a ficha em PDF.',
  '/clientes/detalhe': 'Tudo de um cliente: limite, o que está em aberto, borderôs, títulos e anotações. "Ficha PDF" e "Relatório PDF" geram os documentos.',
  '/calendario': 'Lembretes e eventos por dia. Uma previsão com valor entra na previsão do caixa até ser marcada como concluída.',
  '/calculos': 'Folhas para fazer contas: uma conta por linha, resultado ao lado. Digite @ para puxar valores do sistema (caixa, carteira, cliente). Cada pessoa vê só as suas.',
  '/fluxo-caixa': 'Todas as entradas e saídas das contas (Dinheiro, BB e Caixa). Borderô, recebimento, vale e despesa recorrente entram sozinhos; aqui se lança o que é avulso.',
  '/relatorio-caixa': 'Entradas e saídas de um período, por conta e por categoria, com o extrato linha a linha e o PDF.',
  '/vales': 'Adiantamentos: o vale tira o dinheiro da conta e cada pagamento devolve. Mostra quanto ainda falta pagar.',
  '/recorrentes': 'Contas que se repetem (aluguel, luz, internet). Débito automático lança sozinho no caixa no vencimento; a manual espera alguém lançar o valor do mês. Dá para adiar só um vencimento.',
  '/historico': 'O caixa de cada mês: saldo no fim do mês, crescimento e lançamentos. "Extrato" gera o PDF geral do período para os sócios.',
  '/auditoria': 'Quem fez o quê e quando: cada criação, alteração, exclusão e login fica registrada aqui.',
  '/configuracoes': 'Dados da empresa, taxas padrão (juros, IOF, multa) e a equipe com acesso ao sistema.',
};
