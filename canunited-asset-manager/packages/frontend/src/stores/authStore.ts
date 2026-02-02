import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../lib/api';

export type UserRole = 'administrator' | 'analyst' | 'technician' | 'viewer';

export interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  name: string;
  role: UserRole;
  tenantId: string;
  mfaEnabled: boolean;
  siteAccess?: string[];
  avatarUrl?: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasHydrated: boolean;
  error: string | null;
  mfaPending: boolean;
  mfaUserId: string | null;
  mfaTempToken: string | null;
  login: (email: string, password: string) => Promise<{ requireMFA?: boolean }>;
  verifyMFA: (code: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  refreshAccessToken: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (roles: UserRole | UserRole[]) => boolean;
  setHasHydrated: (value: boolean) => void;
}

// Role-based permissions
const RolePermissions: Record<UserRole, string[]> = {
  administrator: [
    'dashboard:view', 'dashboard:edit',
    'assets:view', 'assets:create', 'assets:edit', 'assets:delete',
    'sensors:view', 'sensors:create', 'sensors:edit', 'sensors:delete',
    'maintenance:view', 'maintenance:create', 'maintenance:edit', 'maintenance:delete', 'maintenance:assign',
    'alerts:view', 'alerts:acknowledge', 'alerts:resolve', 'alerts:create',
    'reports:view', 'reports:create', 'reports:export',
    'analytics:view', 'analytics:advanced',
    'topology:view', 'topology:edit',
    'users:view', 'users:create', 'users:edit', 'users:delete',
    'settings:view', 'settings:edit',
    'integrations:view', 'integrations:manage',
    'audit:view'
  ],
  analyst: [
    'dashboard:view',
    'assets:view',
    'sensors:view',
    'maintenance:view',
    'alerts:view', 'alerts:acknowledge',
    'reports:view', 'reports:create', 'reports:export',
    'analytics:view', 'analytics:advanced',
    'topology:view',
    'audit:view'
  ],
  technician: [
    'dashboard:view',
    'assets:view',
    'sensors:view',
    'maintenance:view', 'maintenance:edit',
    'alerts:view', 'alerts:acknowledge', 'alerts:resolve',
    'topology:view'
  ],
  viewer: [
    'dashboard:view',
    'assets:view',
    'sensors:view',
    'maintenance:view',
    'alerts:view',
    'topology:view'
  ]
};

// Demo users for testing different roles
const demoUsers: Record<string, User> = {
  'admin@canunited.com': {
    id: 'b0000000-0000-0000-0000-000000000001',
    email: 'admin@canunited.com',
    username: 'admin',
    firstName: 'System',
    lastName: 'Admin',
    name: 'System Admin',
    role: 'administrator',
    tenantId: 'a0000000-0000-0000-0000-000000000001',
    mfaEnabled: false,
    siteAccess: ['*'],
  },
  'analyst@canunited.com': {
    id: 'b0000000-0000-0000-0000-000000000002',
    email: 'analyst@canunited.com',
    username: 'analyst',
    firstName: 'Data',
    lastName: 'Analyst',
    name: 'Data Analyst',
    role: 'analyst',
    tenantId: 'a0000000-0000-0000-0000-000000000001',
    mfaEnabled: false,
    siteAccess: ['*'],
  },
  'tech@canunited.com': {
    id: 'b0000000-0000-0000-0000-000000000003',
    email: 'tech@canunited.com',
    username: 'technician',
    firstName: 'Field',
    lastName: 'Technician',
    name: 'Field Technician',
    role: 'technician',
    tenantId: 'a0000000-0000-0000-0000-000000000001',
    mfaEnabled: false,
    siteAccess: ['c0000000-0000-0000-0000-000000000001'],
  },
  'viewer@canunited.com': {
    id: 'b0000000-0000-0000-0000-000000000004',
    email: 'viewer@canunited.com',
    username: 'viewer',
    firstName: 'Report',
    lastName: 'Viewer',
    name: 'Report Viewer',
    role: 'viewer',
    tenantId: 'a0000000-0000-0000-0000-000000000001',
    mfaEnabled: false,
    siteAccess: ['c0000000-0000-0000-0000-000000000001'],
  },
};

