import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

import { AppLayout } from "@/components/AppLayout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { AuthProvider } from "@/context/AuthContext"
import { ThemeProvider } from "@/context/ThemeContext"
import Analytics from "@/pages/Analytics"
import Dashboard from "@/pages/Dashboard"
import EmergencyFund from "@/pages/EmergencyFund"
import Import from "@/pages/Import"
import Login from "@/pages/Login"
import Portfolio from "@/pages/Portfolio"
import PortfolioState from "@/pages/PortfolioState"
import Profile from "@/pages/Profile"
import Register from "@/pages/Register"
import Transactions from "@/pages/Transactions"

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            {/* Páginas autenticadas: barra superior constante (AppLayout). */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/movimientos" element={<Transactions />} />
              <Route path="/importar" element={<Import />} />
              <Route path="/analisis" element={<Analytics />} />
              <Route path="/colchon" element={<EmergencyFund />} />
              <Route path="/cartera" element={<Portfolio />} />
              <Route path="/cartera/estado" element={<PortfolioState />} />
              <Route path="/perfil" element={<Profile />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
