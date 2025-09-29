import { Outlet } from 'react-router-dom';
import { Navigation } from './Navigation';
import { SocketProvider } from '../context/SocketContext';
import './Layout.css';

export const Layout = () => {
  return (
    <SocketProvider>
      <div className="layout">
        <header className="layout-header">
          <div className="header-content">
            <h1 className="logo">Normitin</h1>
            <Navigation />
          </div>
        </header>
        
        <main className="layout-main">
          <div className="main-content">
            <Outlet />
          </div>
        </main>
        
        <footer className="layout-footer">
          <p>&copy; 2025 Normitin - Tuotteiden hallintajärjestelmä</p>
        </footer>
      </div>
    </SocketProvider>
  );
};