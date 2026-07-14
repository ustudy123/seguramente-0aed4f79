/**
 * Converte uma URL de vídeo (YouTube, Vimeo, Loom, Bunny) na URL de
 * *embed* correspondente, própria para uso em <iframe src>.
 *
 * Motivação: colar a URL de compartilhamento direto no iframe (ex.:
 * `https://youtu.be/ID` ou a página `youtube.com/watch?v=ID`) faz o
 * provedor recusar o enquadramento ("A conexão com www.youtube.com foi
 * recusada" / X-Frame-Options). O player só embuta pela URL de embed
 * (`youtube.com/embed/ID`).
 *
 * Cobre os formatos usuais do YouTube: watch?v=, embed/, youtu.be/,
 * shorts/ e live/ — inclusive com parâmetros extras (?si=, &t=, playlist).
 * Para provedores não reconhecidos, devolve a URL original (fallback),
 * o que atende PDFs e iframes genéricos já hospedados.
 */
export function getEmbedUrl(url: string | null | undefined): string {
  if (!url) return "";

  const raw = url.trim();

  // YouTube: watch?v=, embed/, shorts/, live/ ou youtu.be/
  const yt = raw.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0`;

  // Vimeo
  const vimeo = raw.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;

  // Loom
  const loom = raw.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/);
  if (loom) return `https://www.loom.com/embed/${loom[1]}`;

  // Google Slides / Docs / Sheets → variante embutível
  const gSlides = raw.match(/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/);
  if (gSlides) return `https://docs.google.com/presentation/d/${gSlides[1]}/embed`;
  const gDoc = raw.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (gDoc) return `https://docs.google.com/document/d/${gDoc[1]}/preview`;
  const gSheet = raw.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (gSheet) return `https://docs.google.com/spreadsheets/d/${gSheet[1]}/preview`;

  // Google Drive (arquivo, ex.: PDF compartilhado) → /preview
  const gDrive = raw.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (gDrive) return `https://drive.google.com/file/d/${gDrive[1]}/preview`;

  // Bunny Stream / iframe.mediadelivery.net já vêm como embed
  if (raw.includes("iframe.mediadelivery.net") || raw.includes("bunny")) {
    return raw;
  }

  // Fallback: devolve a URL como está (PDF, iframe genérico, etc.)
  return raw;
}
