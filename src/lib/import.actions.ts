'use server';

import OpenAI from 'openai';
import { parseContactLines, toImportRow, type ImportRow } from './import';

// gpt-4o-mini is plenty for extraction and keeps imports cheap. Bump as needed.
const MODEL = 'gpt-4o-mini';

const SYSTEM = [
  'You extract contacts from arbitrary user-pasted text for a personal CRM.',
  'The input may be a CSV, a tab/semicolon table (possibly with a header row), an email signature block, a numbered or bulleted list, or messy free text — any format.',
  'Return ONLY a JSON object of the form {"contacts": [{ "name": string, "company"?: string, "role"?: string, "email"?: string, "phone"?: string, "status"?: string, "warmth"?: string, "tags"?: string[] }]}.',
  'One object per real person. Use the person\'s full name for "name".',
  'CRITICAL: process EVERY data row the same way. For each row, fill in every field the row provides — never drop a company, status, or warmth that is present, including on the first row. Be consistent across all rows.',
  'If a column or value names an organization, put it in "company". If a value is a job title (e.g. "Head of Markets, Novig" → role "Head of Markets", company "Novig"), split it into role and company.',
  '"role" is ONLY a job title (e.g. "Founder", "Head of Markets"). Topics, categories, or sources that are not a job title or organization (e.g. "Networking", "Series", "Fantasy Sports") go in "tags", never in "role" or "company".',
  'When the source has a pipeline/Status column, map it to exactly one of: "Send", "Pending", "Response", "Ghosted", "Meeting Scheduled", "Met", "Long-term". Use the closest match; omit if there is none.',
  'When the source has a temperature/Temp/priority column (often star ratings), map it to "warmth" of "Low", "Medium", or "High". One star = Low, two stars = Medium, three or more stars = High.',
  'Omit any field that is genuinely not present — never invent or guess emails, phones, companies, statuses, or warmth.',
  'Use the header row only to understand which column is which; never emit it as a person. Skip column titles, separators, and any line that is not a person.',
  'Example — for the header "Person | Status | Temp. | Inquiry | Date" and the row "Shayne Coplan | Pending | *** | Polymarket | 5/29", output {"name":"Shayne Coplan","company":"Polymarket","status":"Pending","warmth":"High"} (the Date column is ignored).',
  'If you find no people, return {"contacts": []}.',
].join(' ');

/**
 * Parse pasted/CSV contact text into clean rows using OpenAI. Always preferred
 * over the heuristic so any format works. Falls back to `parseContactLines`
 * when the key is missing or the API errors/returns unusable output, so import
 * never breaks. Returns [] only when there genuinely are no contacts.
 */
export async function parseContactsWithAI(text: string): Promise<ImportRow[]> {
  const input = text.trim();
  if (!input) return [];

  const apiKey = process.env.OPEN_AI_KEY;
  if (!apiKey) return parseContactLines(input);

  try {
    const openai = new OpenAI({ apiKey });
    const res = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: input.slice(0, 12000) },
      ],
    });
    const raw = res.choices[0]?.message?.content?.trim();
    if (!raw) return parseContactLines(input);

    const parsed = JSON.parse(raw) as { contacts?: unknown };
    const list = Array.isArray(parsed.contacts) ? parsed.contacts : [];
    const rows = list.map(toImportRow).filter((r): r is ImportRow => r !== null);

    // If the model returned nothing usable but there clearly was text, fall back
    // to the heuristic rather than silently dropping the user's paste.
    return rows.length ? rows : parseContactLines(input);
  } catch (err) {
    console.warn('parseContactsWithAI fell back to heuristic', err);
    return parseContactLines(input);
  }
}
