// Explicacao rapida para quem esta comecando. Aparece logo abaixo ao parar o mouse em cima (v-dica)
// do nome da tela, do item do menu e das partes que nao se explicam sozinhas.
export const AJUDA = {
  // telas (titulo e menu)
  '/': 'Visão geral: capital, lucro, carteira, inadimplência, status dos títulos, próximos vencimentos e o risco por emitente. O sininho mostra os avisos do calendário.',
  '/cheques': 'Todos os títulos (cheques e promissórias). Filtre por nome, data ou situação; clique na situação de um título para receber, prorrogar ou devolver. "Relatório" gera o PDF de tudo que está no filtro.',
  '/bordero': 'Monte uma operação: escolha o cliente, a taxa e os títulos. O sistema calcula juros, IOF e o líquido do cliente, mostra a reputação do cliente e avisa se o emitente já deu problema. Ao salvar, o pagamento sai do caixa sozinho.',
  '/clientes': 'Cadastro dos clientes, com limite de crédito, taxa e a reputação (nota de 0 a 100 pelo histórico de pagamento). Clique num cliente para ver tudo dele.',
  '/clientes/detalhe': 'Tudo de um cliente: limite, pendências, reputação, borderôs, títulos e anotações. "Ficha PDF" e "Relatório PDF" geram os documentos.',
  '/calendario': 'Cheques que vencem em cada dia (com o valor), eventos, notas e lembretes. Em cima, o saldo do caixa e a previsão para 30, 60 e 90 dias. Evento com valor entra na previsão até ser marcado como feito; o que não foi feito aparece no sininho.',
  '/calculos': 'Folhas para fazer contas: uma conta por linha, resultado ao lado. Digite @ para puxar valores do sistema (caixa, carteira, cliente). Cada pessoa vê só as suas.',
  '/fluxo-caixa': 'Todas as entradas e saídas das contas (Dinheiro, BB e Caixa). Borderô, recebimento, vale e despesa recorrente entram sozinhos; aqui se lança o que é avulso.',
  '/relatorio-caixa': 'Entradas e saídas de um período, por conta e por categoria, com o extrato linha a linha e o PDF.',
  '/vales': 'Adiantamentos: o vale tira o dinheiro da conta e cada pagamento devolve. Mostra quanto ainda falta pagar.',
  '/recorrentes': 'Contas que se repetem (aluguel, luz, internet). Débito automático lança sozinho no caixa no vencimento; a manual espera alguém lançar o valor do mês. Dá para adiar só um vencimento.',
  '/historico': 'Cada mês: saldo de cada conta no fim do mês, entradas, saídas, o lucro bruto com a conta inteira e os lançamentos. "Lucro de todos os meses" abre o gráfico; "Extrato" gera o PDF para os sócios.',
  '/auditoria': 'Quem fez o quê e quando (só o administrador vê): criação, alteração, exclusão, login, senha errada barrada e cada backup, com as falhas em laranja.',
  '/configuracoes': 'Dados da empresa e taxas padrão (juros, IOF, multa). O administrador também vê a equipe com acesso e, na aba Backups, quem recebe o backup por e-mail.',

  // partes das telas
  sininho: 'Avisos do calendário: o que é de hoje, dos próximos 7 dias e o lembrete (ou valor combinado) que passou sem ser feito. O número vermelho é o que você ainda não viu.',
  capital: 'Dinheiro investido na empresa (Ajustes > saldos iniciais).',
  lucroAcumulado: 'Juros dos cheques que já foram pagos. Cheque em aberto só conta depois de receber. O lucro de cada mês fica no Histórico Mensal.',
  carteira: 'Tudo que está para receber e ainda não venceu.',
  inadimplencia: 'Vencido sem pagar, devolvido e jurídico somados.',
  riscoEmitentes: 'Quem assinou os títulos em aberto. "Maior exposição": quanto do dinheiro na rua depende de cada emitente. "Com problema": quem tem devolvido, jurídico ou vencido sem pagar.',
  graficoLucro: 'Abre o gráfico com o lucro bruto de cada mês, desde o primeiro. Passe o mouse na barra para ver a conta daquele mês.',
  lucroBruto: 'Juros dos borderôs feitos no mês, mais juros de prorrogação, imposto e multas que entraram no caixa, menos as comissões. As despesas não entram (por isso "bruto").',
  backupFalhou: 'O backup é a cópia de segurança de todo o sistema. Se ele falha, os dados de hoje não estão guardados em outro lugar: veja o motivo na Auditoria (atalho Backups).',
  auditBackups: 'Mostra só o que o backup fez: cópia do banco, envio por e-mail e teste de restauração, com as falhas em laranja.',
  saidaDividida: 'O líquido sai de mais de uma conta: por exemplo, parte em dinheiro e parte por PIX do BB. Você digita quanto sai de cada uma e a última se completa sozinha.',
  emitenteRisco: 'O que este emitente já tem com a empresa: quanto está em aberto e se tem devolvido, jurídico ou vencido.',
};
