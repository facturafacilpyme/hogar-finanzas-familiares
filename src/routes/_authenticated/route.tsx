import { createFileRoute, Outlet, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Wallet,
  PiggyBank,
  Calendar,
  Receipt,
  BarChart3,
  History,
  Users,
  LogOut,
  HandCoins,
  UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/NotificationBell";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import { ReminderPopup } from "@/components/ReminderPopup";
import { SyncStatus } from "@/components/SyncStatus";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthedLayout,
});

const items = [
  { title: "Panel", to: "/panel", icon: LayoutDashboard },
  { title: "Deudas", to: "/deudas", icon: Wallet },
  { title: "Abonos", to: "/abonos", icon: HandCoins },
  { title: "Calendario", to: "/calendario", icon: Calendar },
  { title: "Ahorros", to: "/ahorros", icon: PiggyBank },
  { title: "Caja Menor", to: "/caja-menor", icon: Receipt },
  { title: "Reportes", to: "/reportes", icon: BarChart3 },
  { title: "Historial", to: "/historial", icon: History },
] as const;

function NavLinks({ items }: { items: readonly { title: string; to: string; icon: any }[] }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { setOpenMobile, isMobile } = useSidebar();
  return (
    <SidebarMenu>
      {items.map((it) => (
        <SidebarMenuItem key={it.to}>
          <SidebarMenuButton asChild isActive={pathname === it.to}>
            <Link to={it.to} onClick={() => isMobile && setOpenMobile(false)}>
              <it.icon />
              <span>{it.title}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

function AuthedLayout() {
  const { user, loading, profile, role, signOut, memberships, familyId, familyName, setFamilyId } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [loading, user, nav]);

  if (loading || !user) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Cargando…</div>;
  }

  const allItems = [
    ...items,
    { title: "Mi familia", to: "/miembros", icon: Users },
    { title: "Mi cuenta", to: "/cuenta", icon: UserCog },
  ];

  async function handleSignOut() {
    await signOut();
    nav({ to: "/auth" });
  }

  return (
    <SidebarProvider>
      <ConfirmProvider>
      <div className="flex min-h-screen w-full overflow-x-hidden">
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <div className="flex items-center gap-2 px-2 py-2">
              <img src="/favicon.ico" alt="Logo de HogarFin" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                <div className="truncate font-display font-bold">HogarFin</div>
                <div className="truncate text-xs text-muted-foreground">
                  {profile?.name}
                  {familyName ? ` · ${familyName}` : ""}
                </div>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Menú</SidebarGroupLabel>
              <SidebarGroupContent>
                <NavLinks items={allItems} />
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={handleSignOut}>
                      <LogOut />
                      <span>Salir</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <div className="flex min-w-0 max-w-full flex-1 flex-col overflow-x-hidden">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-b bg-background/95 px-2 backdrop-blur sm:px-3">
            <div className="flex min-w-0 items-center gap-2">
              <SidebarTrigger />
              {memberships.length > 1 ? (
                <Select value={familyId ?? undefined} onValueChange={setFamilyId}>
                  <SelectTrigger className="h-8 w-[110px] text-xs sm:w-[150px]"><SelectValue placeholder="Familia" /></SelectTrigger>
                  <SelectContent>
                    {memberships.map((m) => (
                      <SelectItem key={m.family_id} value={m.family_id}>{m.family_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                familyName && <span className="min-w-0 break-words text-xs font-medium leading-tight">{familyName}</span>
              )}
              <span className="hidden rounded-full bg-accent px-2 py-0.5 text-xs font-semibold capitalize text-accent-foreground sm:inline">
                {role}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <SyncStatus />
              <NotificationBell />
              <Button size="sm" variant="ghost" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <main className="w-full min-w-0 flex-1 overflow-x-hidden p-3 sm:p-4 md:p-6">
            <div className="mx-auto w-full min-w-0 max-w-6xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      <ReminderPopup />
      </ConfirmProvider>
    </SidebarProvider>
  );
}