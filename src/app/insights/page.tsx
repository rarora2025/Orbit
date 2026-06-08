'use client';

import { useCRMStore } from '@/lib/store';
import { useMemo } from 'react';
import { companyDisplayName } from '@/lib/companyLogo';
import { Sparkles, TrendingUp, AlertTriangle, Users, Target, ArrowRight } from 'lucide-react';

function getDaysSince(dateStr: string): number {
  return Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 86400000);
}

interface Insight {
  type: 'info' | 'warning' | 'opportunity' | 'tip';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

export default function InsightsPage() {
  const { contacts } = useCRMStore();

  const insights = useMemo<Insight[]>(() => {
    const results: Insight[] = [];

    // Tag frequency analysis
    const tagCount: Record<string, number> = {};
    contacts.forEach(c => c.tags.forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; }));
    const sortedTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]);
    if (sortedTags.length >= 2) {
      results.push({
        type: 'info',
        title: `You are heavily focused on ${sortedTags[0][0]}`,
        description: `${sortedTags[0][1]} of your contacts are tagged with ${sortedTags[0][0]}. This is your dominant network cluster. Make sure you are actively moving these contacts through the pipeline.`,
        priority: 'medium',
      });
    }

    // Overdue pending contacts
    const overduePending = contacts.filter(
      c => c.status === 'Pending' && getDaysSince(c.lastContacted) > 7
    );
    if (overduePending.length > 0) {
      results.push({
        type: 'warning',
        title: `${overduePending.length} high-priority pending contact${overduePending.length > 1 ? 's' : ''} from more than 7 days ago`,
        description: `${overduePending.map(c => c.name).join(', ')} ${overduePending.length > 1 ? 'have' : 'has'} not heard back from you in over a week. Follow up now before the thread goes cold.`,
        priority: 'high',
      });
    }

    // Dream contacts pending
    const dreamPending = contacts.filter(c => c.priority === 'Dream' && c.status === 'Pending');
    if (dreamPending.length > 0) {
      results.push({
        type: 'warning',
        title: `${dreamPending.length} dream contact${dreamPending.length > 1 ? 's' : ''} still pending`,
        description: `${dreamPending.map(c => `${c.name} (${companyDisplayName(c.company)})`).join(', ')} ${dreamPending.length > 1 ? 'are' : 'is'} your highest priority. These should not sit idle.`,
        priority: 'high',
      });
    }

    // Founder vs operator balance
    const founderCount = contacts.filter(c => c.tags.includes('Startup Founders')).length;
    const operatorCount = contacts.filter(c => c.tags.includes('Product') || c.tags.includes('Growth')).length;
    if (founderCount > operatorCount * 2) {
      results.push({
        type: 'tip',
        title: 'You are over-indexed on founders and under-indexed on operators',
        description: `You have ${founderCount} founder contacts but only ${operatorCount} operator/PM contacts. Operators and PMs often have more time, more tactical advice, and are underrated networking targets for early-stage builders.`,
        priority: 'medium',
      });
    }

    // Fantasy sports gap
    const fantasyCount = contacts.filter(c => c.tags.includes('Fantasy Sports')).length;
    if (fantasyCount < 3) {
      results.push({
        type: 'opportunity',
        title: 'Your Fantasy Sports cluster is thin',
        description: `You only have ${fantasyCount} contact${fantasyCount === 1 ? '' : 's'} in the Fantasy Sports cluster. If Orbit targets this market, you need more surface area: DraftKings/FanDuel PMs, fantasy newsletter founders, and DFS operators.`,
        priority: 'medium',
      });
    }

    // Ghosted high priority
    const ghostedHigh = contacts.filter(c => c.status === 'Ghosted' && (c.priority === 'High' || c.priority === 'Dream'));
    if (ghostedHigh.length > 0) {
      results.push({
        type: 'warning',
        title: `${ghostedHigh.length} high-priority contact${ghostedHigh.length > 1 ? 's' : ''} ghosted you`,
        description: `${ghostedHigh.map(c => c.name).join(', ')} ghosted your initial message. These are worth a second attempt with a shorter, reframed message after a few weeks.`,
        priority: 'medium',
      });
    }

    // VC contacts
    const vcCount = contacts.filter(c => c.tags.includes('VC / Funds')).length;
    const respondedVC = contacts.filter(c => c.tags.includes('VC / Funds') && c.status === 'Response').length;
    if (vcCount > 0) {
      results.push({
        type: 'opportunity',
        title: `${respondedVC} of ${vcCount} VC/fund contacts have responded`,
        description: `${respondedVC > 0 ? 'You have warm investor relationships — push these toward formal meetings or application submissions. ' : ''}Don\'t let investor relationships go cold. Send updates, share traction, and ask for feedback.`,
        priority: respondedVC > 0 ? 'high' : 'medium',
      });
    }

    // Contacts added recently
    const toSend = contacts.filter(c => c.status === 'Send');
    if (toSend.length > 0) {
      results.push({
        type: 'tip',
        title: `${toSend.length} contact${toSend.length > 1 ? 's' : ''} in your queue, not yet messaged`,
        description: `${toSend.map(c => c.name).join(', ')} ${toSend.length > 1 ? 'are' : 'is'} marked "Send" but you haven't reached out yet. Batch these and send this week.`,
        priority: 'medium',
      });
    }

    // Columbia network insight
    const columbiaCount = contacts.filter(c => c.tags.includes('Columbia')).length;
    if (columbiaCount >= 2) {
      results.push({
        type: 'info',
        title: `Columbia is your strongest warm-network cluster`,
        description: `You have ${columbiaCount} Columbia contacts. Use these warm connections to unlock harder intros. Columbia alumni are much more likely to respond and refer you to others.`,
        priority: 'low',
      });
    }

    return results.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    });
  }, [contacts]);

  const typeConfig = {
    warning: { icon: AlertTriangle, bg: 'bg-orange-50', border: 'border-orange-200', iconColor: 'text-orange-500', dot: 'bg-orange-500' },
    opportunity: { icon: TrendingUp, bg: 'bg-emerald-50', border: 'border-emerald-200', iconColor: 'text-emerald-500', dot: 'bg-emerald-500' },
    info: { icon: Sparkles, bg: 'bg-blue-50', border: 'border-blue-200', iconColor: 'text-blue-500', dot: 'bg-blue-500' },
    tip: { icon: Target, bg: 'bg-violet-50', border: 'border-violet-200', iconColor: 'text-violet-500', dot: 'bg-violet-500' },
  };

  const priorityLabels = {
    high: { label: 'High Priority', color: 'text-rose-600 bg-rose-50 border-rose-200' },
    medium: { label: 'Medium', color: 'text-amber-600 bg-amber-50 border-amber-200' },
    low: { label: 'Low', color: 'text-stone-500 bg-stone-50 border-stone-200' },
  };

  // Network overview stats
  const totalContacts = contacts.length;
  const responseRate = Math.round((contacts.filter(c => c.status === 'Response').length / totalContacts) * 100);
  const dreamCount = contacts.filter(c => c.priority === 'Dream').length;
  const activeCount = contacts.filter(c => ['Pending', 'Response'].includes(c.status)).length;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={18} className="text-violet-500" />
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Network Insights</h1>
          </div>
          <p className="text-stone-500 text-sm">Strategic intelligence on your relationship pipeline</p>
        </div>

        {/* Overview cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Contacts', value: totalContacts, sub: 'in pipeline', color: 'text-stone-800' },
            { label: 'Response Rate', value: `${responseRate}%`, sub: 'replied to outreach', color: 'text-emerald-600' },
            { label: 'Dream Contacts', value: dreamCount, sub: 'top priority', color: 'text-violet-600' },
            { label: 'Active Threads', value: activeCount, sub: 'in progress', color: 'text-amber-600' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-stone-200/80 rounded-2xl px-5 py-4 shadow-sm">
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs font-semibold text-stone-600 mt-1">{s.label}</p>
              <p className="text-xs text-stone-400">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Insights */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-stone-700 uppercase tracking-wider mb-4">Recommendations</h2>
          {insights.map((insight, idx) => {
            const config = typeConfig[insight.type];
            const Icon = config.icon;
            const priority = priorityLabels[insight.priority];

            return (
              <div key={idx} className={`${config.bg} ${config.border} border rounded-2xl p-5 hover:shadow-md transition-shadow`}>
                <div className="flex items-start gap-4">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-white shadow-sm`}>
                    <Icon size={16} className={config.iconColor} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <p className="text-sm font-semibold text-stone-800 leading-snug">{insight.title}</p>
                      <span className={`text-[12px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${priority.color}`}>
                        {priority.label}
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed">{insight.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Cluster strength grid */}
        <div className="mt-10">
          <h2 className="text-sm font-bold text-stone-700 uppercase tracking-wider mb-4">Topic Cluster Health</h2>
          <div className="bg-white border border-stone-200/80 rounded-2xl overflow-hidden shadow-sm">
            {[
              { topic: 'Prediction Markets', count: contacts.filter(c => c.tags.includes('Prediction Markets')).length, strength: 'Strong', color: 'bg-emerald-500' },
              { topic: 'Sports Markets', count: contacts.filter(c => c.tags.includes('Sports Markets')).length, strength: 'Medium', color: 'bg-amber-500' },
              { topic: 'VC / Funds', count: contacts.filter(c => c.tags.includes('VC / Funds')).length, strength: 'Medium', color: 'bg-amber-500' },
              { topic: 'Columbia', count: contacts.filter(c => c.tags.includes('Columbia')).length, strength: 'Strong', color: 'bg-emerald-500' },
              { topic: 'Startup Founders', count: contacts.filter(c => c.tags.includes('Startup Founders')).length, strength: 'Medium', color: 'bg-amber-500' },
              { topic: 'Fantasy Sports', count: contacts.filter(c => c.tags.includes('Fantasy Sports')).length, strength: 'Weak', color: 'bg-red-400' },
              { topic: 'Fellowships', count: contacts.filter(c => c.tags.includes('Fellowship')).length, strength: 'Weak', color: 'bg-red-400' },
            ].map((row, idx) => (
              <div key={row.topic} className={`flex items-center px-5 py-4 ${idx > 0 ? 'border-t border-stone-100' : ''}`}>
                <div className="flex items-center gap-3 flex-1">
                  <div className={`w-2 h-2 rounded-full ${row.color}`} />
                  <p className="text-sm font-medium text-stone-700">{row.topic}</p>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-sm text-stone-500 tabular-nums">{row.count} contact{row.count !== 1 ? 's' : ''}</p>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    row.strength === 'Strong' ? 'bg-emerald-50 text-emerald-600' :
                    row.strength === 'Medium' ? 'bg-amber-50 text-amber-600' :
                    'bg-red-50 text-red-500'
                  }`}>
                    {row.strength}
                  </span>
                </div>
                <div className="ml-6 w-32 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${row.color}`}
                    style={{ width: `${Math.min(100, (row.count / 4) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
