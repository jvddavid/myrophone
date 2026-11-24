import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';

export function OwnerOnly() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>Acesso do proprietário</EmptyTitle>
        <EmptyDescription>
          Só o proprietário da empresa ativa gerencia acessos e departamentos.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
