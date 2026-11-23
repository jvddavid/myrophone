import { createFileRoute } from '@tanstack/react-router';
import { HomePage } from '../../features/home/home-page';

export const Route = createFileRoute('/_authenticated/')({
  loader: ({ context }) => {
    void import('../../features/home/health-query').then(({ healthQueryOptions }) =>
      context.queryClient.query(healthQueryOptions()).catch(() => undefined),
    );
  },
  component: HomePage,
});
