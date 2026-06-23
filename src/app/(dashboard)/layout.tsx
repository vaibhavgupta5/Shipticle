"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { 
  LayoutDashboard, 
  Lightbulb, 
  FileText, 
  Settings, 
  LogOut,
  Ship 
} from "lucide-react";

const navItems = [
  { label: "Pipeline", href: "/dashboard", icon: LayoutDashboard },
  { label: "Ideas", href: "/dashboard/ideas", icon: Lightbulb },
  { label: "Articles", href: "/dashboard/articles", icon: FileText },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  async function handleSignOut() {
    await signOut(auth);
    router.push("/login");
    router.refresh();
  }

  return (
    <SidebarProvider>
      <Sidebar variant="inset">
        <SidebarHeader>
          <div className="flex items-center px-3 py-3">
            <span className="text-lg font-bold tracking-tighter text-sidebar-foreground">
              Shipticle<span className="text-primary">.</span>
            </span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="gap-2">
                {navItems.map((item) => {
                  const isActive =
                    item.href === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname.startsWith(item.href);

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        size="lg"
                        className="transition-all duration-200 hover:translate-x-1"
                        isActive={isActive}
                        tooltip={item.label}
                      >
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          {user && (
            <div className="flex items-center gap-3 px-2 py-2">
              {user.photoURL ? (

                <img
                  src={user.photoURL}
                  alt={user.displayName ?? "User"}
                  className="w-8 h-8 rounded-full object-cover border border-sidebar-border"
                />
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold bg-primary/20 text-primary border border-sidebar-border">
                  {user.displayName?.[0]?.toUpperCase() ?? "U"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate text-sidebar-foreground">
                  {user.displayName ?? user.email}
                </p>
              </div>
            </div>
          )}
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={handleSignOut}
                className="text-muted-foreground hover:text-destructive"
              >
                <LogOut />
                <span>Sign out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex items-center gap-2 px-3 text-sm font-medium text-muted-foreground">
             <span className="opacity-50">/</span>
             <span className="capitalize">{pathname === '/dashboard' ? 'Overview' : pathname.split('/').pop()}</span>
          </div>
        </header>
        <div className="flex-1 p-6 lg:p-8 bg-background">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
