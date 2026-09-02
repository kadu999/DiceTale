import type { ItemCatalogEntry } from 'src/stores/itemsStore';

export interface ItemCatalogResponse {
  items?: ItemCatalogEntry[];
}

function isValidItemCatalogEntry(entry: unknown): entry is ItemCatalogEntry {
  return typeof entry === 'object' && entry !== null && typeof (entry as ItemCatalogEntry).name === 'string';
}

export async function fetchItemCatalog(): Promise<ItemCatalogEntry[]> {
  const res = await fetch('/items.json');
  if (!res.ok) throw new Error(`Failed to fetch items: ${res.status}`);
  const data = (await res.json()) as ItemCatalogResponse;
  return Array.isArray(data.items) ? data.items.filter(isValidItemCatalogEntry) : [];
}
