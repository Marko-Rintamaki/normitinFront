import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Navigation.css';

export const Navigation = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navigation">
      <ul className="nav-list">
        <li className="nav-item">
          <NavLink 
            to="/"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            end
          >
            🏠 Etusivu
          </NavLink>
        </li>
        <li className="nav-item">
          <NavLink 
            to="/products"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            📦 Tuotteet
          </NavLink>
        </li>
        <li className="nav-item">
          <NavLink 
            to="/packages"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            📋 Paketit
          </NavLink>
        </li>
        <li className="nav-item">
          <NavLink 
            to="/settings"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            ⚙️ Asetukset
          </NavLink>
        </li>
        <li className="nav-item">
          <NavLink 
            to="/status"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            📊 Tila
          </NavLink>
        </li>
        {user && (
          <li className="nav-item nav-user">
            <span className="user-info">{user.name}</span>
            <button onClick={handleLogout} className="logout-button">
              Kirjaudu ulos
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
};
