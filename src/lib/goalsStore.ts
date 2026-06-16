'use client';

import { create } from 'zustand';
import type { Goal } from './goals';
import * as api from './goals.actions';

interface GoalsStore {
  goals: Goal[];
  loaded: boolean;
  setGoals: (goals: Goal[]) => void;
  addGoal: (title: string) => Promise<void>;
  renameGoal: (id: string, title: string) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  addMember: (goalId: string, contactId: string) => Promise<void>;
  removeMember: (goalId: string, contactId: string) => Promise<void>;
  regenerateImage: (id: string) => Promise<void>;
}

export const useGoalsStore = create<GoalsStore>()((set, get) => {
  const upsert = (goal: Goal) =>
    set((s) => ({ goals: [...s.goals.filter((g) => g.id !== goal.id), goal] }));

  return {
    goals: [],
    loaded: false,
    setGoals: (goals) => set({ goals, loaded: true }),
    addGoal: async (title) => {
      const created = await api.addGoal({ title });
      upsert(created);
      // Generate the photo in the background; patch it in when ready.
      const withImage = await api.generateGoalImage(created.id, created.title);
      if (withImage) upsert(withImage);
    },
    renameGoal: async (id, title) => { upsert(await api.updateGoal(id, { title })); },
    deleteGoal: async (id) => {
      await api.deleteGoal(id);
      set((s) => ({ goals: s.goals.filter((g) => g.id !== id) }));
    },
    addMember: async (goalId, contactId) => { upsert(await api.addGoalMember(goalId, contactId)); },
    removeMember: async (goalId, contactId) => { upsert(await api.removeGoalMember(goalId, contactId)); },
    regenerateImage: async (id) => {
      const goal = get().goals.find((g) => g.id === id);
      if (!goal) return;
      const updated = await api.generateGoalImage(id, goal.title);
      if (updated) upsert(updated);
    },
  };
});
