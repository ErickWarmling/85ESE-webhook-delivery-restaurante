const FORMAS_PAGAMENTO_LEGIVEIS = Object.freeze({
  pix: 'PIX',
  cartao_credito: 'Cartão de crédito',
  cartao_debito: 'Cartão de débito',
  dinheiro: 'Dinheiro',
  vale_refeicao: 'Vale-refeição',
});

const formatMoney = (value) => `R$ ${value.toFixed(2).replace('.', ',')}`;

/**
 * Monta a "comanda" exibida no console do restaurante quando um pedido entra na fila.
 */
export function formatKitchenTicket(pedido, entry) {
  const { enderecoEntrega: e, pagamento, valores } = pedido;
  const linhas = [
    '',
    '================ NOVO PEDIDO NA COZINHA ================',
    `Pedido: ${pedido.id}    Posição na fila: ${entry.posicao}`,
    `Cliente: ${pedido.cliente.nome} (${pedido.cliente.telefone})`,
    'Itens:',
    ...pedido.itens.map((item) => {
      const obs = item.observacoes ? `  -> obs: ${item.observacoes}` : '';
      return `  ${item.quantidade}x ${item.nome} [${item.codigo}]${obs}`;
    }),
    `Entrega: ${e.logradouro}, ${e.numero}${e.complemento ? ` - ${e.complemento}` : ''} - ${e.bairro}, ${e.cidade}/${e.uf} - CEP ${e.cep}`,
    `Pagamento: ${FORMAS_PAGAMENTO_LEGIVEIS[pagamento.forma]} (${pagamento.pagoOnline ? 'pago online' : 'cobrar na entrega'})` +
      (pagamento.trocoPara ? ` - troco para ${formatMoney(pagamento.trocoPara)}` : ''),
    `Total: ${formatMoney(valores.total)}`,
    `Observações: ${pedido.observacoes || '(nenhuma)'}`,
    `Tempo estimado: ${entry.tempoEstimadoMinutos} min (previsão: ${entry.previsaoPronto})`,
    '========================================================',
  ];
  return linhas.join('\n');
}
