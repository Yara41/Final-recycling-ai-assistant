import React from 'react';
import {
  AlertTriangle, BarChart3, BookOpen, CheckCircle2, ClipboardList, Lightbulb, MapPin,
  Megaphone, ScanSearch, Sparkles, Trophy, Wrench,
} from 'lucide-react';

const KINDS = {
  classified: { Icon: ScanSearch, tone: 'blue' },
  logged: { Icon: CheckCircle2, tone: 'green' },
  report: { Icon: AlertTriangle, tone: 'amber' },
  audit: { Icon: ScanSearch, tone: 'amber' },
  dropoff: { Icon: MapPin, tone: 'blue' },
  impact: { Icon: Sparkles, tone: 'green' },
  leaderboard: { Icon: Trophy, tone: 'violet' },
  reports: { Icon: ClipboardList, tone: 'amber' },
  resolved: { Icon: Wrench, tone: 'green' },
  stats: { Icon: BarChart3, tone: 'violet' },
  insight: { Icon: Lightbulb, tone: 'violet' },
  campaign: { Icon: Megaphone, tone: 'violet' },
  knowledge: { Icon: BookOpen, tone: 'slate' },
};

// One thing the agent did, shown above its reply.
export default function ActionCard({ card }) {
  const meta = KINDS[card.kind] ?? KINDS.knowledge;
  const { Icon } = meta;
  return (
    <div className={`action-card tone-${meta.tone}`} data-kind={card.kind}>
      <span className="action-icon"><Icon size={18} /></span>
      <div className="action-body">
        <strong>{card.title}</strong>
        {card.detail && <p>{card.detail}</p>}
      </div>
      {card.points > 0 && <span className="points-badge">+{card.points}</span>}
    </div>
  );
}
