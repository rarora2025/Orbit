export type Status = 'To Send' | 'Pending' | 'Responded' | 'Follow-up Needed' | 'Ghosted' | 'Closed';
export type Priority = 'Low' | 'Medium' | 'High' | 'Dream';

export interface Interaction {
  id: string;
  date: string;
  type: 'sent' | 'received' | 'note' | 'meeting';
  content: string;
}

export interface Contact {
  id: string;
  name: string;
  company: string;
  role: string;
  linkedinUrl: string;
  email: string;
  inquiry: string;
  notes: string;
  status: Status;
  priority: Priority;
  tags: string[];
  lastContacted: string;
  nextAction: string;
  aiSummary: string;
  outreachAngle: string;
  suggestedMessage: string;
  interactions: Interaction[];
}

export const mockContacts: Contact[] = [
  {
    id: '1',
    name: 'Shayne Coplan',
    company: 'Polymarket',
    role: 'CEO & Co-Founder',
    linkedinUrl: 'https://linkedin.com/in/shaynecoplan',
    email: 'shayne@polymarket.com',
    inquiry: 'Prediction market design and user growth',
    notes: 'Founded Polymarket at 22. Leading prediction market platform. Raised $70M+. Incredibly product-focused.',
    status: 'Pending',
    priority: 'Dream',
    tags: ['Prediction Markets', 'Startup Founders', 'Product'],
    lastContacted: '2026-05-29',
    nextAction: 'Follow up on initial message — high priority',
    aiSummary: 'Shayne is the CEO of Polymarket, the largest prediction market platform. He\'s known for being deeply product-focused and mission-driven about information markets. Built it during COVID.',
    outreachAngle: 'Your work building Orbit in the sports prediction space aligns directly with Polymarket\'s mission. Ask about market design philosophy and how they approached early liquidity.',
    suggestedMessage: 'Hey Shayne — I\'ve been building in the sports prediction/gaming space and Polymarket\'s market design is something I think about constantly. Would love 15 minutes to ask how you approached the early liquidity problem and how you think about user trust in information markets.',
    interactions: [
      { id: 'i1', date: '2026-05-29', type: 'sent', content: 'Sent cold LinkedIn message about prediction market design.' },
    ],
  },
  {
    id: '2',
    name: 'Sean Hargrove',
    company: 'Series',
    role: 'Founder',
    linkedinUrl: 'https://linkedin.com/in/seanhargrove',
    email: 'sean@series.so',
    inquiry: 'Early-stage startup building and fundraising',
    notes: 'Building Series, a fintech startup. Went through YC. Great operator mindset.',
    status: 'Pending',
    priority: 'High',
    tags: ['Startup Founders', 'YC', 'Fintech'],
    lastContacted: '2026-05-29',
    nextAction: 'Follow up — 10 days since first message',
    aiSummary: 'Sean is a YC founder building in fintech. Strong operator background, understands the grind of early-stage building.',
    outreachAngle: 'You\'re both building from scratch. Ask about the YC application process and how he thought about early product focus.',
    suggestedMessage: 'Hey Sean — saw your work at Series and really admire how you\'ve approached the product. I\'m building Orbit in the sports/prediction space and would love to pick your brain on early-stage focus and the YC process.',
    interactions: [
      { id: 'i2', date: '2026-05-29', type: 'sent', content: 'Reached out via LinkedIn.' },
    ],
  },
  {
    id: '3',
    name: 'Baylor Adams',
    company: 'Z Fellows',
    role: 'Program Lead',
    linkedinUrl: 'https://linkedin.com/in/bayloradams',
    email: 'baylor@zfellows.com',
    inquiry: 'Z Fellows fellowship application and fit',
    notes: 'Runs Z Fellows, a fellowship for young builders. Great guy, very accessible. Could open major doors.',
    status: 'Pending',
    priority: 'Medium',
    tags: ['Fellowship', 'Community', 'Early Stage'],
    lastContacted: '2026-05-27',
    nextAction: 'Follow up on application status',
    aiSummary: 'Baylor runs Z Fellows, a program for young ambitious founders. Key contact for fellowship access and community building.',
    outreachAngle: 'Frame around your vision for Orbit and why you\'re building it now. Z Fellows loves mission-driven young founders.',
    suggestedMessage: 'Hey Baylor — I\'ve been following Z Fellows for a while and I\'m really aligned with the mission. I\'m building Orbit (sports prediction intelligence) and would love to share what I\'m working on and hear your thoughts on fit.',
    interactions: [
      { id: 'i3', date: '2026-05-27', type: 'sent', content: 'Sent intro message about Z Fellows application.' },
    ],
  },
  {
    id: '4',
    name: 'Eric Liu',
    company: 'Totalis',
    role: 'Co-Founder & CEO',
    linkedinUrl: 'https://linkedin.com/in/ericliu',
    email: 'eric@totalis.io',
    inquiry: 'Sports data and prediction product design',
    notes: 'Building Totalis, a sports analytics platform. Columbia connection. Very technical.',
    status: 'Pending',
    priority: 'Medium',
    tags: ['Sports Markets', 'Startup Founders', 'Columbia', 'Data'],
    lastContacted: '2026-05-26',
    nextAction: 'Schedule a call this week',
    aiSummary: 'Eric is a technical founder building in sports analytics, direct overlap with Orbit\'s domain. Columbia alum — warm connection.',
    outreachAngle: 'Shared Columbia background + overlapping space makes this a natural peer conversation. Ask about his data stack and how he thinks about sports prediction.',
    suggestedMessage: 'Hey Eric — fellow Columbia builder here. I\'ve been following Totalis and I\'m building in a similar adjacent space (sports prediction/gaming intelligence). Would love to compare notes on the market and share what I\'ve been learning.',
    interactions: [
      { id: 'i4', date: '2026-05-26', type: 'sent', content: 'Sent LinkedIn connection + message.' },
    ],
  },
  {
    id: '5',
    name: 'Calvin Smith',
    company: 'Novig',
    role: 'Head of Markets',
    linkedinUrl: 'https://linkedin.com/in/calvinsmith',
    email: 'calvin@novig.com',
    inquiry: 'Sports prediction market design and liquidity',
    notes: 'Head of Markets at Novig, a sports prediction exchange. Deep expertise in market microstructure.',
    status: 'Pending',
    priority: 'Medium',
    tags: ['Sports Markets', 'Prediction Markets', 'Market Design'],
    lastContacted: '2026-05-26',
    nextAction: 'Follow up about market design conversation',
    aiSummary: 'Calvin leads markets at Novig, one of the first licensed sports prediction exchanges in the US. Rare expertise in sports prediction market microstructure.',
    outreachAngle: 'Your interest in prediction/sports overlap is directly relevant. Ask about how they think about pricing and user acquisition in a regulated market.',
    suggestedMessage: 'Hey Calvin — I\'ve been digging deep into sports prediction market design and Novig\'s approach to pricing and liquidity is fascinating. I\'m building in the space and would love 15 minutes to ask how you think about market microstructure for sports.',
    interactions: [
      { id: 'i5', date: '2026-05-26', type: 'sent', content: 'Cold outreach via LinkedIn.' },
    ],
  },
  {
    id: '6',
    name: 'Oliver Wilson',
    company: 'Oracle Trading',
    role: 'Head of Strategy',
    linkedinUrl: 'https://linkedin.com/in/oliverwilson',
    email: 'oliver@oracletrading.com',
    inquiry: 'Quantitative trading and prediction markets',
    notes: 'Works on strategy at Oracle Trading. Responded quickly and was very helpful. Could intro to others in the quant space.',
    status: 'Responded',
    priority: 'Medium',
    tags: ['Trading', 'Quantitative', 'Prediction Markets'],
    lastContacted: '2026-04-09',
    nextAction: 'Send follow-up with Orbit deck',
    aiSummary: 'Oliver responded positively and is well-connected in the quant/prediction space. Good candidate for warm intros.',
    outreachAngle: 'He\'s already engaged — push toward a real conversation and ask for introductions to others in the prediction/trading overlap.',
    suggestedMessage: 'Hey Oliver — following up on our last exchange. I\'ve made good progress on Orbit and would love to share the latest. Would you be open to a 20-minute call? Also, if there\'s anyone in your network you think I should talk to, I\'d really appreciate the intro.',
    interactions: [
      { id: 'i6a', date: '2026-04-05', type: 'sent', content: 'Initial outreach about prediction markets.' },
      { id: 'i6b', date: '2026-04-09', type: 'received', content: 'Oliver replied positively, expressed interest in the idea.' },
    ],
  },
  {
    id: '7',
    name: 'Nicholas Hull',
    company: 'Kalshi',
    role: 'Growth Lead',
    linkedinUrl: 'https://linkedin.com/in/nicholashull',
    email: 'nicholas@kalshi.com',
    inquiry: 'Prediction market user growth and onboarding',
    notes: 'Leads growth at Kalshi, the first CFTC-regulated prediction market. Ghosted after one message. Might try a different angle.',
    status: 'Ghosted',
    priority: 'High',
    tags: ['Prediction Markets', 'Growth', 'Regulated Markets'],
    lastContacted: '2026-03-07',
    nextAction: 'Try re-engagement with new angle or mutual connection',
    aiSummary: 'Nick runs growth at Kalshi. Deep knowledge of how regulated prediction markets acquire and retain users. Worth re-engaging.',
    outreachAngle: 'Try a different angle — lead with a specific question about regulated market UX, not your project.',
    suggestedMessage: 'Hey Nicholas — I know I reached out a while back. I\'ve been spending a lot of time thinking about Kalshi\'s onboarding flow and had a specific question: how did you handle explaining prediction markets to users who\'d never used one before? Would love even just a quick reply.',
    interactions: [
      { id: 'i7', date: '2026-03-07', type: 'sent', content: 'Cold message about prediction markets. No response.' },
    ],
  },
  {
    id: '8',
    name: 'Kelechi Ukah',
    company: 'Novig',
    role: 'Co-Founder',
    linkedinUrl: 'https://linkedin.com/in/kelechiukah',
    email: 'kelechi@novig.com',
    inquiry: 'Sports prediction exchange founding story',
    notes: 'Co-founded Novig. Columbia connection. Ghosted — maybe tried too hard with a long message.',
    status: 'Ghosted',
    priority: 'Medium',
    tags: ['Sports Markets', 'Startup Founders', 'Columbia'],
    lastContacted: '2026-03-06',
    nextAction: 'Short punchy re-engagement, lead with Columbia connection',
    aiSummary: 'Kelechi co-founded Novig and is a Columbia alum. The ghost may have been message length. A short, direct re-engagement could work.',
    outreachAngle: 'Keep it very short. Lead with Columbia connection and one specific question.',
    suggestedMessage: 'Hey Kelechi — fellow Columbia builder, wanted to try again with a shorter note. I\'m building in the sports prediction space and had one quick question: what was the biggest thing you got wrong in year one at Novig?',
    interactions: [
      { id: 'i8', date: '2026-03-06', type: 'sent', content: 'Long cold message about building in the space. No response.' },
    ],
  },
  {
    id: '9',
    name: 'William Yoon',
    company: 'Entrepreneurs First',
    role: 'Partner',
    linkedinUrl: 'https://linkedin.com/in/williamyoon',
    email: 'william@joinef.com',
    inquiry: 'EF program application and founder matching',
    notes: 'Partner at EF. Responded very warmly. Has been helpful and offered to stay in touch. Dream-tier potential.',
    status: 'Responded',
    priority: 'Dream',
    tags: ['VC / Funds', 'Startup Programs', 'Founder Matching'],
    lastContacted: '2026-03-05',
    nextAction: 'Send update on Orbit progress + ask for EF application feedback',
    aiSummary: 'William is a key EF contact who has already expressed warmth. He can be a pipeline to the EF program and broader founder network.',
    outreachAngle: 'He\'s warm. Give him an update, show progress, and ask for his read on EF fit.',
    suggestedMessage: 'Hey William — wanted to send a quick update. Since we last spoke I\'ve made significant progress on Orbit. Would love to show you where things stand and get your honest read on EF fit.',
    interactions: [
      { id: 'i9a', date: '2026-03-01', type: 'sent', content: 'Sent EF application inquiry.' },
      { id: 'i9b', date: '2026-03-05', type: 'received', content: 'William replied warmly, offered to stay in touch and discuss fit.' },
      { id: 'i9c', date: '2026-03-05', type: 'note', content: 'Really encouraging response. Mentioned he likes mission-driven young founders.' },
    ],
  },
  {
    id: '10',
    name: 'Annie Dong',
    company: 'Dorm Room Fund',
    role: 'Partner',
    linkedinUrl: 'https://linkedin.com/in/anniedong',
    email: 'annie@dormroomfund.com',
    inquiry: 'Student venture funding and DRF application',
    notes: 'Partner at Dorm Room Fund. Had a great conversation. Very supportive of the vision.',
    status: 'Responded',
    priority: 'High',
    tags: ['VC / Funds', 'Student Funding', 'Columbia'],
    lastContacted: '2026-01-29',
    nextAction: 'Send DRF application materials + follow-up',
    aiSummary: 'Annie is a DRF partner who responded positively. A warm relationship with real funding potential for early stage.',
    outreachAngle: 'She\'s invested in student founders. Show her the Orbit progress and traction, position it as the right time to apply.',
    suggestedMessage: 'Hey Annie — hope you\'re well! I wanted to share that Orbit has come a long way since we last connected. I think we\'re at the point where a DRF conversation makes sense. Would love to reconnect and share what we\'ve built.',
    interactions: [
      { id: 'i10a', date: '2026-01-25', type: 'sent', content: 'Cold outreach to DRF about Orbit.' },
      { id: 'i10b', date: '2026-01-29', type: 'received', content: 'Annie replied and said she\'d love to hear more about the project.' },
    ],
  },
  {
    id: '11',
    name: 'Edward Tian',
    company: 'DraftKings',
    role: 'Product Manager',
    linkedinUrl: 'https://linkedin.com/in/edwardtian',
    email: 'edward@draftkings.com',
    inquiry: 'Fantasy sports product design and user engagement',
    notes: 'PM at DraftKings. Super helpful conversation about fantasy sports UX and retention.',
    status: 'Responded',
    priority: 'Medium',
    tags: ['Fantasy Sports', 'Product', 'Gaming'],
    lastContacted: '2026-01-18',
    nextAction: 'Send follow-up with specific product questions',
    aiSummary: 'Edward is a PM at DraftKings with direct domain expertise in fantasy sports UX. A valuable perspective on Orbit\'s target user.',
    outreachAngle: 'Lead with a specific product question about fantasy sports engagement to keep the conversation alive.',
    suggestedMessage: 'Hey Edward — your insights have stuck with me. I had one more question: in your experience, what\'s the number one thing that makes fantasy sports users come back daily vs. just seasonally?',
    interactions: [
      { id: 'i11a', date: '2026-01-15', type: 'sent', content: 'Cold outreach about fantasy sports product.' },
      { id: 'i11b', date: '2026-01-18', type: 'received', content: 'Edward replied with detailed thoughts on fantasy sports UX.' },
      { id: 'i11c', date: '2026-01-18', type: 'note', content: 'Key insight: retention is tied to social features and contest variety.' },
    ],
  },
];

