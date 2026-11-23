import { Link } from '@tanstack/react-router';
import type { FormEvent, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function AuthScreen({
  title,
  description,
  error,
  pending,
  submitLabel,
  onSubmit,
  children,
  alternatePrompt,
  alternateTo,
  alternateLabel,
}: {
  title: string;
  description: string;
  error: string | null;
  pending: boolean;
  submitLabel: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
  alternatePrompt: string;
  alternateTo: '/login' | '/register';
  alternateLabel: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            MyroPhone
          </p>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            {children}
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button className="w-full" disabled={pending} type="submit">
              {pending ? 'Aguarde…' : submitLabel}
            </Button>
          </form>
          <p className="mt-6 text-sm text-muted-foreground">
            {alternatePrompt}{' '}
            <Link
              className="font-medium text-primary underline-offset-4 hover:underline"
              to={alternateTo}
            >
              {alternateLabel}
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
