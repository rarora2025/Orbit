'use client';

import { useState, useMemo } from 'react';
import { useCRMStore } from '@/lib/store';
import { Status, Priority } from '@/lib/mockData';
import ContactTable from '@/components/ContactTable';
import ContactDetailPanel from '@/components/ContactDetailPanel';
import AddContactModal from '@/components/AddContactModal';
import { Search, Plus, SlidersHorizontal, X } from 'lucide-react';

const statuses: Status[] = ['To Send', 'Pending', 'Responded', 'Follow-up Needed', 'Ghosted', 'Closed'];
const priorities: Priority[] = ['Low', 'Medium', 'High', 'Dream'];

function getDaysSince(dateStr: string): number {
  return Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 86400000);
}

export default function PipelinePage() {
  const { contacts, selectedContactId, selectContact, addContact } = useCRMStore();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<Status | ''>('');
  const [filterPriority, setFilterPriority] = useState<Priority | ''>('');
  const [showAdd, setShowAdd] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    return contacts.filter(c => {
      const matchSearch = !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.company.toLowerCase().includes(search.toLowerCase()) ||
        c.tags.some(t => t.toLowerCase().includes(search.toLowerCase()));
      const matchStatus = !filterStatus || c.status === filterStatus;
      const matchPriority = !filterPriority || c.priority === filterPriority;
      return matchSearch && matchStatus && matchPriority;
    });
  }, [contacts, search, filterStatus, filterPriority]);

  const selectedContact = contacts.find(c => c.id === selectedContactId);

  const stats = useMemo(() => ({
    total: contacts.length,
    pending: contacts.filter(c => c.status === 'Pending').length,
    responded: contacts.filter(c => c.status === 'Responded').length,
    toSend: contacts.filter(c => c.status === 'To Send').length,
    needsFollowup: contacts.filter(c => c.status === 'Follow-up Needed' || (c.status === 'Pending' && getDaysSince(c.lastContacted) > 7)).length,
  }), [contacts]);

  return (
    <div className="flex h-screen">
      {/* Main content */}
      <div className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ${selectedContact ? 'mr-[400px]' : ''}`}>
        {/* Header */}
        <div className="px-8 pt-8 pb-6 flex-shrink-0">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Pipeline</h1>
              <p className="text-stone-500 text-sm mt-1">Your active networking contacts</p>
            </div>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-stone-800 transition-colors shadow-sm"
            >
              <Plus size={15} />
              Add Contact
            </button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-5 gap-3 mb-6">
            {[
              { label: 'Total', value: stats.total, color: 'text-stone-700' },
              { label: 'To Send', value: stats.toSend, color: 'text-blue-600' },
              { label: 'Pending', value: stats.pending, color: 'text-amber-600' },
              { label: 'Responded', value: stats.responded, color: 'text-emerald-600' },
              { label: 'Needs Follow-up', value: stats.needsFollowup, color: 'text-orange-600' },
            ].map(s => (
              <div key={s.label} className="bg-white border border-stone-200/80 rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition-shadow">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-stone-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Search + Filters */}
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search contacts, companies, topics..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20 shadow-sm"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X size={13} className="text-stone-400 hover:text-stone-600" />
                </button>
              )}
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                (filterStatus || filterPriority)
                  ? 'bg-stone-900 text-white border-stone-900'
                  : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300 shadow-sm'
              }`}
            >
              <SlidersHorizontal size={14} />
              Filter
              {(filterStatus || filterPriority) && (
                <span className="w-4 h-4 bg-white/20 rounded-full text-[10px] flex items-center justify-center font-bold">
                  {[filterStatus, filterPriority].filter(Boolean).length}
                </span>
              )}
            </button>
          </div>

          {/* Filter panel */}
          {showFilters && (
            <div className="mt-3 bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Status</p>
                  <div className="flex flex-wrap gap-1.5">
                    {statuses.map(s => (
                      <button
                        key={s}
                        onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
                        className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
                          filterStatus === s ? 'bg-stone-900 text-white border-stone-900' : 'bg-stone-50 text-stone-600 border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Priority</p>
                  <div className="flex flex-wrap gap-1.5">
                    {priorities.map(p => (
                      <button
                        key={p}
                        onClick={() => setFilterPriority(filterPriority === p ? '' : p)}
                        className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
                          filterPriority === p ? 'bg-stone-900 text-white border-stone-900' : 'bg-stone-50 text-stone-600 border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        {p === 'Dream' ? '✦ Dream' : p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {(filterStatus || filterPriority) && (
                <button
                  onClick={() => { setFilterStatus(''); setFilterPriority(''); }}
                  className="mt-3 text-xs text-stone-400 hover:text-stone-600 transition-colors"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 min-h-0">
          <div className="bg-white border border-stone-200/80 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-stone-700">
                {filtered.length} contact{filtered.length !== 1 ? 's' : ''}
                {(filterStatus || filterPriority || search) && (
                  <span className="text-stone-400 font-normal"> · filtered</span>
                )}
              </p>
            </div>
            <ContactTable
              contacts={filtered}
              selectedId={selectedContactId}
              onSelect={(id) => selectContact(selectedContactId === id ? null : id)}
            />
          </div>
        </div>
      </div>

      {/* Detail Panel */}
      {selectedContact && (
        <div className="fixed right-0 top-0 h-screen w-[400px] bg-white border-l border-stone-200 shadow-2xl z-30 overflow-hidden">
          <ContactDetailPanel
            contact={selectedContact}
            onClose={() => selectContact(null)}
          />
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <AddContactModal
          onAdd={(c) => { addContact(c); setShowAdd(false); }}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}
