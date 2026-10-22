/**
 * Itens do restaurante conforme sincronizados no aplicativo de delivery
 * (código, nome, preço de venda e observações comuns dos clientes).
 */
export const CATALOGO = Object.freeze([
  { codigo: 'HAMB-001', nome: 'X-Burguer Clássico', preco: 29.9, sugestoesObservacao: ['sem cebola', 'ponto da carne: mal passado'] },
  { codigo: 'HAMB-002', nome: 'X-Bacon Duplo', preco: 36.5, sugestoesObservacao: ['sem picles', 'ponto da carne: ao ponto'] },
  { codigo: 'PIZZA-001', nome: 'Pizza Margherita (média)', preco: 49.9, sugestoesObservacao: ['massa bem assada'] },
  { codigo: 'PIZZA-002', nome: 'Pizza Calabresa (grande)', preco: 62.0, sugestoesObservacao: ['sem cebola', 'cortar em 12 pedaços'] },
  { codigo: 'MASSA-001', nome: 'Lasanha à Bolonhesa', preco: 42.0, sugestoesObservacao: ['bem quente'] },
  { codigo: 'SALAD-001', nome: 'Salada Caesar', preco: 27.5, sugestoesObservacao: ['molho à parte'] },
  { codigo: 'PORC-001', nome: 'Batata Frita (porção)', preco: 18.0, sugestoesObservacao: ['sem sal'] },
  { codigo: 'BEB-001', nome: 'Refrigerante Lata 350ml', preco: 6.5, sugestoesObservacao: ['bem gelado'] },
  { codigo: 'BEB-002', nome: 'Suco Natural de Laranja 500ml', preco: 11.0, sugestoesObservacao: ['sem açúcar', 'sem gelo'] },
  { codigo: 'SOBR-001', nome: 'Petit Gâteau', preco: 22.9, sugestoesObservacao: ['sorvete à parte'] },
]);

export const CLIENTES = Object.freeze([
  {
    cliente: { nome: 'Ana Souza', telefone: '+55 47 99876-5432' },
    endereco: {
      logradouro: 'Rua XV de Novembro', numero: '1200', complemento: 'Apto 302',
      bairro: 'Centro', cidade: 'Blumenau', uf: 'SC', cep: '89010-001', referencia: 'Em frente à praça',
    },
  },
  {
    cliente: { nome: 'Bruno Lima', telefone: '(48) 3222-1100' },
    endereco: {
      logradouro: 'Avenida Beira-Mar Norte', numero: '455',
      bairro: 'Agronômica', cidade: 'Florianópolis', uf: 'SC', cep: '88025-000',
    },
  },
  {
    cliente: { nome: 'Carla Mendes', telefone: '11987654321' },
    endereco: {
      logradouro: 'Rua Augusta', numero: '88', complemento: 'Casa 2',
      bairro: 'Consolação', cidade: 'São Paulo', uf: 'SP', cep: '01305-000',
    },
  },
]);

export const OBSERVACOES_PEDIDO = Object.freeze([
  'Interfone com defeito, ligar ao chegar.',
  'Enviar talheres descartáveis.',
  'Cliente alérgico a amendoim.',
]);
