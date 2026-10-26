export const MAX_ISSUE_TAGS = 6;
export const MAX_ISSUE_TAG_LENGTH = 40;

export class IssueTagValidationError extends Error {}

export function normalizeIssueTags(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > MAX_ISSUE_TAGS) {
    throw new IssueTagValidationError(`Choose up to ${MAX_ISSUE_TAGS} issue tags.`);
  }
  const seen = new Set<string>();
  return value.map(item => {
    if (typeof item !== "string") throw new IssueTagValidationError("Each issue tag must be text.");
    const label = item.trim().replace(/\s+/g, " ");
    if (!label || label.length > MAX_ISSUE_TAG_LENGTH) {
      throw new IssueTagValidationError(`Issue tags must contain 1–${MAX_ISSUE_TAG_LENGTH} characters.`);
    }
    const key = label.toLowerCase();
    if (seen.has(key)) throw new IssueTagValidationError("Each issue tag must be unique.");
    seen.add(key);
    return label;
  });
}

export function selectProductIssueTags(value: unknown, productTags: string[]): string[] {
  const selected = normalizeIssueTags(value);
  const available = new Map(productTags.map(tag => [tag.toLowerCase(), tag]));
  return selected.map(tag => {
    const label = available.get(tag.toLowerCase());
    if (!label) throw new IssueTagValidationError("The available issue tags changed. Refresh the page and select them again.");
    return label;
  });
}
