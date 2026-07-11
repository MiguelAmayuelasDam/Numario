import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useAuth } from "@/context/AuthContext"

export default function Dashboard() {
  const { user, logout } = useAuth()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Numario</CardTitle>
          <CardDescription>Gestor de finanzas personales</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Hola,</p>
            <p className="text-lg font-semibold" data-testid="user-nickname">
              {user?.nickname}
            </p>
            <p className="text-sm text-muted-foreground" data-testid="user-email">
              {user?.email}
            </p>
          </div>
          <p className="text-sm">
            Sesión iniciada correctamente. Aquí llegará tu dashboard financiero en las
            próximas fases.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/movimientos">Ver movimientos</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/analisis">Análisis</Link>
            </Button>
            <Button variant="outline" onClick={() => void logout()}>
              Cerrar sesión
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
