import { createFileRoute } from '@tanstack/react-router';
import { CreateAccessPage } from '../../../features/access/create-access-page';

export const Route = createFileRoute('/_authenticated/acessos/novo')({
  component: CreateAccessPage,
});
