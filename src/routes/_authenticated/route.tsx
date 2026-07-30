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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/NotificationBell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthedLayout,
});

const items = [
  { title: "Panel", to: "/panel", icon: LayoutDashboard },
  { title: "Deudas", to: "/deudas", icon: Wallet },
  { title: "Calendario", to: "/calendario", icon: Calendar },
  { title: "Ahorros", to: "/ahorros", icon: PiggyBank },
  { title: "Caja Menor", to: "/caja-menor", icon: Receipt },
  { title: "Reportes", to: "/reportes", icon: BarChart3 },
  { title: "Historial", to: "/historial", icon: History },
] as const;

function AuthedLayout() {
  const { user, loading, profile, role, signOut, memberships, familyId, familyName, setFamilyId } = useAuth();
  const nav = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [loading, user, nav]);

  if (loading || !user) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Cargando…</div>;
  }

  const allItems = role === "admin"
    ? [...items, { title: "Mi familia", to: "/miembros" as const, icon: Users }]
    : items;

  async function handleSignOut() {
    await signOut();
    nav({ to: "/auth" });
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <div className="flex items-center gap-2 px-2 py-2">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
                <Wallet className="h-4 w-4" />
              </div>
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
                <SidebarMenu>
                  {allItems.map((it) => (
                    <SidebarMenuItem key={it.to}>
                      <SidebarMenuButton asChild isActive={pathname === it.to}>
                        <Link to={it.to}>
                          <it.icon />
                          <span>{it.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
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

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b bg-background/95 px-3 backdrop-blur">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              {memberships.length > 1 ? (
                <Select value={familyId ?? undefined} onValueChange={setFamilyId}>
                  <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="Familia" /></SelectTrigger>
                  <SelectContent>
                    {memberships.map((m) => (
                      <SelectItem key={m.family_id} value={m.family_id}>{m.family_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                familyName && <span className="max-w-[140px] truncate text-xs font-medium">{familyName}</span>
              )}
              <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold capitalize text-accent-foreground">
                {role}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <Button size="sm" variant="ghost" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}