import { getRouteApi, useRouter } from '@tanstack/react-router';
import { useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ProfileForm } from './profile-form';

const authenticatedRoute = getRouteApi('/_authenticated');

export function ProfilePage() {
  const { auth } = authenticatedRoute.useRouteContext();
  const router = useRouter();
  const onChanged = useCallback(() => router.invalidate(), [router]);

  return (
    <Card className="mx-auto w-full max-w-lg">
      <CardHeader>
        <CardTitle>Perfil</CardTitle>
        <CardDescription>Nome, telefone e foto da sua conta.</CardDescription>
      </CardHeader>
      <CardContent>
        <ProfileForm
          email={auth.user.email}
          initialAvatarUrl={auth.user.avatarUrl}
          initialName={auth.user.name ?? ''}
          initialPhone={auth.user.phone ?? ''}
          onChanged={onChanged}
        />
      </CardContent>
    </Card>
  );
}
