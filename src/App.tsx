import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { ProductsPage } from './pages/ProductsPage'
import { PackagesPage } from './pages/PackagesPage'
import { SettingsPage } from './pages/SettingsPage'
import { StatusPage } from './pages/StatusPage'
import './App.css'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="packages" element={<PackagesPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="status" element={<StatusPage />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App
