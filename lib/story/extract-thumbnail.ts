export function extractFirstImage(html: string): string | null {
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/);
  if (!match) return null;

  const url = match[1];
  if (!url.startsWith('http://') && !url.startsWith('https://')) return null;
  return url;
}

export function extractTextPreview(html: string, maxLength = 120): string {
  const text = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
}
