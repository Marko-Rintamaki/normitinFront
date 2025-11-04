import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { token, isLoading } = useAuth();

  // Näytä latausruutu kun tarkistetaan autentikointia
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#666'
      }}>
        Ladataan...
      </div>
    );
  }

  // Jos ei ole tokenia, ohjaa login-sivulle
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Jos token on olemassa, näytä suojattu sisältö
  return <>{children}</>;
};
