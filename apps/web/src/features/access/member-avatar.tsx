import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { companyInitials } from '../auth/company-profile';

export function MemberAvatar({
  name,
  email,
  avatarUrl,
}: {
  name: string;
  email: string;
  avatarUrl: string | null;
}) {
  return (
    <Avatar className="size-8">
      {avatarUrl ? <AvatarImage alt="" src={avatarUrl} /> : null}
      <AvatarFallback>{companyInitials(name || email)}</AvatarFallback>
    </Avatar>
  );
}
