'use client';

import { useEffect } from 'react';
import { useCRMStore } from '@/lib/store';
import { useChatStore } from '@/lib/chatStore';
import { useGoalsStore } from '@/lib/goalsStore';
import { listContacts } from '@/lib/contacts.actions';
import { listSessions } from '@/lib/chats.actions';
import { listGoals } from '@/lib/goals.actions';

/** Loads the signed-in user's contacts, chat sessions, and goals into the stores once. */
export default function StoreHydrator() {
  const setContacts = useCRMStore((s) => s.setContacts);
  const setSessions = useChatStore((s) => s.setSessions);
  const setGoals = useGoalsStore((s) => s.setGoals);
  useEffect(() => {
    listContacts().then(setContacts).catch((e) => console.error('Failed to load contacts', e));
    listSessions().then(setSessions).catch((e) => console.error('Failed to load chats', e));
    listGoals().then(setGoals).catch((e) => console.error('Failed to load goals', e));
  }, [setContacts, setSessions, setGoals]);
  return null;
}
