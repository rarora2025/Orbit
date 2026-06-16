'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useCRMStore } from '@/lib/store';
import { useGoalsStore } from '@/lib/goalsStore';
import { useChatStore } from '@/lib/chatStore';

/**
 * Sends a brand-new account into the onboarding flow. The post-sign-up redirect
 * handles the happy path; this is the backstop for anyone who lands in the app
 * without having completed it (closed the tab mid-flow, deep-linked, etc.).
 *
 * Deliberately conservative so it never bounces an established user: it only
 * redirects once Clerk + both stores have loaded AND the account is genuinely
 * empty (no contacts, goals, or chats) AND it isn't flagged as onboarded.
 */
export default function OnboardingGate() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const contactsLoaded = useCRMStore((s) => s.loaded);
  const contactCount = useCRMStore((s) => s.contacts.length);
  const goalsLoaded = useGoalsStore((s) => s.loaded);
  const goalCount = useGoalsStore((s) => s.goals.length);
  const sessionCount = useChatStore((s) => s.sessions.length);

  const onboarded = user?.unsafeMetadata?.onboarded === true;
  const ready = isLoaded && !!user && contactsLoaded && goalsLoaded;
  const isEmpty = contactCount === 0 && goalCount === 0 && sessionCount === 0;

  useEffect(() => {
    if (ready && !onboarded && isEmpty) router.replace('/onboarding');
  }, [ready, onboarded, isEmpty, router]);

  return null;
}
