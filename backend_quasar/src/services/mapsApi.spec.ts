import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchMapList } from './mapsApi';

describe('fetchMapList', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns maps from response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ maps: [{ name: 'Map001', image: '/maps/Map001.png' }] }),
    } as Response);

    const result = await fetchMapList();
    expect(result).toEqual([{ name: 'Map001', image: '/maps/Map001.png' }]);
  });

  it('throws when response is not ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    await expect(fetchMapList()).rejects.toThrow('Failed to fetch maps: 500');
  });

  it('falls back to empty array when maps missing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    const result = await fetchMapList();
    expect(result).toEqual([]);
  });

  it('filters malformed entries', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ maps: [{ name: 'Map001' }, { image: '/maps/Map002.png' }] }),
    } as Response);

    const result = await fetchMapList();
    expect(result).toEqual([]);
  });
});
