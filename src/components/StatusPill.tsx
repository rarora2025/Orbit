import { Status } from '@/lib/mockData';
import { getStatusColor, getStatusDot } from '@/lib/utils';

interface Props {
  status: Status;
  size?: 'sm' | 'md';
}

export default function StatusPill({ status, size = 'md' }: Props) {
  return (
    <span className={`inline-flex items-center gap-1.5 border rounded-full font-medium ${getStatusColor(status)} ${
      size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getStatusDot(status)}`} />
      {status}
    </span>
  );
}
