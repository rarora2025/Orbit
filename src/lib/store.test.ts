import { describe, it, expect, afterEach } from 'vitest';

// Minimal synchronous localStorage so the persist middleware has somewhere to
// write during the test (the node env has no real one).
function makeLocalStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
    _data: data,
  };
}

afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe('useCRMStore persistence', () => {
  it('writes added contacts to localStorage so they survive a reload', async () => {
    const ls = makeLocalStorage();
    (globalThis as { localStorage?: unknown }).localStorage = ls;

    // Import after the storage global exists so persist binds to it on creation.
    const { useCRMStore } = await import('./store');
    const { mockContacts } = await import('./mockData');

    const newContact = { ...mockContacts[0], id: 'persist-test-1', name: 'Persist Test' };
    useCRMStore.getState().addContact(newContact);

    const raw = ls._data.get('orbit-crm');
    expect(raw, 'persist middleware should have written the store to localStorage').toBeTruthy();

    const persisted = JSON.parse(raw!);
    const ids: string[] = persisted.state.contacts.map((c: { id: string }) => c.id);
    expect(ids).toContain('persist-test-1');
  });
});
