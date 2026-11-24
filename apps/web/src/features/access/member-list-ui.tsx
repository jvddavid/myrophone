import { ChevronLeft, ChevronRight } from 'lucide-react';
import { type ChangeEvent, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function MemberSearchField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const onInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.value);
    },
    [onChange],
  );

  return (
    <Field>
      <FieldLabel htmlFor={id}>Buscar</FieldLabel>
      <Input
        autoComplete="off"
        id={id}
        maxLength={200}
        onChange={onInput}
        placeholder="Nome ou e-mail"
        type="search"
        value={value}
      />
    </Field>
  );
}

function pageOptionValues(pageCount: number): string[] {
  const values: string[] = [];

  for (let number = 1; number <= pageCount; number += 1) {
    values.push(String(number));
  }

  return values;
}

export function MemberPager({
  page,
  pageSize,
  total,
  onPrevious,
  onNext,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
  onPageChange: (page: number) => void;
}) {
  const onSelectPage = useCallback(
    (value: string) => {
      const next = Number(value);

      if (Number.isInteger(next) && next >= 1) {
        onPageChange(next);
      }
    },
    [onPageChange],
  );

  if (pageSize < 1 || total <= pageSize) {
    return null;
  }

  const pageCount = Math.ceil(total / pageSize);
  const options = pageOptionValues(pageCount);
  const current = Math.min(Math.max(page, 1), pageCount);

  return (
    <nav aria-label="Paginação" className="flex flex-wrap items-center gap-2">
      <Button
        aria-label="Página anterior"
        disabled={current <= 1}
        onClick={onPrevious}
        size="icon"
        type="button"
        variant="outline"
      >
        <ChevronLeft />
      </Button>
      <Select onValueChange={onSelectPage} value={String(current)}>
        <SelectTrigger aria-label="Página" className="w-20">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((value) => (
            <SelectItem key={value} value={value}>
              {value}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        aria-label="Próxima página"
        disabled={current >= pageCount}
        onClick={onNext}
        size="icon"
        type="button"
        variant="outline"
      >
        <ChevronRight />
      </Button>
    </nav>
  );
}

export function MemberEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
