import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./goals.actions', () => ({
  listGoals: vi.fn(),
  addGoal: vi.fn(),
  updateGoal: vi.fn(),
  deleteGoal: vi.fn(),
  addGoalMember: vi.fn(),
  removeGoalMember: vi.fn(),
  generateGoalImage: vi.fn(),
}));

import { useGoalsStore } from './goalsStore';
import type { Goal } from './goals';
import * as api from './goals.actions';

function g(id: string, memberIds: string[] = [], imageUrl: string | null = null): Goal {
  return { id, title: id, imageUrl, memberIds, createdAt: '', updatedAt: '' };
}

beforeEach(() => {
  useGoalsStore.setState({ goals: [], loaded: false });
  vi.clearAllMocks();
});

describe('goalsStore hydration', () => {
  it('setGoals replaces goals and marks loaded', () => {
    useGoalsStore.getState().setGoals([g('a'), g('b')]);
    expect(useGoalsStore.getState().goals.map((x) => x.id)).toEqual(['a', 'b']);
    expect(useGoalsStore.getState().loaded).toBe(true);
  });
});

describe('goalsStore.addGoal', () => {
  it('inserts the created goal then patches in the generated image', async () => {
    (api.addGoal as ReturnType<typeof vi.fn>).mockResolvedValue(g('a'));
    (api.generateGoalImage as ReturnType<typeof vi.fn>).mockResolvedValue(g('a', [], 'http://img'));
    await useGoalsStore.getState().addGoal('My Goal');
    expect(api.addGoal).toHaveBeenCalledWith({ title: 'My Goal' });
    expect(api.generateGoalImage).toHaveBeenCalledWith('a', 'a');
    expect(useGoalsStore.getState().goals.find((x) => x.id === 'a')?.imageUrl).toBe('http://img');
  });

  it('keeps the goal imageless when generation returns null', async () => {
    (api.addGoal as ReturnType<typeof vi.fn>).mockResolvedValue(g('a'));
    (api.generateGoalImage as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await useGoalsStore.getState().addGoal('My Goal');
    expect(useGoalsStore.getState().goals.find((x) => x.id === 'a')?.imageUrl).toBeNull();
  });
});

describe('goalsStore membership + delete', () => {
  it('addMember upserts the returned goal', async () => {
    (api.addGoalMember as ReturnType<typeof vi.fn>).mockResolvedValue(g('a', ['c1']));
    useGoalsStore.setState({ goals: [g('a')], loaded: true });
    await useGoalsStore.getState().addMember('a', 'c1');
    expect(useGoalsStore.getState().goals.find((x) => x.id === 'a')?.memberIds).toEqual(['c1']);
  });

  it('removeMember upserts the returned goal', async () => {
    (api.removeGoalMember as ReturnType<typeof vi.fn>).mockResolvedValue(g('a', []));
    useGoalsStore.setState({ goals: [g('a', ['c1'])], loaded: true });
    await useGoalsStore.getState().removeMember('a', 'c1');
    expect(useGoalsStore.getState().goals.find((x) => x.id === 'a')?.memberIds).toEqual([]);
  });

  it('deleteGoal removes it from the store', async () => {
    (api.deleteGoal as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    useGoalsStore.setState({ goals: [g('a'), g('b')], loaded: true });
    await useGoalsStore.getState().deleteGoal('a');
    expect(useGoalsStore.getState().goals.map((x) => x.id)).toEqual(['b']);
  });

  it('regenerateImage patches the returned image url', async () => {
    (api.generateGoalImage as ReturnType<typeof vi.fn>).mockResolvedValue(g('a', [], 'http://new'));
    useGoalsStore.setState({ goals: [g('a')], loaded: true });
    await useGoalsStore.getState().regenerateImage('a');
    expect(api.generateGoalImage).toHaveBeenCalledWith('a', 'a');
    expect(useGoalsStore.getState().goals.find((x) => x.id === 'a')?.imageUrl).toBe('http://new');
  });
});
