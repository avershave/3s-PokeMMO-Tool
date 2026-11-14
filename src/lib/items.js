import itemsRaw from '../../itemdata.json';
import { normalizeKey } from './areas.js';

const ITEM_ICON_BASE = 'https://raw.githubusercontent.com/PokeMMO-Tools/pokemmo-data/main/assets/itemicons/';
const ITEM_PLACEHOLDER = `${import.meta.env.BASE_URL}no-item.svg`;

const ITEM_LIST = (() => {
  const src = Array.isArray(itemsRaw) ? itemsRaw : [];
  const seen = new Set();
  const list = [];
  for (const item of src) {
    if (item?.id === 0) continue; // skip placeholder entry
    if (!item?.name || item.name.includes('?')) continue; // skip unknown items
    const key = normalizeKey(item.name);
    if (seen.has(key)) continue;
    seen.add(key);
    list.push(item);
  }
  return list;
})();

const ITEM_INDEX = (() => {
  const byId = new Map();
  const byName = new Map();
  for (const item of ITEM_LIST) {
    if (item.id != null) byId.set(item.id, item);
    byName.set(normalizeKey(item.name), item);
  }
  return { byId, byName };
})();

export { ITEM_ICON_BASE, ITEM_PLACEHOLDER, ITEM_LIST, ITEM_INDEX };
