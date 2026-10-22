import crypto from 'node:crypto';
import { CATALOGO, CLIENTES, OBSERVACOES_PEDIDO } from './catalog.js';

export const EVENTO_PEDIDO_CRIADO = 'pedido.criado';
export const TAXA_ENTREGA = 7.9;
const FORMAS_PAGAMENTO = ['pix', 'cartao_credito', 'cartao_debito', 'dinheiro', 'vale_refeicao'];

const toCents = (value) => Math.round(value * 100);
const fromCents = (cents) => cents / 100;

/**
 * Cria o evento `pedido.criado` com dados de um pedido realista.
 * `random` e `now` são injetáveis para gerar pedidos determinísticos nos testes.
 */
export function createOrderEvent({ random = Math.random, now = new Date() } = {}) {
  const pick = (list) => list[Math.floor(random() * list.length)];
  const { cliente, endereco } = pick(CLIENTES);

  const quantidadeDeItens = 1 + Math.floor(random() * 3);
  const produtos = [...CATALOGO].sort(() => random() - 0.5).slice(0, quantidadeDeItens);
  const itens = produtos.map((produto) => {
    const item = {
      codigo: produto.codigo,
      nome: produto.nome,
      quantidade: 1 + Math.floor(random() * 2),
      precoUnitario: produto.preco,
    };
    if (random() < 0.4) item.observacoes = pick(produto.sugestoesObservacao);
    return item;
  });

  const subtotalCents = itens.reduce((acc, item) => acc + toCents(item.precoUnitario) * item.quantidade, 0);
  const descontoCents = random() < 0.3 ? 500 : 0;
  const totalCents = subtotalCents + toCents(TAXA_ENTREGA) - descontoCents;

  const forma = pick(FORMAS_PAGAMENTO);
  const pagamento = { forma, pagoOnline: forma === 'pix' || forma === 'cartao_credito' };
  if (forma === 'dinheiro') pagamento.trocoPara = Math.ceil(fromCents(totalCents) / 50) * 50;

  const data = now.toISOString().slice(0, 10).replaceAll('-', '');
  const pedido = {
    id: `PED-${data}-${crypto.randomInt(100000, 1000000)}`,
    restaurante: { id: 'REST-0042', nome: 'Cantina Sabor da Casa' },
    cliente: { ...cliente },
    itens,
    enderecoEntrega: { ...endereco },
    pagamento,
    valores: {
      subtotal: fromCents(subtotalCents),
      taxaEntrega: TAXA_ENTREGA,
      desconto: fromCents(descontoCents),
      total: fromCents(totalCents),
    },
  };
  if (random() < 0.5) pedido.observacoes = pick(OBSERVACOES_PEDIDO);

  return {
    evento: EVENTO_PEDIDO_CRIADO,
    idEvento: `evt_${crypto.randomUUID()}`,
    criadoEm: now.toISOString(),
    pedido,
  };
}

/**
 * Gera um evento propositalmente inválido, para demonstrar a validação do receptor.
 */
export function createInvalidOrderEvent(options) {
  const event = createOrderEvent(options);
  delete event.pedido.cliente.telefone;
  event.pedido.itens.push({ codigo: 'NAO-EXISTE', nome: 'Item fora do cardápio', quantidade: 0, precoUnitario: -1 });
  event.pedido.enderecoEntrega.cep = '123';
  event.pedido.pagamento.forma = 'cheque';
  return event;
}
