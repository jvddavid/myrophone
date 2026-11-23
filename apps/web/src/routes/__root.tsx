import { createRootRouteWithContext } from '@tanstack/react-router';
import type { RouterContext } from '../router-context';
import { NotFoundPage, RootLayout } from './-root-layout';

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
});
