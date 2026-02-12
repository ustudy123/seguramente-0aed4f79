const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

export interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

/**
 * Geocode a city/state pair using the free Nominatim (OpenStreetMap) API.
 * Returns lat/lng or null if not found.
 */
export async function geocodeCidade(
  cidade: string,
  estado: string
): Promise<{ lat: number; lng: number } | null> {
  if (!cidade && !estado) return null;

  const query = [cidade, estado, "Brasil"].filter(Boolean).join(", ");

  try {
    const res = await fetch(
      `${NOMINATIM_BASE}/search?` +
        new URLSearchParams({
          q: query,
          format: "json",
          limit: "1",
          countrycodes: "br",
        }),
      {
        headers: {
          "User-Agent": "Seguramente/1.0",
          Accept: "application/json",
        },
      }
    );

    if (!res.ok) return null;

    const data: NominatimResult[] = await res.json();
    if (data.length === 0) return null;

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    };
  } catch {
    return null;
  }
}
