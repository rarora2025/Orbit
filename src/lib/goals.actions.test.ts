import { describe, it, expect, vi, beforeEach } from 'vitest';

const order = vi.fn();
const eq = vi.fn();
const select = vi.fn();
const insert = vi.fn();
const update = vi.fn();
const del = vi.fn();
const from = vi.fn();
const authMock = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }));
vi.mock('./supabase', () => ({ supabaseAdmin: { from } }));

const single = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  order.mockResolvedValue({ data: [], error: null });
  single.mockResolvedValue({ data: { id: 'g1', user_id: 'user_123', title: 'T', image_url: null, member_ids: [], created_at: '', updated_at: '' }, error: null });
  eq.mockReturnValue({ order, eq, select, single });
  select.mockReturnValue({ eq, order, single });
  insert.mockReturnValue({ select: () => ({ single }) });
  update.mockReturnValue({ eq });
  del.mockReturnValue({ eq });
  from.mockReturnValue({ select, insert, update, delete: del });
  authMock.mockResolvedValue({ userId: 'user_123' });
});

describe('listGoals', () => {
  it('throws when there is no signed-in user', async () => {
    authMock.mockResolvedValue({ userId: null });
    const { listGoals } = await import('./goals.actions');
    await expect(listGoals()).rejects.toThrow(/auth/i);
  });

  it('scopes the read to the Clerk userId and maps rows to Goal', async () => {
    order.mockResolvedValueOnce({
      data: [{ id: 'g1', user_id: 'user_123', title: 'Recruiting', image_url: 'http://x/y', member_ids: ['c1'], created_at: 'a', updated_at: 'b' }],
      error: null,
    });
    const { listGoals } = await import('./goals.actions');
    const goals = await listGoals();
    expect(from).toHaveBeenCalledWith('goals');
    expect(eq).toHaveBeenCalledWith('user_id', 'user_123');
    expect(goals[0]).toEqual({ id: 'g1', title: 'Recruiting', imageUrl: 'http://x/y', memberIds: ['c1'], createdAt: 'a', updatedAt: 'b' });
  });
});

describe('addGoal', () => {
  it('inserts a goal scoped to the userId with empty members and no image', async () => {
    const { addGoal } = await import('./goals.actions');
    await addGoal({ title: 'New Goal' });
    const payload = insert.mock.calls[0][0];
    expect(payload.user_id).toBe('user_123');
    expect(payload.title).toBe('New Goal');
    expect(payload.member_ids).toEqual([]);
    expect(payload.image_url).toBeNull();
  });
});

describe('updateGoal', () => {
  it('patches only the supplied fields, scoped to user + id', async () => {
    const { updateGoal } = await import('./goals.actions');
    await updateGoal('g1', { imageUrl: 'http://media/x' });
    const patch = update.mock.calls[0][0];
    expect(patch.image_url).toBe('http://media/x');
    expect('title' in patch).toBe(false); // title omitted when not supplied
    expect(patch.updated_at).toBeTruthy();
    expect(eq).toHaveBeenCalledWith('user_id', 'user_123');
    expect(eq).toHaveBeenCalledWith('id', 'g1');
  });

  it('trims the title when supplied', async () => {
    const { updateGoal } = await import('./goals.actions');
    await updateGoal('g1', { title: '  Renamed  ' });
    expect(update.mock.calls[0][0].title).toBe('Renamed');
  });
});

describe('deleteGoal', () => {
  it('scopes the delete to the userId and the id', async () => {
    const { deleteGoal } = await import('./goals.actions');
    await deleteGoal('g1');
    expect(eq).toHaveBeenCalledWith('user_id', 'user_123');
    expect(eq).toHaveBeenCalledWith('id', 'g1');
  });
});

describe('addGoalMember / removeGoalMember', () => {
  function seedGoal(memberIds: string[]) {
    order.mockResolvedValueOnce({
      data: [{ id: 'g1', user_id: 'user_123', title: 'T', image_url: null, member_ids: memberIds, created_at: '', updated_at: '' }],
      error: null,
    });
  }

  it('addGoalMember appends a contact id, scoped to user + goal', async () => {
    seedGoal([]);
    const { addGoalMember } = await import('./goals.actions');
    await addGoalMember('g1', 'c1');
    expect(update.mock.calls[0][0].member_ids).toEqual(['c1']);
    expect(eq).toHaveBeenCalledWith('user_id', 'user_123');
    expect(eq).toHaveBeenCalledWith('id', 'g1');
  });

  it('addGoalMember is a no-op when the contact is already a member', async () => {
    seedGoal(['c1']);
    const { addGoalMember } = await import('./goals.actions');
    await addGoalMember('g1', 'c1');
    expect(update.mock.calls[0][0].member_ids).toEqual(['c1']);
  });

  it('removeGoalMember drops the contact id', async () => {
    seedGoal(['c1', 'c2']);
    const { removeGoalMember } = await import('./goals.actions');
    await removeGoalMember('g1', 'c1');
    expect(update.mock.calls[0][0].member_ids).toEqual(['c2']);
  });

  it('member ops on a foreign goal id throw (goal not found)', async () => {
    seedGoal([]); // listGoals returns only g1
    const { addGoalMember } = await import('./goals.actions');
    await expect(addGoalMember('does-not-exist', 'c1')).rejects.toThrow(/not found/i);
  });
});
