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

describe('listContacts goal derivation from membership', () => {
  it('sets contact.goal to the joined titles of goals the contact belongs to', async () => {
    authMock.mockResolvedValue({ userId: 'user_123' });
    // 1) contacts read, 2) interactions read, 3) goals read — in call order.
    order
      .mockResolvedValueOnce({
        data: [
          { id: 'c1', position: 1000, data: { id: 'c1', status: 'Send', goal: 'STALE', interactions: [] } },
          { id: 'c2', position: 2000, data: { id: 'c2', status: 'Send', goal: 'ALSO STALE', interactions: [] } },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null }) // interactions
      .mockResolvedValueOnce({
        data: [
          { id: 'g1', title: 'Recruiting', image_url: null, member_ids: ['c1'], created_at: '', updated_at: '' },
          { id: 'g2', title: 'Fundraising', image_url: null, member_ids: ['c1'], created_at: '', updated_at: '' },
        ],
        error: null,
      });

    const { listContacts } = await import('./contacts.actions');
    const contacts = await listContacts();
    expect(contacts.find((c) => c.id === 'c1')?.goal).toBe('Recruiting, Fundraising');
    expect(contacts.find((c) => c.id === 'c2')?.goal).toBeUndefined(); // cleared despite stale blob value
  });
});

describe('lastContacted "last activity" stamping', () => {
  // Seed one existing contact for the read, then an empty interactions read.
  function seedContact(lastContacted: string) {
    order
      .mockResolvedValueOnce({
        data: [{ id: 'c1', position: 1000, data: { id: 'c1', status: 'Send', lastContacted, interactions: [] } }],
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null });
  }

  // A chainable .update(...).eq().eq().select().single() that captures its payload.
  function captureUpdate(returnPosition: number) {
    return vi.fn().mockReturnValue({
      eq: () => ({ eq: () => ({ select: () => ({ single: () => ({ data: { id: 'c1', position: returnPosition, data: {} }, error: null }) }) }) }),
    });
  }

  it('updateContact preserves the prior lastContacted (edits are not activity)', async () => {
    authMock.mockResolvedValue({ userId: 'user_123' });
    seedContact('2020-01-01');
    const update = captureUpdate(1000);
    from.mockReturnValue({ select, insert, delete: del, update });

    const { updateContact } = await import('./contacts.actions');
    await updateContact('c1', { name: 'New Name' });

    expect(update.mock.calls[0][0].data.lastContacted).toBe('2020-01-01');
  });

  it('moveContact bumps lastContacted to now', async () => {
    authMock.mockResolvedValue({ userId: 'user_123' });
    seedContact('2020-01-01');
    const update = captureUpdate(2000);
    from.mockReturnValue({ select, insert, delete: del, update });

    const { moveContact } = await import('./contacts.actions');
    const before = Date.now();
    await moveContact('c1', 'Pending', null);

    const stored = update.mock.calls[0][0].data.lastContacted;
    expect(new Date(stored).getTime()).toBeGreaterThanOrEqual(before);
  });
});
