import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Search } from 'lucide-react';
import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { memberSearchDebounceMs } from './member-search';
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
  pending,
  onSearch,
  onSearchNow,
}: {
  id: string;
  pending: boolean;
  onSearch: (value: string) => void;
  onSearchNow: (value: string) => void;
}) {
  const [value, setValue] = useState('');
  const valueRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const onInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const next = event.target.value;
      valueRef.current = next;
      setValue(next);
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        onSearch(next);
      }, memberSearchDebounceMs);
    },
    [clearTimer, onSearch],
  );

  const onRefresh = useCallback(() => {
    clearTimer();
    onSearchNow(valueRef.current);
  }, [clearTimer, onSearchNow]);

  return (
    <Field className="min-w-0">
      <FieldLabel htmlFor={id}>Buscar</FieldLabel>
      <div className="flex min-w-0 items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            autoComplete="off"
            className="pl-9"
            id={id}
            maxLength={200}
            onChange={onInput}
            placeholder="Buscar por nome ou e-mail"
            type="search"
            value={value}
          />
        </div>
        <Button
          aria-busy={pending}
          aria-label="Buscar novamente"
          className="shrink-0"
          disabled={pending}
          onClick={onRefresh}
          size="icon"
          type="button"
          variant="outline"
        >
          {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <RefreshCw aria-hidden="true" />}
        </Button>
      </div>
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
