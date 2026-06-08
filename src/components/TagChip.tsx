import { getTagColor } from '@/lib/utils';

interface Props {
  tag: string;
}

export default function TagChip({ tag }: Props) {
  return (
    <span className={`inline-flex items-center border rounded-full text-[11px] font-medium px-2 py-0.5 ${getTagColor(tag)}`}>
      {tag}
    </span>
  );
}
