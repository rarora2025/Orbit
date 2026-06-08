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
