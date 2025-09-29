import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { SocketClient } from '../services/socket';
import type { AppInfo, HealthStatus } from '../services/socket';

interface ConnectionStatus {
  connected: boolean;
  socketId?: string;
  reason?: string;
}

interface SocketContextType {
  socketClient: SocketClient | null;
  connectionStatus: ConnectionStatus;
  appInfo: AppInfo | null;
  healthStatus: HealthStatus | null;
  error: string | null;
  isLoading: boolean;
  ping: () => void;
  refreshHealth: () => void;
  makeRequest: (type: string, data?: Record<string, unknown>) => Promise<unknown>;
}

const SocketContext = createContext<SocketContextType | null>(null);

interface SocketProviderProps {
  children: React.ReactNode;
}

export const SocketProvider = ({ children }: SocketProviderProps) => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({ connected: false });
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const socketClient = useRef<SocketClient | null>(null);
  const heartbeatInterval = useRef<number | null>(null);

  useEffect(() => {
    // Initialize socket client
    socketClient.current = new SocketClient({
      url: 'http://localhost:3001',
      autoConnect: true
    });

    const client = socketClient.current;

    // Set up event listeners
    client.on('connection-status', (status: unknown) => {
      const connectionData = status as ConnectionStatus;
      setConnectionStatus(connectionData);
      setError(null);
      
      if (connectionData.connected) {
        fetchAppInfo();
        fetchHealthStatus();
        
        // Start heartbeat
        if (heartbeatInterval.current) {
          client.stopHeartbeat(heartbeatInterval.current);
        }
        heartbeatInterval.current = client.startHeartbeat(30000);
      } else {
        setIsLoading(false);
      }
    });

    client.on('connection-error', (errorData: unknown) => {
      const errorInfo = errorData as { error: string, maxAttemptsReached?: boolean };
      setError(`Connection failed: ${errorInfo.error}`);
      setIsLoading(false);
      
      if (errorInfo.maxAttemptsReached) {
        setError(`Failed to connect after maximum attempts: ${errorInfo.error}`);
      }
    });

    // Cleanup function
    return () => {
      if (heartbeatInterval.current) {
        client.stopHeartbeat(heartbeatInterval.current);
      }
      client.destroy();
    };
  }, []);

  const fetchAppInfo = async () => {
    try {
      if (socketClient.current) {
        const info = await socketClient.current.getAppInfo();
        setAppInfo(info);
        setIsLoading(false);
      }
    } catch (err) {
      setError(`Failed to fetch app info: ${(err as Error).message}`);
      setIsLoading(false);
    }
  };

  const fetchHealthStatus = async () => {
    try {
      if (socketClient.current) {
        const health = await socketClient.current.getHealthStatus();
        setHealthStatus(health);
      }
    } catch (err) {
      console.error('Failed to fetch health status:', err);
    }
  };

  const ping = () => {
    if (socketClient.current) {
      socketClient.current.ping();
    }
  };

  const makeRequest = async (type: string, data?: Record<string, unknown>) => {
    if (socketClient.current) {
      return await socketClient.current.makeRequest(type, data);
    }
    throw new Error('Socket client not available');
  };

  const contextValue: SocketContextType = {
    socketClient: socketClient.current,
    connectionStatus,
    appInfo,
    healthStatus,
    error,
    isLoading,
    ping,
    refreshHealth: fetchHealthStatus,
    makeRequest
  };

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};