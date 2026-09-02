export interface MapInfo {
  name: string;
  image: string;
}

export interface MapsApiResponse {
  maps?: MapInfo[];
}

function isValidMapInfo(entry: unknown): entry is MapInfo {
  return (
    typeof entry === 'object' &&
    entry !== null &&
    typeof (entry as MapInfo).name === 'string' &&
    (entry as MapInfo).name.length > 0 &&
    typeof (entry as MapInfo).image === 'string' &&
    (entry as MapInfo).image.length > 0
  );
}

export async function fetchMapList(): Promise<MapInfo[]> {
  const res = await fetch('/api/maps');
  if (!res.ok) throw new Error(`Failed to fetch maps: ${res.status}`);
  const data = (await res.json()) as MapsApiResponse;
  return Array.isArray(data.maps) ? data.maps.filter(isValidMapInfo) : [];
}
