import { Link, Outlet } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';

const RouterDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-router-devtools').then((module) => ({
        default: module.TanStackRouterDevtools,
      })),
    )
  : null;

export function RootLayout() {
  return (
    <>
      <Outlet />
      {RouterDevtools ? (
        <Suspense fallback={null}>
          <RouterDevtools />
        </Suspense>
      ) : null}
    </>
  );
}

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 px-6 py-12">
      <h1 className="text-3xl font-bold">Página não encontrada</h1>
      <p className="text-slate-300">Esse endereço não existe neste painel.</p>
      <Link className="text-cyan-300 underline" to="/">
        Voltar ao início
      </Link>
    </main>
  );
}

