import { CARDAPIO } from '../data/cardapio.js';

export const EVENTO_PEDIDO_CRIADO = 'pedido.criado';
export const FORMAS_PAGAMENTO = Object.freeze(['pix', 'cartao_credito', 'cartao_debito', 'dinheiro', 'vale_refeicao']);

const UFS = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]);

export const LIMITES = Object.freeze({
  maxItens: 50,
  maxQuantidadePorItem: 99,
  maxTexto: 200,
  maxObservacoes: 500,
  maxIdentificador: 100,
});

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const toCents = (value) => Math.round(value * 100);
const isMoney = (value) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && Math.abs(value * 100 - toCents(value)) < 1e-6;
const isIsoDate = (value) =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) && !Number.isNaN(Date.parse(value));

/**
 * Coletor de erros: cada validação registra `{ campo, mensagem }` e segue em frente,
 * para que o emissor receba todos os problemas do payload de uma só vez.
 * Os métodos retornam true quando o valor é válido.
 */
function createErrorCollector() {
  const errors = [];
  const add = (campo, mensagem) => {
    errors.push({ campo, mensagem });
    return false;
  };

  const string = (value, campo, { optional = false, max = LIMITES.maxTexto, pattern, patternMessage } = {}) => {
    if (value === undefined || value === null) return optional ? false : add(campo, 'Campo obrigatório');
    if (typeof value !== 'string') return add(campo, 'Deve ser um texto');
    if (!optional && value.trim() === '') return add(campo, 'Não pode ser vazio');
    if (value.length > max) return add(campo, `Deve ter no máximo ${max} caracteres`);
    if (pattern && !pattern.test(value)) return add(campo, patternMessage);
    return true;
  };

  const object = (value, campo) =>
    isPlainObject(value) || add(campo, value === undefined ? 'Campo obrigatório' : 'Deve ser um objeto');

  const money = (value, campo) =>
    isMoney(value) ||
    add(campo, value === undefined ? 'Campo obrigatório' : 'Deve ser um valor numérico não negativo com até 2 casas decimais');

  return { errors, add, string, object, money };
}

function validateCliente(cliente, v) {
  if (!v.object(cliente, 'pedido.cliente')) return;
  v.string(cliente.nome, 'pedido.cliente.nome');
  if (v.string(cliente.telefone, 'pedido.cliente.telefone', { max: 20 })) {
    const digitos = cliente.telefone.replace(/\D/g, '');
    if (digitos.length < 10 || digitos.length > 13) {
      v.add('pedido.cliente.telefone', 'Deve conter entre 10 e 13 dígitos (DDD + número)');
    }
  }
}

/** Retorna true quando todos os itens são válidos (necessário para conferir os valores). */
function validateItens(itens, v, cardapio) {
  if (!Array.isArray(itens)) return v.add('pedido.itens', itens === undefined ? 'Campo obrigatório' : 'Deve ser uma lista');
  if (itens.length === 0) return v.add('pedido.itens', 'O pedido deve ter pelo menos um item');
  if (itens.length > LIMITES.maxItens) return v.add('pedido.itens', `Máximo de ${LIMITES.maxItens} itens por pedido`);

  const errosAntes = v.errors.length;
  itens.forEach((item, i) => {
    const base = `pedido.itens[${i}]`;
    if (!v.object(item, base)) return;
    if (v.string(item.codigo, `${base}.codigo`, { max: 30 }) && !Object.hasOwn(cardapio, item.codigo)) {
      v.add(`${base}.codigo`, `Item "${item.codigo}" não existe no cardápio do restaurante`);
    }
    v.string(item.nome, `${base}.nome`);
    const { quantidade } = item;
    if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > LIMITES.maxQuantidadePorItem) {
      v.add(`${base}.quantidade`, `Deve ser um inteiro entre 1 e ${LIMITES.maxQuantidadePorItem}`);
    }
    v.money(item.precoUnitario, `${base}.precoUnitario`);
    v.string(item.observacoes, `${base}.observacoes`, { optional: true });
  });
  return v.errors.length === errosAntes;
}

function validateEndereco(endereco, v) {
  const base = 'pedido.enderecoEntrega';
  if (!v.object(endereco, base)) return;
  v.string(endereco.logradouro, `${base}.logradouro`);
  v.string(endereco.numero, `${base}.numero`, { max: 10 });
  v.string(endereco.complemento, `${base}.complemento`, { optional: true, max: 100 });
  v.string(endereco.bairro, `${base}.bairro`, { max: 100 });
  v.string(endereco.cidade, `${base}.cidade`, { max: 100 });
  if (v.string(endereco.uf, `${base}.uf`, { max: 2 }) && !UFS.has(endereco.uf)) {
    v.add(`${base}.uf`, 'Deve ser uma UF brasileira válida (ex.: SC, SP)');
  }
  v.string(endereco.cep, `${base}.cep`, {
    max: 9,
    pattern: /^\d{5}-?\d{3}$/,
    patternMessage: 'Deve estar no formato 00000-000',
  });
  v.string(endereco.referencia, `${base}.referencia`, { optional: true });
}

