import { describe, it, expect, vi, beforeEach } from 'vitest';

const order = vi.fn();
const eq = vi.fn();
const select = vi.fn();
const upsert = vi.fn();
const del = vi.fn();
const from = vi.fn();
const authMock = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }));
vi.mock('./supabase', () => ({ supabaseAdmin: { from } }));

beforeEach(() => {
  vi.clearAllMocks();
  order.mockResolvedValue({ data: [], error: null });
  eq.mockReturnValue({ order, eq });
  select.mockReturnValue({ eq });
  upsert.mockResolvedValue({ error: null });
  del.mockReturnValue({ eq });
  from.mockReturnValue({ select, upsert, delete: del });
});

describe('listSessions', () => {
  it('throws when there is no signed-in user', async () => {
    authMock.mockResolvedValue({ userId: null });
    const { listSessions } = await import('./chats.actions');
    await expect(listSessions()).rejects.toThrow(/auth/i);
  });

  it('scopes the read to the Clerk userId', async () => {
    authMock.mockResolvedValue({ userId: 'user_123' });
    const { listSessions } = await import('./chats.actions');
    await listSessions();
    expect(from).toHaveBeenCalledWith('chat_sessions');
    expect(eq).toHaveBeenCalledWith('user_id', 'user_123');
  });
});

describe('upsertSession', () => {
  it('writes a row carrying the userId', async () => {
    authMock.mockResolvedValue({ userId: 'user_123' });
    const { upsertSession } = await import('./chats.actions');
    await upsertSession({ id: 's1', title: 'Hi', messages: [], updatedAt: 1000 });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 's1', user_id: 'user_123', title: 'Hi' }),
    );
  });
});

describe('deleteSession', () => {
  it('scopes the delete to the userId and the id', async () => {
    authMock.mockResolvedValue({ userId: 'user_123' });
    const { deleteSession } = await import('./chats.actions');
    await deleteSession('s1');
    expect(eq).toHaveBeenCalledWith('user_id', 'user_123');
    expect(eq).toHaveBeenCalledWith('id', 's1');
  });
});
