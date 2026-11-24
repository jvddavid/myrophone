import { createFileRoute } from '@tanstack/react-router';
import { DepartmentsPage } from '../../features/access/departments-page';

export const Route = createFileRoute('/_authenticated/departamentos')({
  component: DepartmentsPage,
});
