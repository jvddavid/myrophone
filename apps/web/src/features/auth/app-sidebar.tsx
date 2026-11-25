import { Building2, LayoutDashboard, Users } from 'lucide-react';
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
import type { SidebarDestination } from '../access/navigation';

export function AppSidebar({
  companies,
  activeCompanyId,
  user,
  onSwitch,
  onLogout,
  destinations,
  showCompanySettings,
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
  destinations: readonly SidebarDestination[];
  showCompanySettings: boolean;
}) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <CompanySwitcher
          activeId={activeCompanyId}
          companies={companies}
          onSwitch={onSwitch}
          showSettings={showCompanySettings}
        />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarMenu>
            {destinations.includes('panel') ? (
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Painel">
                  <Link to="/">
                    <LayoutDashboard />
                    <span>Painel</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ) : null}
            {destinations.includes('access') ? (
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Acessos">
                  <Link to="/acessos">
                    <Users />
                    <span>Acessos</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ) : null}
            {destinations.includes('departments') ? (
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Departamentos">
                  <Link to="/departamentos">
                    <Building2 />
                    <span>Departamentos</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ) : null}
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
