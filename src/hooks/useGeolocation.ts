import { useState, useCallback, useRef } from "react";

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  endereco: string | null;
  loading: boolean;
  error: string | null;
}

const ACCURACY_THRESHOLD = 50; // metros - considera "boa" precisão
const MAX_WAIT_TIME = 15000; // tempo máximo para refinar posição

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    endereco: null,
    loading: false,
    error: null,
  });
  const watchIdRef = useRef<number | null>(null);

  const reverseGeocode = async (lat: number, lon: number): Promise<string | null> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&accept-language=pt-BR&zoom=18`,
        { headers: { "User-Agent": "Seguramente/1.0", Accept: "application/json" } }
      );
      if (res.ok) {
        const data = await res.json();
        // Montar endereço mais legível a partir dos detalhes
        const addr = data.address;
        if (addr) {
          const parts = [
            addr.road,
            addr.house_number ? `nº ${addr.house_number}` : null,
            addr.suburb || addr.neighbourhood,
            addr.city || addr.town || addr.village,
            addr.state,
          ].filter(Boolean);
          if (parts.length >= 2) return parts.join(", ");
        }
        return data.display_name || null;
      }
    } catch {
      // Reverse geocode is optional
    }
    return null;
  };

  const capturarLocalizacao = useCallback(async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    if (!navigator.geolocation) {
      setState(prev => ({ ...prev, loading: false, error: "Geolocalização não suportada pelo navegador" }));
      return null;
    }

    return new Promise<{ latitude: number; longitude: number; endereco: string | null } | null>((resolve) => {
      let bestPosition: GeolocationPosition | null = null;
      let resolved = false;

      const finish = async (position: GeolocationPosition) => {
        if (resolved) return;
        resolved = true;
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }

        const { latitude, longitude, accuracy } = position.coords;
        const endereco = await reverseGeocode(latitude, longitude);

        setState({ latitude, longitude, accuracy, endereco, loading: false, error: null });
        resolve({ latitude, longitude, endereco });
      };

      // Timeout de segurança
      const timeout = setTimeout(() => {
        if (!resolved) {
          if (bestPosition) {
            finish(bestPosition);
          } else {
            resolved = true;
            if (watchIdRef.current !== null) {
              navigator.geolocation.clearWatch(watchIdRef.current);
              watchIdRef.current = null;
            }
            setState(prev => ({ ...prev, loading: false, error: "Tempo esgotado ao obter localização precisa" }));
            resolve(null);
          }
        }
      }, MAX_WAIT_TIME);

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const acc = position.coords.accuracy;
          
          // Guardar a melhor posição obtida
          if (!bestPosition || acc < bestPosition.coords.accuracy) {
            bestPosition = position;
            // Atualizar estado intermediário
            setState(prev => ({
              ...prev,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: acc,
            }));
          }

          // Se precisão boa o suficiente, finalizar
          if (acc <= ACCURACY_THRESHOLD) {
            clearTimeout(timeout);
            finish(position);
          }
        },
        (err) => {
          if (resolved) return;
          clearTimeout(timeout);
          resolved = true;
          if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }
          const message = ({
            1: "Permissão de localização negada",
            2: "Localização indisponível",
            3: "Tempo esgotado ao obter localização",
          } as Record<number, string>)[err.code] || "Erro de geolocalização";

          setState(prev => ({ ...prev, loading: false, error: message }));
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: MAX_WAIT_TIME,
          maximumAge: 0,
        }
      );
    });
  }, []);

  const limpar = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setState({ latitude: null, longitude: null, accuracy: null, endereco: null, loading: false, error: null });
  }, []);

  return { ...state, capturarLocalizacao, limpar };
}