// Demo mode - automatically disabled when real API URL is provided
const DEMO_MODE = !import.meta.env.VITE_API_URL || import.meta.env.VITE_DEMO_MODE === 'true';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      hasHydrated: false,
      error: null,
      mfaPending: false,
      mfaUserId: null,
      mfaTempToken: null,

      setHasHydrated: (value: boolean) => set({ hasHydrated: value }),

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });

        // Demo mode - accept demo credentials
        if (DEMO_MODE) {
          await new Promise(resolve => setTimeout(resolve, 500));

          // Check for demo users
          const demoUser = demoUsers[email.toLowerCase()];
          if (demoUser && password === 'password123') {
            set({
              user: demoUser,
              accessToken: 'demo-access-token',
              refreshToken: 'demo-refresh-token',
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
            return {};
          }

          // Allow any valid-looking email for demo
          if (email.includes('@') && password.length >= 6) {
            const defaultUser: User = {
              ...demoUsers['admin@canunited.com'],
              email,
              name: email.split('@')[0],
            };
            set({
              user: defaultUser,
              accessToken: 'demo-access-token',
              refreshToken: 'demo-refresh-token',
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
            return {};
          }

          set({
            isLoading: false,
            error: 'Invalid credentials. Try admin@canunited.com / password123',
          });
          throw new Error('Invalid credentials');
        }

        // Real API login
        try {
          const response = await api.post('/auth/login', { email, password });
          const data = response.data.data;

          // Check if MFA is required
          if (data.requireMFA) {
            set({
              isLoading: false,
              mfaPending: true,
              mfaUserId: data.userId,
              mfaTempToken: data.tempToken,
            });
            return { requireMFA: true };
          }

          set({
            user: data.user,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          return {};
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.response?.data?.error?.message || 'Login failed',
          });
          throw error;
        }
      },

      verifyMFA: async (code: string) => {
        const { mfaUserId, mfaTempToken } = get();
        if (!mfaUserId || !mfaTempToken) {
          throw new Error('No MFA session');
        }

        set({ isLoading: true, error: null });

        try {
          const response = await api.post('/auth/mfa/verify', {
            userId: mfaUserId,
            code,
            tempToken: mfaTempToken,
          });
          const data = response.data.data;

          set({
            user: data.user,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            isAuthenticated: true,
            isLoading: false,
            mfaPending: false,
            mfaUserId: null,
            mfaTempToken: null,
            error: null,
          });
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.response?.data?.error?.message || 'Invalid MFA code',
          });
          throw error;
        }
      },

      logout: () => {
        const { refreshToken, accessToken } = get();

        // Call logout endpoint if we have tokens
        if (accessToken && !DEMO_MODE) {
          api.post('/auth/logout', { refreshToken }).catch(() => {});
        }

        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          error: null,
          mfaPending: false,
          mfaUserId: null,
          mfaTempToken: null,
        });
      },

      checkAuth: async () => {
        const { accessToken } = get();
        if (!accessToken) {
          set({ isLoading: false, isAuthenticated: false });
          return;
        }

        // Demo mode - skip real API entirely
        if (DEMO_MODE) {
          const user = get().user;
          if (user) {
            set({ isAuthenticated: true, isLoading: false });
          } else {
            set({ isAuthenticated: false, isLoading: false });
          }
          return;
        }

        // Production mode - call real API
        try {
          const response = await api.get('/auth/me');
          set({
            user: response.data.data,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          // Try to refresh token
          try {
            await get().refreshAccessToken();
          } catch {
            set({
              user: null,
              accessToken: null,
              refreshToken: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        }
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get();
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        if (DEMO_MODE) {
          return;
        }

        try {
          const response = await api.post('/auth/refresh', { refreshToken });
          const data = response.data.data;

          set({
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
          });
        } catch (error) {
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
          });
          throw error;
        }
      },

      hasPermission: (permission: string) => {
        const user = get().user;
        if (!user) return false;
        return RolePermissions[user.role]?.includes(permission) ?? false;
      },

      hasRole: (roles: UserRole | UserRole[]) => {
        const user = get().user;
        if (!user) return false;
        const roleArray = Array.isArray(roles) ? roles : [roles];
        return roleArray.includes(user.role);
      },
    }),
    {
      name: 'canunited-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // If we have a token and user, consider authenticated
          if (state.accessToken && state.user) {
            state.isAuthenticated = true;
          }
          // Mark as hydrated
          state.setHasHydrated(true);
          // Then verify with backend
          state.checkAuth();
        }
      },
    }
  )
);

// Utility hooks
export const usePermission = (permission: string) => {
  return useAuthStore((state) => state.hasPermission(permission));
};

export const useRole = (roles: UserRole | UserRole[]) => {
  return useAuthStore((state) => state.hasRole(roles));
};
