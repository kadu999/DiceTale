import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * config.ts 的端口/配置解析测试：用 vi.resetModules + 环境变量隔离加载，
 * 避免污染其他测试已 import 的模块级 config 单例。
 */
describe('config', () => {
  const ENV_KEYS = ['PORT', 'MAX_MESSAGE_MB'] as const;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) saved[k] = process.env[k];
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    vi.resetModules();
  });

  async function loadConfig(): Promise<typeof import('../src/config').config> {
    const mod = await import('../src/config');
    return mod.config;
  }

  test('valid PORT is accepted', async () => {
    process.env.PORT = '1500';
    const cfg = await loadConfig();
    expect(cfg.port).toBe(1500);
  });

  test('invalid or out-of-range PORT throws a clear error', async () => {
    for (const bad of ['abc', '0', '-1', '70000', '1420abc']) {
      process.env.PORT = bad;
      await expect(loadConfig()).rejects.toThrow(/非法端口/);
      vi.resetModules();
    }
  });

  test('MAX_MESSAGE_MB with garbage suffix falls back to default', async () => {
    delete process.env.PORT;
    process.env.MAX_MESSAGE_MB = '16abc';
    const cfg = await loadConfig();
    expect(cfg.maxMessageMb).toBe(16);
  });
});
