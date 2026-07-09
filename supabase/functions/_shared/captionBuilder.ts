/**
 * Caption Builder – combines AI‑generated draft, article title, optional hashtags
 * and a short CTA. The implementation is lightweight but can be replaced with a
 * more sophisticated LLM prompt later.
 */

export function buildCaption(params: {
  title: string;
  draft?: string;
  hashtags?: string[];
  url?: string;
}): string {
  const parts: string[] = [];
  if (params.draft) {
    parts.push(params.draft.trim());
  } else {
    parts.push(params.title.trim());
  }
  if (params.url) {
    parts.push(`Read more: ${params.url}`);
  }
  if (params.hashtags && params.hashtags.length > 0) {
    const tagStr = params.hashtags.map((t) => `#${t.replace(/\s+/g, "").toLowerCase()}`).join(" ");
    parts.push(tagStr);
  }
  return parts.join("\n\n");
}
