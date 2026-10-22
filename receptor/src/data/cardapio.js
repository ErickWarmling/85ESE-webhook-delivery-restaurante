/**
 * Cardápio do restaurante com o tempo de preparo de cada item.
 * O receptor usa estes dados para recusar itens desconhecidos e
 * calcular o tempo estimado de preparo.
 */
export const CARDAPIO = Object.freeze({
  'HAMB-001': Object.freeze({ nome: 'X-Burguer Clássico', tempoPreparoMinutos: 15 }),
  'HAMB-002': Object.freeze({ nome: 'X-Bacon Duplo', tempoPreparoMinutos: 18 }),
  'PIZZA-001': Object.freeze({ nome: 'Pizza Margherita (média)', tempoPreparoMinutos: 25 }),
  'PIZZA-002': Object.freeze({ nome: 'Pizza Calabresa (grande)', tempoPreparoMinutos: 28 }),
  'MASSA-001': Object.freeze({ nome: 'Lasanha à Bolonhesa', tempoPreparoMinutos: 22 }),
  'SALAD-001': Object.freeze({ nome: 'Salada Caesar', tempoPreparoMinutos: 8 }),
  'PORC-001': Object.freeze({ nome: 'Batata Frita (porção)', tempoPreparoMinutos: 10 }),
  'BEB-001': Object.freeze({ nome: 'Refrigerante Lata 350ml', tempoPreparoMinutos: 1 }),
  'BEB-002': Object.freeze({ nome: 'Suco Natural de Laranja 500ml', tempoPreparoMinutos: 4 }),
  'SOBR-001': Object.freeze({ nome: 'Petit Gâteau', tempoPreparoMinutos: 12 }),
});
