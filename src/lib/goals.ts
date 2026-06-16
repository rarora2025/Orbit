/** A goal the user is pursuing — title, AI photo, and the people tied to it. */
export interface Goal {
  id: string;
  title: string;
  /** AI-generated, key-free media URL. `null` while generating or on failure. */
  imageUrl: string | null;
  /** Contact ids associated with this goal (single source of truth for the link). */
  memberIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** Default, tasteful image prompt built from a goal title (no user prompt-writing). */
export function goalImagePrompt(title: string): string {
  return `"${title.trim()}", minimal modern editorial illustration, soft warm palette, abstract, no text`;
}

/** Add the id if absent, remove it if present. Pure — returns a new array. */
export function toggleMember(memberIds: string[], contactId: string): string[] {
  return memberIds.includes(contactId)
    ? memberIds.filter((id) => id !== contactId)
    : [...memberIds, contactId];
}
