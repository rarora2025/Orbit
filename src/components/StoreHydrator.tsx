'use client';

import { useEffect } from 'react';
import { useCRMStore } from '@/lib/store';
import { useChatStore } from '@/lib/chatStore';
import { listContacts } from '@/lib/contacts.actions';
import { listSessions } from '@/lib/chats.actions';

/** Loads the signed-in user's contacts and chat sessions into the stores once. */
export default function StoreHydrator() {
  const setContacts = useCRMStore((s) => s.setContacts);
  const setSessions = useChatStore((s) => s.setSessions);
  useEffect(() => {
    listContacts().then(setContacts).catch((e) => console.error('Failed to load contacts', e));
    listSessions().then(setSessions).catch((e) => console.error('Failed to load chats', e));
  }, [setContacts, setSessions]);
  return null;
}
