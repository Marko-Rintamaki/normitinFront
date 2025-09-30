import { io, Socket } from 'socket.io-client';
import type { ApiResponse, ProductSearchResponse } from '../types/api';

export interface SocketConfig {
  url: string;
  autoConnect?: boolean;
  timeout?: number;
}

export interface ServerResponse {
  success: boolean;
  message?: string;
  data?: unknown;
  error?: string;
}

export interface AppInfo {
  name: string;
  version: string;
  environment: string;
  uptime: number;
  timestamp: string;
}

export interface HealthStatus {
  status: string;
  timestamp: string;
  connections: number;
}

export class SocketClient {
  private socket: Socket;
  private config: SocketConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private eventListeners: Map<string, ((...args: unknown[]) => void)[]> = new Map();

  constructor(config?: Partial<SocketConfig>) {
    this.config = {
      url: config?.url || 'http://localhost:3001',
      autoConnect: config?.autoConnect ?? true,
      timeout: config?.timeout || 10000
    };

    this.socket = io(this.config.url, {
      autoConnect: this.config.autoConnect,
      timeout: this.config.timeout,
      transports: ['websocket', 'polling']
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.socket.on('connect', () => {
      console.log('🔌 Connected to Normitin server');
      this.reconnectAttempts = 0;
      this.emit('connection-status', { connected: true, socketId: this.socket.id });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from server:', reason);
      this.emit('connection-status', { connected: false, reason });
    });

    this.socket.on('connect_error', (error) => {
      console.error('🚫 Connection error:', error.message);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('❌ Max reconnection attempts reached');
        this.emit('connection-error', { 
          error: error.message,
          maxAttemptsReached: true 
        });
      } else {
        this.emit('connection-error', { 
          error: error.message,
          attempt: this.reconnectAttempts 
        });
      }
    });

    this.socket.on('connected', (data) => {
      console.log('✅ Server welcome message:', data);
      this.emit('server-welcome', data);
    });

    this.socket.on('pong', (data) => {
      this.emit('pong-received', data);
    });

    // Handle custom events
    this.socket.onAny((event, ...args) => {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        listeners.forEach(listener => listener(...args));
      }
    });
  }

  public connect(): void {
    if (!this.socket.connected) {
      this.socket.connect();
    }
  }

  public disconnect(): void {
    this.socket.disconnect();
  }

  public isConnected(): boolean {
    return this.socket.connected;
  }

  public getSocketId(): string | undefined {
    return this.socket.id;
  }

  // Event listener management
  public on(event: string, callback: (...args: unknown[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  public off(event: string, callback?: (...args: unknown[]) => void): void {
    if (!callback) {
      this.eventListeners.delete(event);
      return;
    }
    
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: unknown): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }

  // API methods
  public async getAppInfo(): Promise<AppInfo> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, this.config.timeout);

      this.socket.emit('get-app-info', (response: AppInfo) => {
        clearTimeout(timeout);
        resolve(response);
      });
    });
  }

  public async getHealthStatus(): Promise<HealthStatus> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, this.config.timeout);

      this.socket.emit('health-check', (response: HealthStatus) => {
        clearTimeout(timeout);
        resolve(response);
      });
    });
  }

  public async makeRequest(type: string, data?: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, this.config.timeout);

      this.socket.emit('request', { type, ...data }, (response: ServerResponse) => {
        clearTimeout(timeout);
        
        if (response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response.error || 'Request failed'));
        }
      });
    });
  }

  public ping(): void {
    this.socket.emit('ping');
  }

  // API request method for backend integration
  public async apiRequest(action: string, params?: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('API request timeout'));
      }, this.config.timeout);

      // Lähetä parametrit suoraan requestData-objektissa, älä params-objektissa
      const requestData = { action, ...params };
      
      this.socket.emit('api-request', requestData, (response: ApiResponse) => {
        clearTimeout(timeout);
        
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'API request failed'));
        }
      });
    });
  }

  // Product search methods
  public async searchProducts(query: string, options?: {
    limit?: number;
    offset?: number;
    activeOnly?: boolean;
    supplier?: string;
    productLine?: string;
  }): Promise<ApiResponse<ProductSearchResponse>> {
    return this.apiRequest('search_products', {
      query,
      ...options
    }) as Promise<ApiResponse<ProductSearchResponse>>;
  }

  public async searchProductsWithInstallations(query: string, options?: {
    limit?: number;
    offset?: number;
    activeOnly?: boolean;
    supplier?: string;
    productLine?: string;
  }): Promise<ApiResponse<ProductSearchResponse>> {
    return this.apiRequest('search_products_with_installations', {
      query,
      ...options
    }) as Promise<ApiResponse<ProductSearchResponse>>;
  }

  public async getSuppliers(): Promise<ApiResponse<{ supplier_code: string; supplier_name: string; }[]>> {
    return this.apiRequest('get_suppliers') as Promise<ApiResponse<{ supplier_code: string; supplier_name: string; }[]>>;
  }

  public async getProductLines(): Promise<ApiResponse<string[]>> {
    return this.apiRequest('get_product_lines') as Promise<ApiResponse<string[]>>;
  }

  // Installation methods API
  public async getInstallationMethods(): Promise<ApiResponse<Array<{
    id: number;
    method_name: string;
    method_code: number;
    description?: string;
  }>>> {
    return this.apiRequest('get_product_installation_methods') as Promise<ApiResponse<Array<{
      id: number;
      method_name: string;
      method_code: number;
      description?: string;
    }>>>;
  }

  public async addProductInstallation(params: {
    productCode: string;
    productLine: string;
    methodCode: number;
    standardHours: number;
    isDefault?: boolean;
  }): Promise<ApiResponse<{ success: boolean; id?: string }>> {
    return this.apiRequest('add_product_installation', params) as Promise<ApiResponse<{ success: boolean; id?: string }>>;
  }

  public async getProductInstallations(params: {
    productCode: string;
    productLine: string;
  }): Promise<ApiResponse<Array<{
    id: string;
    installationMethodId: string;
    installationMethodName: string;
    normiTime: number;
    notes?: string;
  }>>> {
    return this.apiRequest('get_product_installations', params) as Promise<ApiResponse<Array<{
      id: string;
      installationMethodId: string;
      installationMethodName: string;
      normiTime: number;
      notes?: string;
    }>>>;
  }

  // Utility method for periodic ping to keep connection alive
  public startHeartbeat(interval: number = 30000): number {
    return window.setInterval(() => {
      if (this.isConnected()) {
        this.ping();
      }
    }, interval);
  }

  public stopHeartbeat(intervalId: number): void {
    window.clearInterval(intervalId);
  }

  public destroy(): void {
    this.eventListeners.clear();
    this.socket.removeAllListeners();
    this.socket.disconnect();
  }
}