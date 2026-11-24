import { useCallback, useRef, useState } from 'react';
import { commitMemberSearch } from './member-search';

export function useMemberQueryState() {
  const [term, setTerm] = useState('');
  const termRef = useRef('');
  const [page, setPage] = useState(1);
  const pageRef = useRef(1);
  const snapshotRef = useRef({ term: '', page: 1 });

  const commitTerm = useCallback((value: string) => {
    const next = commitMemberSearch(termRef.current, value);
    termRef.current = next.term;
    snapshotRef.current = { term: next.term, page: next.changed ? 1 : pageRef.current };

    if (next.changed) {
      pageRef.current = 1;
      setTerm(next.term);
      setPage(1);
    }

    return next.changed;
  }, []);

  const onPrevious = useCallback(() => {
    const next = Math.max(1, pageRef.current - 1);
    pageRef.current = next;
    snapshotRef.current = { term: termRef.current, page: next };
    setPage(next);
  }, []);

  const onNext = useCallback(() => {
    const next = pageRef.current + 1;
    pageRef.current = next;
    snapshotRef.current = { term: termRef.current, page: next };
    setPage(next);
  }, []);

  const onPageChange = useCallback((next: number) => {
    pageRef.current = next;
    snapshotRef.current = { term: termRef.current, page: next };
    setPage(next);
  }, []);

  return {
    term,
    page,
    snapshotRef,
    commitTerm,
    onPrevious,
    onNext,
    onPageChange,
  };
}
