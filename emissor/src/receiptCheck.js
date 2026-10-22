/**
 * Confere se a confirmação devolvida pelo restaurante corresponde ao pedido enviado.
 * @returns {Array<{ campo: string, enviado: unknown, recebido: unknown }>} divergências (vazio = tudo confere)
 */
export function compareReceipt(event, confirmation) {
  const { pedido } = event;
  const esperado = {
    idEvento: event.idEvento,
    pedidoId: pedido.id,
    'resumo.quantidadeItens': pedido.itens.reduce((acc, item) => acc + item.quantidade, 0),
    'resumo.valorTotal': pedido.valores.total,
    'resumo.formaPagamento': pedido.pagamento.forma,
  };
  const recebido = {
    idEvento: confirmation?.idEvento,
    pedidoId: confirmation?.pedidoId,
    'resumo.quantidadeItens': confirmation?.resumo?.quantidadeItens,
    'resumo.valorTotal': confirmation?.resumo?.valorTotal,
    'resumo.formaPagamento': confirmation?.resumo?.formaPagamento,
  };

  return Object.keys(esperado)
    .filter((campo) => esperado[campo] !== recebido[campo])
    .map((campo) => ({ campo, enviado: esperado[campo], recebido: recebido[campo] }));
}
