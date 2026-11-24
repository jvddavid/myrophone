import { useState } from 'react';
import { ChevronsUpDown, Settings } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { CompanySettingsDialog } from './company-settings-dialog';
import { companyInitials, type CompanyIdentity } from './company-profile';

export function CompanySwitcher({
  companies,
  activeId,
  showSettings,
  onSwitch,
}: {
  companies: CompanyIdentity[];
  activeId: string | null;
  showSettings: boolean;
  onSwitch: (companyId: string) => void;
}) {
  const { isMobile } = useSidebar();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const active = companies.find((company) => company.id === activeId) ?? null;

  if (!active) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" className="pointer-events-none">
            <CompanyGlyph logoUrl={null} name="Empresa" />
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">Nenhuma empresa</span>
              <span className="truncate text-xs">Crie a primeira</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <>
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <CompanyGlyph logoUrl={active.logoUrl} name={active.name} />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{active.name}</span>
                <span className="truncate text-xs">
                  {active.description ?? 'Empresa'}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <div className="flex items-center justify-between gap-2 pr-1">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Empresas
              </DropdownMenuLabel>
              {showSettings ? (
                <Button
                  aria-label="Gerenciar empresas"
                  className="size-7"
                  onClick={() => setSettingsOpen(true)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Settings />
                </Button>
              ) : null}
            </div>
            {companies.map((company) => (
              <DropdownMenuItem
                key={company.id}
                className="gap-2 p-2"
                onClick={() => onSwitch(company.id)}
              >
                <CompanyGlyph logoUrl={company.logoUrl} name={company.name} />
                {company.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
      {showSettings ? (
        <CompanySettingsDialog
          onOpenChange={setSettingsOpen}
          open={settingsOpen}
        />
      ) : null}
    </>
  );
}

function CompanyGlyph({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl: string | null;
}) {
  if (logoUrl) {
    return (
      <Avatar className="size-8 rounded-lg">
        <AvatarImage alt="" src={logoUrl} />
        <AvatarFallback className="rounded-lg text-xs">
          {companyInitials(name)}
        </AvatarFallback>
      </Avatar>
    );
  }

  return (
    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
      <span className="text-xs font-medium">{companyInitials(name)}</span>
    </div>
  );
}
