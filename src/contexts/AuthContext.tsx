import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useSocket } from '../context/SocketContext';
import type { ServerResponse } from '../services/socket';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'normitin_token';
const USER_KEY = 'normitin_user';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { socketClient } = useSocket();

  // Lataa token ja käyttäjä localStoragesta kun sovellus käynnistyy
  useEffect(() => {
    const loadAuth = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);

      if (storedToken && storedUser && socketClient) {
        try {
          // Tarkista että token on vielä voimassa
          const response = await socketClient.apiRequest('verify_token', {
            token: storedToken
          }) as ServerResponse;

          if (response.success) {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
            console.log('✅ Token voimassa, käyttäjä kirjautunut:', JSON.parse(storedUser).name);
          } else {
            // Token ei ole enää voimassa
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            console.log('⚠️ Token vanhentunut, kirjaudu uudelleen');
          }
        } catch (error) {
          console.error('Token vahvistus epäonnistui:', error);
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
        }
      }
      setIsLoading(false);
    };

    if (socketClient) {
      loadAuth();
    }
  }, [socketClient]);

  const login = async (email: string, password: string) => {
    if (!socketClient) {
      throw new Error('Socket-yhteys ei ole valmis');
    }

    try {
      const response = await socketClient.apiRequest('login', {
        email,
        password
      }) as ServerResponse & {
        data?: {
          token?: string;
          user?: User;
        };
      };

      if (response.success && response.data?.token && response.data?.user) {
        const newToken = response.data.token;
        const newUser = response.data.user;

        setToken(newToken);
        setUser(newUser);

        // Tallenna localStorageen
        localStorage.setItem(TOKEN_KEY, newToken);
        localStorage.setItem(USER_KEY, JSON.stringify(newUser));

        console.log('✅ Kirjautuminen onnistui:', newUser.name);
      } else {
        throw new Error(response.message || 'Kirjautuminen epäonnistui');
      }
    } catch (error: unknown) {
      console.error('Kirjautuminen epäonnistui:', error);
      if (error && typeof error === 'object' && 'message' in error) {
        throw new Error((error as { message: string }).message);
      }
      throw new Error('Kirjautuminen epäonnistui. Tarkista käyttäjätunnus ja salasana.');
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    console.log('👋 Kirjauduttu ulos');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
