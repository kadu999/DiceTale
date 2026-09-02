import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchItemCatalog } from './itemsApi';

describe('fetchItemCatalog', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns items from response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ name: 'Potion' }] }),
    } as Response);

    const result = await fetchItemCatalog();
    expect(result).toEqual([{ name: 'Potion' }]);
  });

  it('throws when response is not ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    await expect(fetchItemCatalog()).rejects.toThrow('Failed to fetch items: 404');
  });

  it('falls back to empty array when items missing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    const result = await fetchItemCatalog();
    expect(result).toEqual([]);
  });

  it('falls back to empty array when items is not an array', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ items: 'corrupt' }),
    } as Response);

    const result = await fetchItemCatalog();
    expect(result).toEqual([]);
  });

  it('filters out malformed entries missing a name', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ name: 'Potion' }, { price: 100 }] }),
    } as Response);

    const result = await fetchItemCatalog();
    expect(result).toEqual([{ name: 'Potion' }]);
  });
});
