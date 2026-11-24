import { useRouter } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { queryClient } from '../../query-client';
import {
  accessFailureText,
  listOwnedCompaniesRequest,
  type OwnedCompany,
} from '../access/api';
import {
  AuthRequestError,
  clearLogoRequest,
  createOwnedCompanyRequest,
  updateOwnedCompanyRequest,
} from './api';
import { CompanyCreateForm, type CompanyTextDraft } from './company-create-form';
import { CompanyEditForm } from './company-edit-form';
import { FileRequestError, uploadStoredFile } from '../files/api';
import { OwnedCompanyList } from './owned-company-list';

type Panel = 'list' | 'create' | 'edit';

const emptyOwnedCompanies: OwnedCompany[] = [];

function failureText(reason: unknown, fallback: string): string {
  if (reason instanceof AuthRequestError || reason instanceof FileRequestError) {
    return reason.message;
  }

  return fallback;
}

export function CompanySettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>('list');
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const owned = useQuery({
    queryKey: ['owned-companies'],
    queryFn: listOwnedCompaniesRequest,
    enabled: open,
  });
  const companies = owned.data ?? emptyOwnedCompanies;
  const companyById = useMemo(
    () => new Map(companies.map((company) => [company.id, company])),
    [companies],
  );
  const editing = companyId ? (companyById.get(companyId) ?? null) : null;

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['owned-companies'] }),
      router.invalidate(),
    ]);
  }, [router]);

  const showList = useCallback(() => {
    setPanel('list');
    setCompanyId(null);
    setError(null);
  }, []);

  const onCreate = useCallback(
    (draft: CompanyTextDraft) => {
      setPending(true);
      setError(null);
      void createOwnedCompanyRequest({
        name: draft.name,
        description: draft.description,
      })
        .then(async () => {
          await refresh();
          showList();
        })
        .catch((reason: unknown) => {
          setError(failureText(reason, 'Não foi possível criar a empresa.'));
        })
        .finally(() => {
          setPending(false);
        });
    },
    [refresh, showList],
  );

  const onSave = useCallback(
    (draft: CompanyTextDraft) => {
      if (!editing) {
        return;
      }

      setPending(true);
      setError(null);
      void updateOwnedCompanyRequest({
        tenantId: editing.id,
        name: draft.name,
        description: draft.description,
      })
        .then(async () => {
          await refresh();
          showList();
        })
        .catch((reason: unknown) => {
          setError(failureText(reason, 'Não foi possível salvar a empresa.'));
        })
        .finally(() => {
          setPending(false);
        });
    },
    [editing, refresh, showList],
  );

  const onUploadLogo = useCallback(
    (file: File) => {
      if (!editing) {
        return;
      }

      setPending(true);
      setError(null);
      void uploadStoredFile({
        purpose: 'LOGO',
        file,
        tenantId: editing.id,
      })
        .then(() => refresh())
        .catch((reason: unknown) => {
          setError(failureText(reason, 'Não foi possível enviar o logo.'));
        })
        .finally(() => {
          setPending(false);
        });
    },
    [editing, refresh],
  );

  const onClearLogo = useCallback(() => {
    if (!editing) {
      return;
    }

    setPending(true);
    setError(null);
    void clearLogoRequest(editing.id)
      .then(() => refresh())
      .catch((reason: unknown) => {
        setError(failureText(reason, 'Não foi possível remover o logo.'));
      })
      .finally(() => {
        setPending(false);
      });
  }, [editing, refresh]);

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) {
          showList();
        }
        onOpenChange(next);
      }}
      open={open}
    >
      <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Empresas</DialogTitle>
          <DialogDescription>
            Crie uma empresa ou edite as que você possui.
          </DialogDescription>
        </DialogHeader>
        {owned.isPending ? <p className="text-sm text-muted-foreground">Carregando…</p> : null}
        {owned.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {accessFailureText(owned.error)}
          </p>
        ) : null}
        {owned.isSuccess && panel === 'list' ? (
          <OwnedCompanyList
            companies={companies}
            onCreate={() => {
              setError(null);
              setPanel('create');
            }}
            onEdit={(id) => {
              setError(null);
              setCompanyId(id);
              setPanel('edit');
            }}
          />
        ) : null}
        {panel === 'create' ? (
          <CompanyCreateForm
            error={error}
            onCancel={showList}
            onSubmit={onCreate}
            pending={pending}
          />
        ) : null}
        {panel === 'edit' && editing ? (
          <CompanyEditForm
            description={editing.description ?? ''}
            error={error}
            key={editing.id}
            logoUrl={editing.logoUrl}
            name={editing.name}
            onCancel={showList}
            onClearLogo={onClearLogo}
            onSubmit={onSave}
            onUploadLogo={onUploadLogo}
            pending={pending}
          />
        ) : null}
        {panel === 'edit' && !editing && owned.isSuccess ? (
          <Button onClick={showList} type="button" variant="outline">
            <ArrowLeft />
            Voltar
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
