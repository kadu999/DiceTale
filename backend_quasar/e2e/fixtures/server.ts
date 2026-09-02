import { test as base, expect } from '@playwright/test';
import { spawn } from 'child_process';
import path from 'path';

export { expect };

const SERVER_URL = 'http://localhost:1420';
const STARTUP_TIMEOUT_MS = 10000;
const POLL_INTERVAL_MS = 200;

function npmCommand(): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = new Error('server did not start');

  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch (e) {
      lastError = e;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw lastError;
}

function killProcess(proc: ReturnType<typeof spawn>): void {
  if (!proc.pid) return;

  if (process.platform === 'win32') {
    spawn('taskkill', ['/T', '/F', '/PID', String(proc.pid)], {
      stdio: 'ignore',
      shell: false,
    });
    return;
  }

  proc.kill('SIGTERM');
}

export const test = base.extend<{
  serverUrl: string;
}>({
  serverUrl: async ({}, use) => {
    const isWindows = process.platform === 'win32';
    const proc = spawn(npmCommand(), ['run', 'serve'], {
      cwd: path.resolve(process.cwd()),
      stdio: 'pipe',
      shell: isWindows,
    });

    try {
      await waitForServer(SERVER_URL, STARTUP_TIMEOUT_MS);
      await use(SERVER_URL);
    } finally {
      killProcess(proc);
    }
  },
});
