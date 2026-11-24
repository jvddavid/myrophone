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

export function AppSidebar({
  companies,
  activeCompanyId,
  user,
  onSwitch,
  onLogout,
  showAccess,
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
  showAccess: boolean;
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
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Painel">
                <Link to="/">
                  <LayoutDashboard />
                  <span>Painel</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {showAccess ? (
              <>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Acessos">
                    <Link to="/acessos">
                      <Users />
                      <span>Acessos</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Departamentos">
                    <Link to="/departamentos">
                      <Building2 />
                      <span>Departamentos</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </>
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