/** Retorna os valores quando bem formados (para checar o troco); caso contrário, null. */
function validateValores(valores, itensValidos, v) {
  const base = 'pedido.valores';
  if (!v.object(valores, base)) return null;
  const desconto = valores.desconto ?? 0;
  const bemFormados = [
    v.money(valores.subtotal, `${base}.subtotal`),
    v.money(valores.taxaEntrega, `${base}.taxaEntrega`),
    v.money(desconto, `${base}.desconto`),
    v.money(valores.total, `${base}.total`),
  ].every(Boolean);
  if (!bemFormados) return null;

  // Comparação em centavos para evitar erros de ponto flutuante.
  if (itensValidos) {
    const somaItens = itensValidos.reduce((acc, item) => acc + toCents(item.precoUnitario) * item.quantidade, 0);
    if (somaItens !== toCents(valores.subtotal)) {
      v.add(`${base}.subtotal`, `Não confere com a soma dos itens (esperado ${(somaItens / 100).toFixed(2)})`);
    }
  }
  const totalEsperado = toCents(valores.subtotal) + toCents(valores.taxaEntrega) - toCents(desconto);
  if (totalEsperado < 0) {
    v.add(`${base}.desconto`, 'Desconto não pode ser maior que subtotal + taxa de entrega');
  } else if (totalEsperado !== toCents(valores.total)) {
    v.add(`${base}.total`, `Deve ser subtotal + taxaEntrega - desconto (esperado ${(totalEsperado / 100).toFixed(2)})`);
  }
  return valores;
}

function validatePagamento(pagamento, valores, v) {
  const base = 'pedido.pagamento';
  if (!v.object(pagamento, base)) return;
  const formaValida = FORMAS_PAGAMENTO.includes(pagamento.forma);
  if (!formaValida) v.add(`${base}.forma`, `Deve ser uma das opções: ${FORMAS_PAGAMENTO.join(', ')}`);
  if (typeof pagamento.pagoOnline !== 'boolean') {
    v.add(`${base}.pagoOnline`, 'Campo obrigatório (true/false)');
  } else if (pagamento.forma === 'dinheiro' && pagamento.pagoOnline) {
    v.add(`${base}.pagoOnline`, 'Pagamento em dinheiro não pode ser pago online');
  }

  if (pagamento.trocoPara === undefined || pagamento.trocoPara === null) return;
  if (formaValida && pagamento.forma !== 'dinheiro') {
    v.add(`${base}.trocoPara`, 'Só é permitido quando a forma de pagamento é dinheiro');
  } else if (v.money(pagamento.trocoPara, `${base}.trocoPara`) && valores && pagamento.trocoPara < valores.total) {
    v.add(`${base}.trocoPara`, 'Deve ser maior ou igual ao total do pedido');
  }
}

/**
 * Valida o evento `pedido.criado` recebido pelo webhook.
 * @returns {{ valid: boolean, errors: Array<{ campo: string, mensagem: string }> }}
 */
export function validateOrderEvent(payload, { cardapio = CARDAPIO } = {}) {
  const v = createErrorCollector();
  const result = () => ({ valid: v.errors.length === 0, errors: v.errors });

  if (!isPlainObject(payload)) {
    v.add('(raiz)', 'O corpo da requisição deve ser um objeto JSON');
    return result();
  }
  if (payload.evento !== EVENTO_PEDIDO_CRIADO) v.add('evento', `Deve ser "${EVENTO_PEDIDO_CRIADO}"`);
  v.string(payload.idEvento, 'idEvento', { max: LIMITES.maxIdentificador });
  if (!isIsoDate(payload.criadoEm)) v.add('criadoEm', 'Deve ser uma data/hora ISO 8601 válida');

  const { pedido } = payload;
  if (!v.object(pedido, 'pedido')) return result();

  v.string(pedido.id, 'pedido.id', { max: LIMITES.maxIdentificador });
  validateCliente(pedido.cliente, v);
  const itensOk = validateItens(pedido.itens, v, cardapio);
  validateEndereco(pedido.enderecoEntrega, v);
  const valores = validateValores(pedido.valores, itensOk ? pedido.itens : null, v);
  validatePagamento(pedido.pagamento, valores, v);
  v.string(pedido.observacoes, 'pedido.observacoes', { optional: true, max: LIMITES.maxObservacoes });

  return result();
}
