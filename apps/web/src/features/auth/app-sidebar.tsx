import { LayoutDashboard } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { CompanySwitcher } from './company-switcher';
import { NavUser } from './nav-user';
import type { CompanyIdentity } from './company-profile';

export function AppSidebar({
  companies,
  activeCompanyId,
  user,
  onSwitch,
  onLogout,
}: {
  companies: CompanyIdentity[];
  activeCompanyId: string | null;
  user: {
    name: string;
    email: string;
    avatar: string | null;
  };
  onSwitch: (companyId: string) => void;
  onLogout: () => void;
}) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <CompanySwitcher
          activeId={activeCompanyId}
          companies={companies}
          onSwitch={onSwitch}
        />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Painel">
                <Link to="/">
                  <LayoutDashboard />
                  <span>Painel</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser onLogout={onLogout} user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
