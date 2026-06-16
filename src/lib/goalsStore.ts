'use client';

import { create } from 'zustand';
import type { Goal } from './goals';
import * as api from './goals.actions';

interface GoalsStore {
  goals: Goal[];
  loaded: boolean;
  /** Ids of goals whose AI image is currently being generated — drives the card
   *  spinner. A goal that finishes with no image (generation failed) is removed
   *  from here, so its card falls back to the initial rather than spinning forever. */
  generatingImageIds: string[];
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
  const markGenerating = (id: string) =>
    set((s) => ({ generatingImageIds: [...s.generatingImageIds, id] }));
  const clearGenerating = (id: string) =>
    set((s) => ({ generatingImageIds: s.generatingImageIds.filter((x) => x !== id) }));

  return {
    goals: [],
    loaded: false,
    generatingImageIds: [],
    setGoals: (goals) => set({ goals, loaded: true }),
    addGoal: async (title) => {
      const created = await api.addGoal({ title });
      upsert(created);
      // Generate the photo in the background (fire-and-forget): the goal is
      // already usable; the card shows a spinner until the image patches in (or
      // generation finishes with no image). generateGoalImage never throws.
      markGenerating(created.id);
      void api.generateGoalImage(created.id, created.title).then((withImage) => {
        if (withImage) upsert(withImage);
        clearGenerating(created.id);
      });
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
      markGenerating(id);
      try {
        const updated = await api.generateGoalImage(id, goal.title);
        if (updated) upsert(updated);
      } finally {
        clearGenerating(id);
      }
    },
  };
});
