const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export function resolveFileUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${API_BASE_URL}${url}`;
  return url;
}
