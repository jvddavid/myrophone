import type { ComponentType } from 'react';
import { X } from 'lucide-react';
import {
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

const dialogClassName =
  'max-h-[min(40rem,calc(100dvh-2rem))] w-[calc(100%-2rem)] overflow-y-auto';

export function RemovalConfirmDialog({
  confirmIcon: ConfirmIcon,
  confirmLabel,
  description,
  error,
  onConfirm,
  pending,
  title,
}: {
  confirmIcon: ComponentType<{ className?: string }>;
  confirmLabel: string;
  description: string;
  error: string | null;
  onConfirm: () => void;
  pending: boolean;
  title: string;
}) {
  return (
    <AlertDialogContent className={dialogClassName}>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>
          <X />
          Cancelar
        </AlertDialogCancel>
        <Button
          disabled={pending}
          onClick={onConfirm}
          type="button"
          variant="destructive"
        >
          <ConfirmIcon />
          {pending ? 'Aguarde…' : confirmLabel}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}
