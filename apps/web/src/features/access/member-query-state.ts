import { useCallback, useState } from 'react';

export function useMemberQueryState() {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const onQueryChange = useCallback((value: string) => {
    setQuery(value);
    setPage(1);
  }, []);
  const onPrevious = useCallback(() => {
    setPage((current) => Math.max(1, current - 1));
  }, []);
  const onNext = useCallback(() => {
    setPage((current) => current + 1);
  }, []);

  return { query, page, setPage, onQueryChange, onPrevious, onNext };
}
