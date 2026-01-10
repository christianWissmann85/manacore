import { CardLoader } from '../../packages/engine/src/index';

const card = CardLoader.getByName('Prodigal Sorcerer');
console.log('Card:', card?.name);
console.log('Abilities:', JSON.stringify(card?.abilities, null, 2));
