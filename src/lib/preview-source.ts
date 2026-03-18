const COMPOSED_STORAGE_PATH_SEGMENTS = [
  "/api/storage/orders/",
  "/api/storage/saved-drafts/",
  "/orders/",
  "/saved-drafts/",
] as const;
const COMPOSED_DATA_URL_MARKER = ";cc-composed=1;";

export function isComposedPreviewSource(source?: string) {
  if (!source) {
    return false;
  }

  if (source.startsWith("data:image/")) {
    return source.toLowerCase().includes(COMPOSED_DATA_URL_MARKER);
  }

  try {
    const resolvedUrl = source.startsWith("http://") || source.startsWith("https://")
      ? new URL(source)
      : new URL(source, "http://localhost");
    const pathname = resolvedUrl.pathname.toLowerCase();
    return COMPOSED_STORAGE_PATH_SEGMENTS.some((segment) => pathname.includes(segment));
  } catch {
    const normalizedSource = source.toLowerCase();
    return COMPOSED_STORAGE_PATH_SEGMENTS.some((segment) => normalizedSource.includes(segment));
  }
}
