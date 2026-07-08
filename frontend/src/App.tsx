import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

import { ProtectedRoute } from "@/components/ProtectedRoute"
import { AuthProvider } from "@/context/AuthContext"
import Dashboard from "@/pages/Dashboard"
import Login from "@/pages/Login"
import Register from "@/pages/Register"

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
