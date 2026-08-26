/**
 * 地图目录：服务器是地图与门的权威来源。
 * Unity 客户端后续将从后台下载地图（图片 + 网格数据），门的位置/目标由这里定义。
 *
 * position 为归一化坐标 [0,1]，y 向下（与图片像素坐标一致，左上角为原点）。
 */

export interface CatalogDoor {
  id: string;
  /** 归一化位置，y 向下 */
  position: { x: number; y: number };
  targetMap: string;
  targetSpawn: string;
  isPortal: boolean;
}

export interface MapCatalogEntry {
  name: string;
  /** /maps/ 下的图片文件名 */
  image: string;
  width: number;
  height: number;
  spawns: string[];
  doors: CatalogDoor[];
}

export const mapCatalog: MapCatalogEntry[] = [
  {
    name: 'Map001',
    image: 'Map001.png',
    width: 1920,
    height: 1080,
    spawns: ['Map001_001'],
    doors: [
      {
        id: 'Map001_Door_1',
        position: { x: 0.801, y: 0.477 },
        targetMap: 'Map002',
        targetSpawn: 'Map002_001',
        isPortal: true,
      },
      {
        id: 'Map001_Door_2',
        position: { x: 0.476, y: 0.589 },
        targetMap: 'Map002',
        targetSpawn: 'Map002_001',
        isPortal: false,
      },
    ],
  },
  {
    name: 'Map002',
    image: 'Map002.png',
    width: 1920,
    height: 1080,
    spawns: ['Map002_001'],
    doors: [
      {
        id: 'Map002_Door_1',
        position: { x: 0.5, y: 0.278 },
        targetMap: 'Map003',
        targetSpawn: 'Map003_001',
        isPortal: true,
      },
    ],
  },
  {
    name: 'Map003',
    image: 'Map003.png',
    width: 1920,
    height: 1080,
    spawns: ['Map003_001'],
    doors: [],
  },
];
