/**
 * Simple hashtag generator – given an array of article tags, produce up to 5 hashtags.
 * In production you could replace this with an LLM call.
 */
export function generateHashtags(tags: string[]): string[] {
  const max = 5;
  return tags.slice(0, max).map((t) => t.replace(/\s+/g, "").toLowerCase());
}
