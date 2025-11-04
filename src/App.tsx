import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { SocketProvider } from './context/SocketContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { HomePage } from './pages/HomePage'
import { ProductsPage } from './pages/ProductsPage'
import { PackagesPage } from './pages/PackagesPage'
import { SettingsPage } from './pages/SettingsPage'
import { StatusPage } from './pages/StatusPage'
import './App.css'

function App() {
  return (
    <Router>
      <SocketProvider>
        <AuthProvider>
          <Routes>
            {/* Public route - Login */}
            <Route path="/login" element={<LoginPage />} />
            
            {/* Protected routes - Layout wrapper */}
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<HomePage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="packages" element={<PackagesPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="status" element={<StatusPage />} />
            </Route>
            
            {/* Redirect unknown routes to login */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </AuthProvider>
      </SocketProvider>
    </Router>
  )
}

export default App
