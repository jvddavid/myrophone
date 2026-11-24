import { Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { OwnedCompany } from '../access/api';
import { CompanyMark } from './company-mark';

export function OwnedCompanyList({
  companies,
  onCreate,
  onEdit,
}: {
  companies: OwnedCompany[];
  onCreate: () => void;
  onEdit: (companyId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {companies.map((company) => (
          <li
            className="flex min-w-0 items-center gap-3 rounded-md border p-2"
            key={company.id}
          >
            <CompanyMark logoUrl={company.logoUrl} name={company.name} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{company.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {company.description ?? 'Sem descrição'}
              </span>
            </span>
            <Button
              aria-label={`Editar ${company.name}`}
              className="shrink-0"
              onClick={() => onEdit(company.id)}
              size="sm"
              type="button"
              variant="outline"
            >
              <Pencil />
              Editar
            </Button>
          </li>
        ))}
      </ul>
      <Button onClick={onCreate} type="button">
        <Plus />
        Nova empresa
      </Button>
    </div>
  );
}
