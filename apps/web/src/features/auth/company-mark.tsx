import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { companyInitials } from './company-profile';

export function CompanyMark({
  name,
  logoUrl,
  className,
}: {
  name: string;
  logoUrl: string | null;
  className?: string;
}) {
  return (
    <Avatar className={cn('h-10 w-10 rounded-lg', className)}>
      {logoUrl ? <AvatarImage alt="" src={logoUrl} /> : null}
      <AvatarFallback className="rounded-lg text-xs font-medium">
        {companyInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
