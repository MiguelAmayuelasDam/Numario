import { useState } from "react"
import { NavLink, useNavigate } from "react-router-dom"
import { LogOut, Menu, UserCircle2, X } from "lucide-react"

import { ThemeToggle } from "@/components/ThemeToggle"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useAuth } from "@/context/AuthContext"
import { cn } from "@/lib/utils"

const LINKS = [
  { to: "/", label: "Inicio", end: true },
  { to: "/movimientos", label: "Movimientos", end: false },
  { to: "/analisis", label: "Análisis", end: false },
  { to: "/cartera", label: "Cartera", end: false },
]

export function TopNav() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate("/login")
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "pb-0.5 transition-colors hover:text-foreground",
      isActive
        ? "border-b-2 border-primary font-semibold text-foreground"
        : "text-muted-foreground",
    )

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:gap-6">
        {/* Logo → dashboard */}
        <NavLink to="/" end className="text-xl font-bold tracking-tight">
          Numario
        </NavLink>

        {/* Menú horizontal: solo en sm+ (en móvil va en la hamburguesa) */}
        <ul className="hidden items-center gap-5 text-sm sm:flex">
          {LINKS.map((l) => (
            <li key={l.to}>
              <NavLink to={l.to} end={l.end} className={linkClass}>
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Zona derecha: tema + perfil */}
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Menú de perfil"
                className="flex items-center gap-2 rounded-full py-1 pl-3 pr-1 text-sm transition-colors hover:bg-accent"
              >
                {/* El saludo se oculta en móvil para dejar sitio */}
                <span className="hidden text-muted-foreground sm:inline">
                  Hola,{" "}
                  <span className="font-semibold text-foreground" data-testid="user-nickname">
                    {user?.nickname}
                  </span>
                </span>
                <UserCircle2 className="size-7 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48 p-1">
              <NavLink
                to="/perfil"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
              >
                <UserCircle2 className="size-4" />
                Mi perfil
              </NavLink>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-accent"
              >
                <LogOut className="size-4" />
                Cerrar sesión
              </button>
            </PopoverContent>
          </Popover>

          {/* Hamburguesa: solo en móvil */}
          <button
            type="button"
            aria-label="Abrir menú"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:hidden"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>

      {/* Panel desplegable en móvil */}
      {mobileOpen ? (
        <ul className="border-t px-4 py-2 sm:hidden">
          {LINKS.map((l) => (
            <li key={l.to}>
              <NavLink
                to={l.to}
                end={l.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "block rounded-md px-2 py-3 text-sm transition-colors hover:bg-accent",
                    isActive ? "font-semibold text-foreground" : "text-muted-foreground",
                  )
                }
              >
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>
      ) : null}
    </header>
  )
}
