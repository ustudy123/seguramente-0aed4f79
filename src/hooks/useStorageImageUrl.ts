import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function extractStoragePath(value?: string | null, bucket?: string): string | null {
  if (!value) return null;

  const normalized = value.trim();
  if (!normalized) return null;

  if (!normalized.startsWith("http")) {
    return normalized;
  }

  try {
    const url = new URL(normalized);
    const match = url.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);

    if (!match) return null;

    const [, matchedBucket, objectPath] = match;
    if (bucket && matchedBucket !== bucket) return null;

    return decodeURIComponent(objectPath);
  } catch {
    return null;
  }
}

export async function resolveStorageImageUrl(value?: string | null, bucket = "documentos"): Promise<string | null> {
  if (!value) return null;

  const storagePath = extractStoragePath(value, bucket);
  if (!storagePath) {
    return value.startsWith("http") ? value : null;
  }

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 3600);

  if (error) {
    console.error("Erro ao gerar URL assinada da imagem:", error);
    return null;
  }

  return data.signedUrl;
}

export function useStorageImageUrl(value?: string | null, bucket = "documentos") {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadImage = async () => {
      if (!value) {
        setResolvedUrl(null);
        return;
      }

      const url = await resolveStorageImageUrl(value, bucket);

      if (active) {
        setResolvedUrl(url);
      }
    };

    loadImage();

    return () => {
      active = false;
    };
  }, [bucket, value]);

  return resolvedUrl;
}