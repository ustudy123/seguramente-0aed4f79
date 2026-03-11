import { useState, useCallback } from "react";

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  endereco: string | null;
  loading: boolean;
  error: string | null;
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    endereco: null,
    loading: false,
    error: null,
  });

  const capturarLocalizacao = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Geolocalização não suportada pelo navegador"));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const { latitude, longitude } = position.coords;

      // Reverse geocode via Nominatim
      let endereco: string | null = null;
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=pt-BR`,
          { headers: { "User-Agent": "Seguramente/1.0", Accept: "application/json" } }
        );
        if (res.ok) {
          const data = await res.json();
          endereco = data.display_name || null;
        }
      } catch {
        // Reverse geocode is optional
      }

      setState({ latitude, longitude, endereco, loading: false, error: null });
      return { latitude, longitude, endereco };
    } catch (err) {
      const message = err instanceof GeolocationPositionError
        ? ({
            1: "Permissão de localização negada",
            2: "Localização indisponível",
            3: "Tempo esgotado ao obter localização",
          } as Record<number, string>)[err.code] || "Erro de geolocalização"
        : err instanceof Error
          ? err.message
          : "Erro ao obter localização";

      setState(prev => ({ ...prev, loading: false, error: message }));
      return null;
    }
  }, []);

  const limpar = useCallback(() => {
    setState({ latitude: null, longitude: null, endereco: null, loading: false, error: null });
  }, []);

  return { ...state, capturarLocalizacao, limpar };
}
