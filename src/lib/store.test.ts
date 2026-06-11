import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./contacts.actions', () => ({
  addContact: vi.fn(),
  updateContact: vi.fn(),
  moveContact: vi.fn(),
  deleteContact: vi.fn(),
  listContacts: vi.fn(),
  addDraftInteraction: vi.fn(),
  markMessageSent: vi.fn(),
  logResponse: vi.fn(),
  scheduleMeeting: vi.fn(),
  markMet: vi.fn(),
  addNote: vi.fn(),
  setFollowUp: vi.fn(),
  changeStatusLogged: vi.fn(),
}));

import { useCRMStore } from './store';
import type { Contact } from './mockData';
import * as api from './contacts.actions';

function c(id: string, status: Contact['status'], position: number): Contact {
  return {
    id, position, name: id, company: '', role: '', linkedinUrl: '', email: '',
    inquiry: '', notes: '', status, priority: 'Medium', score: 0, warmth: 'Medium',
    avatarColor: '', tags: [], lastContacted: '', nextAction: '', aiSummary: '',
    outreachAngle: '', suggestedMessage: '', interactions: [],
  };
}

beforeEach(() => {
  useCRMStore.setState({ contacts: [], selectedContactId: null, loaded: false });
});

describe('useCRMStore hydration', () => {
  it('setContacts sorts by position and marks loaded', () => {
    useCRMStore.getState().setContacts([c('b', 'Send', 2000), c('a', 'Send', 1000)]);
    expect(useCRMStore.getState().contacts.map((x) => x.id)).toEqual(['a', 'b']);
    expect(useCRMStore.getState().loaded).toBe(true);
  });

  it('selectContact toggles the selection', () => {
    useCRMStore.getState().selectContact('a');
    expect(useCRMStore.getState().selectedContactId).toBe('a');
  });
});

describe('useCRMStore interactions', () => {
  it('markSent upserts the returned contact (moving it to Pending)', async () => {
    const moved = c('a', 'Pending', 1000);
    (api.markMessageSent as ReturnType<typeof vi.fn>).mockResolvedValue(moved);
    useCRMStore.setState({ contacts: [c('a', 'Send', 1000)], loaded: true });
    await useCRMStore.getState().markSent('a', { channel: 'Email', content: 'hi' });
    expect(useCRMStore.getState().contacts.find((x) => x.id === 'a')?.status).toBe('Pending');
  });

  it('saveDraft upserts the returned contact without changing status', async () => {
    const withDraft = c('a', 'Send', 1000);
    withDraft.interactions = [{ id: 'i1', date: '2026-06-11', type: 'message_drafted', content: 'draft' }];
    (api.addDraftInteraction as ReturnType<typeof vi.fn>).mockResolvedValue(withDraft);
    useCRMStore.setState({ contacts: [c('a', 'Send', 1000)], loaded: true });
    await useCRMStore.getState().saveDraft('a', { channel: 'Email', content: 'draft' });
    const updated = useCRMStore.getState().contacts.find((x) => x.id === 'a');
    expect(updated?.status).toBe('Send');
    expect(updated?.interactions).toHaveLength(1);
  });

  it('logResponse upserts the returned contact (moving it to Response)', async () => {
    const responded = c('a', 'Response', 1000);
    responded.interactions = [{ id: 'r1', date: '2026-06-11', type: 'response_logged', content: 'they replied' }];
    (api.logResponse as ReturnType<typeof vi.fn>).mockResolvedValue(responded);
    useCRMStore.setState({ contacts: [c('a', 'Pending', 1000)], loaded: true });
    await useCRMStore.getState().logResponse('a', { content: 'they replied', nextStep: 'Schedule meeting' });
    const updated = useCRMStore.getState().contacts.find((x) => x.id === 'a');
    expect(updated?.status).toBe('Response');
    expect(updated?.interactions).toHaveLength(1);
  });

  it('scheduleMeeting upserts the returned contact (moving it to Meeting Scheduled)', async () => {
    const scheduled = c('a', 'Meeting Scheduled', 1000);
    scheduled.interactions = [{ id: 'm1', date: '2026-06-11', type: 'meeting_scheduled', content: 'Meeting scheduled for June 18 at 2:00 PM.' }];
    (api.scheduleMeeting as ReturnType<typeof vi.fn>).mockResolvedValue(scheduled);
    useCRMStore.setState({ contacts: [c('a', 'Response', 1000)], loaded: true });
    await useCRMStore.getState().scheduleMeeting('a', { date: '2026-06-18', time: '14:00', notes: '' });
    expect(useCRMStore.getState().contacts.find((x) => x.id === 'a')?.status).toBe('Meeting Scheduled');
  });

  it('markMet upserts the returned contact (moving it to Met)', async () => {
    const met = c('a', 'Met', 1000);
    (api.markMet as ReturnType<typeof vi.fn>).mockResolvedValue(met);
    useCRMStore.setState({ contacts: [c('a', 'Meeting Scheduled', 1000)], loaded: true });
    await useCRMStore.getState().markMet('a', { notes: 'went well' });
    expect(useCRMStore.getState().contacts.find((x) => x.id === 'a')?.status).toBe('Met');
  });

  it('addNote upserts the returned contact without changing status', async () => {
    const noted = c('a', 'Met', 1000);
    noted.interactions = [{ id: 'n1', date: '2026-06-11', type: 'note_added', content: 'a note' }];
    (api.addNote as ReturnType<typeof vi.fn>).mockResolvedValue(noted);
    useCRMStore.setState({ contacts: [c('a', 'Met', 1000)], loaded: true });
    await useCRMStore.getState().addNote('a', 'a note');
    const updated = useCRMStore.getState().contacts.find((x) => x.id === 'a');
    expect(updated?.status).toBe('Met');
    expect(updated?.interactions).toHaveLength(1);
  });

  it('moveToLongTerm calls changeStatusLogged with Long-term and upserts', async () => {
    const moved = c('a', 'Long-term', 1000);
    (api.changeStatusLogged as ReturnType<typeof vi.fn>).mockResolvedValue(moved);
    useCRMStore.setState({ contacts: [c('a', 'Response', 1000)], loaded: true });
    await useCRMStore.getState().moveToLongTerm('a');
    expect(api.changeStatusLogged).toHaveBeenCalledWith('a', 'Long-term', 'Moved to long-term');
    expect(useCRMStore.getState().contacts.find((x) => x.id === 'a')?.status).toBe('Long-term');
  });

  it('markGhosted calls changeStatusLogged with Ghosted and upserts', async () => {
    const ghosted = c('a', 'Ghosted', 1000);
    (api.changeStatusLogged as ReturnType<typeof vi.fn>).mockResolvedValue(ghosted);
    useCRMStore.setState({ contacts: [c('a', 'Pending', 1000)], loaded: true });
    await useCRMStore.getState().markGhosted('a');
    expect(api.changeStatusLogged).toHaveBeenCalledWith('a', 'Ghosted', 'Marked as ghosted');
    expect(useCRMStore.getState().contacts.find((x) => x.id === 'a')?.status).toBe('Ghosted');
  });
});