export const topicClusters = [
  {
    id: 'prediction-markets',
    name: 'Prediction Markets',
    color: 'blue',
    contacts: ['1', '5', '6', '7'],
    insight: 'Strong cluster. Multiple high-priority contacts, but several pending follow-ups need action.',
    strength: 'strong',
  },
  {
    id: 'sports-markets',
    name: 'Sports Markets',
    color: 'green',
    contacts: ['4', '5', '8'],
    insight: 'Core domain cluster. Add more contacts here — especially fantasy sports operators and DFS founders.',
    strength: 'medium',
  },
  {
    id: 'vc-funds',
    name: 'VC / Funds',
    color: 'purple',
    contacts: ['9', '10'],
    insight: 'Good early-stage investor relationships. Both are warm — push toward formal applications.',
    strength: 'medium',
  },
  {
    id: 'columbia',
    name: 'Columbia',
    color: 'orange',
    contacts: ['4', '8', '10'],
    insight: 'Your strongest warm-network cluster. Use Columbia connections to unlock harder intros.',
    strength: 'strong',
  },
  {
    id: 'startup-founders',
    name: 'Startup Founders',
    color: 'amber',
    contacts: ['1', '2', '8'],
    insight: 'Over-indexed on founder contacts. Balance with more operators and PMs.',
    strength: 'medium',
  },
  {
    id: 'fantasy-sports',
    name: 'Fantasy Sports',
    color: 'teal',
    contacts: ['11'],
    insight: 'Weak but critical cluster. You have one contact here — add DFS PMs, fantasy newsletter founders, and operators.',
    strength: 'weak',
  },
  {
    id: 'fellowships',
    name: 'Fellowships',
    color: 'pink',
    contacts: ['3'],
    insight: 'Only one fellowship contact. Consider adding more program leads and alumni from Z Fellows, Contrary, Pioneer.',
    strength: 'weak',
  },
];

export function getContactById(id: string): Contact | undefined {
  return mockContacts.find(c => c.id === id);
}

export function getContactsForCluster(clusterContactIds: string[]): Contact[] {
  return mockContacts.filter(c => clusterContactIds.includes(c.id));
}
