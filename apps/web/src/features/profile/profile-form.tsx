import { brazilPhoneDigits, parseBrazilPhone } from '@myrophone/shared';
import { ImageOff, Save } from 'lucide-react';
import { type ChangeEvent, type FormEvent, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { IconInput } from '@/components/ui/icon-input';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { brazilPhoneInvalidMessage } from '@/lib/brazil-phone';
import { AuthRequestError, clearAvatarRequest, updateProfileRequest } from '../auth/api';
import { companyInitials } from '../auth/company-profile';
import { FileRequestError, uploadStoredFile } from '../files/api';
import { profileUpdatePayload } from './profile-payload';

const imageAccept = 'image/jpeg,image/png,image/webp,image/gif';

function failureText(reason: unknown, fallback: string): string {
  if (reason instanceof AuthRequestError || reason instanceof FileRequestError) {
    return reason.message;
  }

  return fallback;
}

export function ProfileForm({
  email,
  initialName,
  initialPhone,
  initialAvatarUrl,
  onChanged,
}: {
  email: string;
  initialName: string;
  initialPhone: string;
  initialAvatarUrl: string | null;
  onChanged: () => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(() => brazilPhoneDigits(initialPhone));
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [error, setError] = useState<string | null>(null);
  const [savePending, setSavePending] = useState(false);
  const [avatarPending, setAvatarPending] = useState(false);

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!parseBrazilPhone(phone)) {
        setError(brazilPhoneInvalidMessage);
        return;
      }
      setSavePending(true);
      setError(null);
      void updateProfileRequest(profileUpdatePayload({ name, phone, email }))
        .then(async (profile) => {
          setName(profile.user.name ?? name);
          setPhone(brazilPhoneDigits(profile.user.phone ?? phone));
          setAvatarUrl(profile.user.avatarUrl);
          await onChanged();
        })
        .catch((reason: unknown) => {
          setError(failureText(reason, 'Não foi possível salvar o perfil.'));
        })
        .finally(() => {
          setSavePending(false);
        });
    },
    [email, name, onChanged, phone],
  );

  const onAvatar = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';

      if (!file) {
        return;
      }

      setAvatarPending(true);
      setError(null);
      void uploadStoredFile({ purpose: 'AVATAR', file })
        .then(async (uploaded) => {
          setAvatarUrl(uploaded.url);
          await onChanged();
        })
        .catch((reason: unknown) => {
          setError(failureText(reason, 'Não foi possível enviar a foto.'));
        })
        .finally(() => {
          setAvatarPending(false);
        });
    },
    [onChanged],
  );

  const onClearAvatar = useCallback(() => {
    setAvatarPending(true);
    setError(null);
    void clearAvatarRequest()
      .then(async (profile) => {
        setAvatarUrl(profile.user.avatarUrl);
        await onChanged();
      })
      .catch((reason: unknown) => {
        setError(failureText(reason, 'Não foi possível remover a foto.'));
      })
      .finally(() => {
        setAvatarPending(false);
      });
  }, [onChanged]);

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        <div className="flex items-center gap-3">
          <Avatar className="size-14">
            {avatarUrl ? <AvatarImage alt="" src={avatarUrl} /> : null}
            <AvatarFallback>{companyInitials(name || email)}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
            <Field className="min-w-0 flex-1">
              <FieldLabel htmlFor="profileAvatar">Foto</FieldLabel>
              <Input
                accept={imageAccept}
                disabled={avatarPending}
                id="profileAvatar"
                onChange={onAvatar}
                type="file"
              />
            </Field>
            {avatarUrl ? (
              <Button
                className="self-end"
                disabled={avatarPending}
                onClick={onClearAvatar}
                type="button"
                variant="outline"
              >
                <ImageOff />
                Remover foto
              </Button>
            ) : null}
          </div>
        </div>
        <Field>
          <FieldLabel htmlFor="profileEmail">E-mail</FieldLabel>
          <IconInput
            disabled
            icon="email"
            id="profileEmail"
            readOnly
            type="email"
            value={email}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="profileName">Nome</FieldLabel>
          <IconInput
            autoComplete="name"
            icon="person"
            id="profileName"
            minLength={2}
            name="name"
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </Field>
        <PhoneInput
          error={error}
          id="profilePhone"
          onChange={setPhone}
          required
          value={phone}
        />
        <Button disabled={savePending || avatarPending} type="submit">
          <Save />
          {savePending ? 'Salvando…' : 'Salvar'}
        </Button>
      </FieldGroup>
    </form>
  );
}
