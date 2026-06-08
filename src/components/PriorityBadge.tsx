import { Priority } from '@/lib/mockData';
import { getPriorityColor } from '@/lib/utils';

interface Props {
  priority: Priority;
}

export default function PriorityBadge({ priority }: Props) {
  const flames = { Dream: 4, High: 3, Medium: 2, Low: 1 };
  const count = flames[priority] || 1;

  return (
    <span className={`inline-flex items-center gap-1 border rounded-md text-[13px] font-semibold px-2 py-0.5 ${getPriorityColor(priority)}`}>
      {priority === 'Dream' ? '✦ Dream' : priority}
    </span>
  );
}
