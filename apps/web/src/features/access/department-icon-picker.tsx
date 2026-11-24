import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { cn } from '@/lib/utils';
import {
  departmentIcons,
  type DepartmentIconEntry,
} from './department-icons';

function DepartmentIconChoice({
  entry,
  selected,
  onSelect,
}: {
  entry: DepartmentIconEntry;
  selected: boolean;
  onSelect: (key: string) => void;
}) {
  const Icon = entry.icon;

  return (
    <Button
      aria-checked={selected}
      aria-label={entry.label}
      className={cn('size-8', selected && 'ring-2 ring-ring')}
      onClick={() => onSelect(entry.key)}
      role="radio"
      size="icon"
      type="button"
      variant={selected ? 'secondary' : 'ghost'}
    >
      <Icon />
    </Button>
  );
}

export function DepartmentIconPicker({
  labelId,
  value,
  onChange,
}: {
  labelId: string;
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <Field>
      <FieldLabel id={labelId}>Ícone</FieldLabel>
      <div
        aria-labelledby={labelId}
        className="grid max-h-40 grid-cols-[repeat(auto-fill,minmax(2rem,1fr))] gap-1 overflow-x-hidden overflow-y-auto rounded-md border p-2"
        role="radiogroup"
      >
        {departmentIcons.map((entry) => (
          <DepartmentIconChoice
            entry={entry}
            key={entry.key}
            onSelect={onChange}
            selected={entry.key === value}
          />
        ))}
      </div>
    </Field>
  );
}
