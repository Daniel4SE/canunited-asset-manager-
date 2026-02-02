import React from 'react';
import { useAuthStore, UserRole } from '../../stores/authStore';

interface PermissionGateProps {
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  role?: UserRole | UserRole[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGate({
  permission,
  permissions,
  requireAll = false,
  role,
  fallback = null,
  children,
}: PermissionGateProps) {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const hasRole = useAuthStore((state) => state.hasRole);

  // Check single permission
  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>;
  }

  // Check multiple permissions
  if (permissions && permissions.length > 0) {
    const checks = permissions.map((p) => hasPermission(p));
    const hasAccess = requireAll ? checks.every(Boolean) : checks.some(Boolean);
    if (!hasAccess) {
      return <>{fallback}</>;
    }
  }

  // Check role
  if (role && !hasRole(role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

interface RoleBadgeProps {
  role: UserRole;
  size?: 'sm' | 'md' | 'lg';
}

const roleColors: Record<UserRole, { bg: string; text: string }> = {
  administrator: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  analyst: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  technician: { bg: 'bg-green-500/20', text: 'text-green-400' },
  viewer: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
};

const roleLabels: Record<UserRole, string> = {
  administrator: 'Administrator',
  analyst: 'Analyst',
  technician: 'Technician',
  viewer: 'Viewer',
};

export function RoleBadge({ role, size = 'md' }: RoleBadgeProps) {
  const colors = roleColors[role] || roleColors.viewer;
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${colors.bg} ${colors.text} ${sizeClasses[size]}`}
    >
      {roleLabels[role] || role}
    </span>
  );
}

interface AccessDeniedProps {
  title?: string;
  message?: string;
  showLogin?: boolean;
}

export function AccessDenied({
  title = 'Access Denied',
  message = "You don't have permission to view this content.",
  showLogin = false,
}: AccessDeniedProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-white mb-2">{title}</h2>
      <p className="text-gray-400 max-w-md">{message}</p>
      {showLogin && (
        <a
          href="/login"
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Sign In
        </a>
      )}
    </div>
  );
}

export function useCanAccess(permission: string): boolean {
  return useAuthStore((state) => state.hasPermission(permission));
}

export function useCanAccessAny(permissions: string[]): boolean {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  return permissions.some((p) => hasPermission(p));
}

export function useCanAccessAll(permissions: string[]): boolean {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  return permissions.every((p) => hasPermission(p));
}
