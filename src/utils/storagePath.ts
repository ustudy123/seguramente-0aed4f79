export function sanitizeStoragePathSegment(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function buildSafeStorageFileName(documentoId: string, originalName: string) {
  const trimmed = originalName.trim();
  const dotIndex = trimmed.lastIndexOf(".");
  const baseName = dotIndex > 0 ? trimmed.slice(0, dotIndex) : trimmed;
  const extension = dotIndex > 0 ? trimmed.slice(dotIndex + 1) : "";

  const safeBaseName = sanitizeStoragePathSegment(baseName) || "arquivo";
  const safeExtension = sanitizeStoragePathSegment(extension);

  return safeExtension
    ? `${documentoId}-${safeBaseName}.${safeExtension}`
    : `${documentoId}-${safeBaseName}`;
}