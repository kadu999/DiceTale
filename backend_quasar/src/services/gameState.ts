import type { ComponentBlock, GameStateSnapshot, ObjectInfo } from './protocol/types';

function parseBlockData(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'object' && raw !== null) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

export function parseComponentData(raw: unknown): ComponentBlock[] | null {
  let parsed: unknown;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  } else {
    parsed = raw;
  }

  if (!Array.isArray(parsed)) return null;
  return parsed
    .filter(
      (p) =>
        typeof p === 'object' &&
        p !== null &&
        typeof (p as Record<string, unknown>).component === 'string',
    )
    .map((p) => {
      const block = p as Record<string, unknown>;
      return {
        component: block.component as string,
        displayName: block.displayName as string | undefined,
        data: parseBlockData(block.data),
      };
    }) as ComponentBlock[];
}

export function getObjectComponent(
  objects: Record<string, ObjectInfo>,
  objectId: string,
  componentType: string,
): ComponentBlock | undefined {
  const obj = objects[objectId];
  if (!obj?.componentData) return undefined;
  const blocks = parseComponentData(obj.componentData);
  return blocks?.find((b) => b.component === componentType);
}

export function deepCloneSnapshot(snapshot: GameStateSnapshot): GameStateSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as GameStateSnapshot;
}
