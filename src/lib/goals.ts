/** A goal the user is pursuing — title, AI photo, and the people tied to it. */
export interface Goal {
  id: string;
  title: string;
  /** AI-generated, key-free media URL. `null` while generating or on failure. */
  imageUrl: string | null;
  /** Contact ids associated with this goal. Mirrors the `member_ids` column;
   *  the DB row is the canonical store. */
  memberIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** Default, tasteful image prompt built from a goal title (no user prompt-writing).
 *  The title is user input, so quotes/newlines are stripped and the length is
 *  capped to keep it from breaking out of or bloating the prompt. */
export function goalImagePrompt(title: string): string {
  const clean = title.replace(/["\n\r]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
  return `"${clean}", minimal modern editorial illustration, soft warm palette, abstract, no text`;
}
