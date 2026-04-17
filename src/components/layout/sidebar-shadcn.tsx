"use client"

import * as React from "react"
import { Link, useLocation } from "wouter"
import { 
  Music2, 
  Home, 
  Sparkles, 
  Library, 
  Heart, 
  ListMusic, 
  User, 
  LogOut,
  Settings
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { useIsMobile } from "@/hooks/use-mobile"

// shadcn/ui sidebar components
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"

// Навигационные пункты
const navItems = [
  { icon: Home, label: "Главная", href: "/", requiresAuth: false },
  { icon: Sparkles, label: "Создать", href: "/generate", requiresAuth: false },
  { icon: Library, label: "Медиатека", href: "/library", requiresAuth: true },
  { icon: Heart, label: "Избранное", href: "/favorites", requiresAuth: true },
  { icon: ListMusic, label: "Плейлисты", href: "/playlists", requiresAuth: true },
]

// Внутренний компонент сайдбара (использует useSidebar)
function SidebarInner() {
  const [location] = useLocation()
  const { user, isAuthenticated, logout, login } = useAuth()
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  return (
    <>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Music2 className="h-4 w-4" />
          </div>
          {!isCollapsed && (
            <span className="text-lg font-semibold tracking-tight">
              Melodix<span className="text-primary">AI</span>
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Меню</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                if (item.requiresAuth && !isAuthenticated) return null
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href))
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border pt-4">
        {isAuthenticated ? (
          <>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Профиль">
                  <Link href="/profile">
                    <User />
                    <span>{user?.firstName || user?.email?.split('@')[0] || "Профиль"}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={() => logout()} 
                  tooltip="Выйти"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut />
                  <span>Выйти</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </>
        ) : (
          <div className="space-y-3 px-2 py-2">
            <div className="rounded-lg bg-sidebar-accent/50 p-3 text-center text-sm">
              <p className="font-medium">Войдите, чтобы сохранять</p>
              <p className="text-xs text-muted-foreground mt-1">Создавайте и сохраняйте свои треки</p>
            </div>
            <Button onClick={() => login()} className="w-full" size="sm">
              Войти
            </Button>
          </div>
        )}
      </SidebarFooter>
      <SidebarRail />
    </>
  )
}

// Основной компонент сайдбара с провайдером
export function Sidebar({ className }: { className?: string }) {
  const isMobile = useIsMobile()
  const [open, setOpen] = React.useState(!isMobile)

  // Синхронизация с мобильным состоянием
  React.useEffect(() => {
    setOpen(!isMobile)
  }, [isMobile])

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <ShadcnSidebar collapsible="icon" className={className}>
        <SidebarInner />
      </ShadcnSidebar>
    </SidebarProvider>
  )
}

// Компонент-обёртка для добавления кнопки-триггера (можно использовать в Topbar)
export function SidebarTriggerButton() {
  const { toggleSidebar } = useSidebar()
  return (
    <Button variant="ghost" size="icon" onClick={toggleSidebar} className="md:hidden">
      <MenuIcon className="h-5 w-5" />
    </Button>
  )
}

// Иконка для триггера
function MenuIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  )
}