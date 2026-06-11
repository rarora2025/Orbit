import { describe, it, expect, vi, beforeEach } from 'vitest';

const insert = vi.fn();
const order = vi.fn();
const eq = vi.fn();
const select = vi.fn();
const from = vi.fn();
const authMock = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }));
vi.mock('./supabase', () => ({ supabaseAdmin: { from } }));

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ userId: 'user_123' });
  insert.mockResolvedValue({ error: null });
  order.mockResolvedValue({ data: [], error: null });
  eq.mockReturnValue({ eq, order });
  select.mockReturnValue({ eq, order });
  from.mockReturnValue({ insert, select });
});

describe('insertInteraction', () => {
  it('inserts a row into the interactions table scoped to the user', async () => {
    const { insertInteraction } = await import('./interactions.actions');
    await insertInteraction('contact_1', { type: 'note_added', content: 'hi', dueAt: '2026-06-18T12:00:00.000Z' });
    expect(from).toHaveBeenCalledWith('interactions');
    const row = insert.mock.calls[0][0];
    expect(row).toMatchObject({
      user_id: 'user_123',
      contact_id: 'contact_1',
      type: 'note_added',
      content: 'hi',
      due_at: '2026-06-18T12:00:00.000Z',
    });
    expect(typeof row.id).toBe('string');
    expect(typeof row.created_at).toBe('string');
  });

  it('throws when not authenticated', async () => {
    authMock.mockResolvedValue({ userId: null });
    const { insertInteraction } = await import('./interactions.actions');
    await expect(insertInteraction('c', { type: 'note_added', content: 'x' })).rejects.toThrow(/auth/i);
  });
});

describe('listUserInteractions', () => {
  it('selects the user rows and maps them to Interaction objects grouped by contact', async () => {
    order.mockResolvedValue({
      data: [
        { id: 'i1', contact_id: 'c1', type: 'note_added', content: 'a', due_at: null, created_at: '2026-06-10T00:00:00.000Z' },
        { id: 'i2', contact_id: 'c1', type: 'meeting_scheduled', content: 'm', due_at: '2026-06-18T14:00:00.000Z', created_at: '2026-06-11T00:00:00.000Z' },
      ],
      error: null,
    });
    const { listUserInteractions } = await import('./interactions.actions');
    const byContact = await listUserInteractions('user_123');
    expect(from).toHaveBeenCalledWith('interactions');
    expect(eq).toHaveBeenCalledWith('user_id', 'user_123');
    const c1 = byContact.get('c1')!;
    expect(c1).toHaveLength(2);
    expect(c1[0]).toMatchObject({ id: 'i1', type: 'note_added', content: 'a', date: '2026-06-10T00:00:00.000Z' });
    expect(c1[1]).toMatchObject({ id: 'i2', type: 'meeting_scheduled', dueAt: '2026-06-18T14:00:00.000Z' });
  });
});
