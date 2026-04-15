export interface User {
  id: string;
  email: string;
  name?: string;
}

interface ApiResponse {
  success: boolean;
  user?: User;
  error?: string;
}

class AuthService {
  private static instance: AuthService;
  private currentUser: User | null = null;

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  async login(email: string, password: string): Promise<User> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    
    const data: ApiResponse = await response.json();
    
    if (data.success && data.user) {
      this.setUser(data.user);
      return data.user;
    }
    
    throw new Error(data.error || 'Login failed');
  }

  async register(email: string, password: string, name?: string): Promise<User> {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    
    const data: ApiResponse = await response.json();
    
    if (data.success && data.user) {
      this.setUser(data.user);
      return data.user;
    }
    
    throw new Error(data.error || 'Registration failed');
  }

  async logout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      this.clearUser();
    }
  }

  setUser(user: User): void {
    this.currentUser = user;
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(user));
    }
  }

  clearUser(): void {
    this.currentUser = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user');
    }
  }

  getUser(): User | null {
    if (this.currentUser) {
      return this.currentUser;
    }
    
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        this.currentUser = JSON.parse(userStr);
        return this.currentUser;
      }
    }
    
    return null;
  }

  isAuthenticated(): boolean {
    return !!this.getUser();
  }
}

export const authService = AuthService.getInstance();