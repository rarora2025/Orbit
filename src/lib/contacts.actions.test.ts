import { describe, it, expect, vi, beforeEach } from 'vitest';

const order = vi.fn();
const eq = vi.fn();
const select = vi.fn();
const insert = vi.fn();
const del = vi.fn();
const from = vi.fn();
const authMock = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }));
vi.mock('./supabase', () => ({ supabaseAdmin: { from } }));

beforeEach(() => {
  vi.clearAllMocks();
  order.mockResolvedValue({ data: [], error: null });
  eq.mockReturnValue({ order, eq, select });
  select.mockReturnValue({ eq, order });
  del.mockReturnValue({ eq });
  insert.mockReturnValue({ select: () => ({ single: () => ({ data: {}, error: null }) }) });
  from.mockReturnValue({ select, insert, delete: del });
});

describe('listContacts', () => {
  it('throws when there is no signed-in user', async () => {
    authMock.mockResolvedValue({ userId: null });
    const { listContacts } = await import('./contacts.actions');
    await expect(listContacts()).rejects.toThrow(/auth/i);
  });

  it('scopes the read to the Clerk userId', async () => {
    authMock.mockResolvedValue({ userId: 'user_123' });
    const { listContacts } = await import('./contacts.actions');
    await listContacts();
    expect(from).toHaveBeenCalledWith('contacts');
    expect(eq).toHaveBeenCalledWith('user_id', 'user_123');
  });
});

describe('deleteContact', () => {
  it('scopes the delete to the userId and the id', async () => {
    authMock.mockResolvedValue({ userId: 'user_123' });
    const { deleteContact } = await import('./contacts.actions');
    await deleteContact('contact_1');
    expect(eq).toHaveBeenCalledWith('user_id', 'user_123');
    expect(eq).toHaveBeenCalledWith('id', 'contact_1');
  });
});

describe('listContacts interactions join', () => {
  it('attaches interactions from the table, newest first, overriding the blob', async () => {
    authMock.mockResolvedValue({ userId: 'user_123' });

    // contacts query resolves first (order on contacts), interactions query second.
    order
      .mockResolvedValueOnce({
        data: [{ id: 'c1', position: 1000, data: { id: 'c1', status: 'Send', interactions: [{ id: 'stale', date: '2000-01-01', type: 'note', content: 'blob' }] } }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          { id: 'i1', contact_id: 'c1', type: 'note_added', content: 'older', due_at: null, created_at: '2026-06-10T00:00:00.000Z' },
          { id: 'i2', contact_id: 'c1', type: 'message_sent', content: 'newer', due_at: null, created_at: '2026-06-11T00:00:00.000Z' },
        ],
        error: null,
      });

    const { listContacts } = await import('./contacts.actions');
    const contacts = await listContacts();
    const c1 = contacts.find((c) => c.id === 'c1')!;
    expect(c1.interactions.map((i) => i.id)).toEqual(['i2', 'i1']); // newest first
    expect(c1.interactions.some((i) => i.id === 'stale')).toBe(false); // blob copy ignored
  });
});
