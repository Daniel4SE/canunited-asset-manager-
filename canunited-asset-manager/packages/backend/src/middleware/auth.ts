import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { unauthorized, forbidden } from './errorHandler.js';
import { UserRole, hasPermission } from '@canunited/shared';

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  tenantId: string;
  organizationId: string;
  vendorAccess: string[];
  siteAccess: string[];
  mfaVerified?: boolean;
  tokenType: 'access' | 'refresh';
}

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    unauthorized('No authentication token provided');
  }

  const token = authHeader!.split(' ')[1];

  try {
    const payload = jwt.verify(token, config.jwt.secret) as JWTPayload;

    if (payload.tokenType !== 'access') {
      unauthorized('Invalid token type');
    }

    req.user = payload;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      unauthorized('Token has expired');
    }
    unauthorized('Invalid token');
  }
}

export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      unauthorized();
    }

    if (!allowedRoles.includes(req.user!.role)) {
      forbidden('You do not have permission to access this resource');
    }

    next();
  };
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      unauthorized();
    }

    if (!hasPermission(req.user!.role, permission)) {
      forbidden(`Missing permission: ${permission}`);
    }

    next();
  };
}

export function requireMFA(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    unauthorized();
  }

  if (!req.user!.mfaVerified) {
    forbidden('MFA verification required');
  }

  next();
}

export function canAccessSite(siteId: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      unauthorized();
    }

    // Admin can access everything
    if (req.user!.role === UserRole.ADMIN) {
      next();
      return;
    }

    // Check if user has access to this site
    if (!req.user!.siteAccess.includes(siteId) && !req.user!.siteAccess.includes('*')) {
      forbidden('You do not have access to this site');
    }

    next();
  };
}

export function canAccessTenant(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    unauthorized();
  }

  const requestedTenantId = req.params.tenantId || req.body?.tenantId || req.query?.tenantId;

  if (requestedTenantId && requestedTenantId !== req.user!.tenantId) {
    // Admin can access all tenants in their organization
    if (req.user!.role !== UserRole.ADMIN) {
      forbidden('You do not have access to this tenant');
    }
  }

  next();
}

export function generateAccessToken(payload: Omit<JWTPayload, 'tokenType'>): string {
  return jwt.sign(
    { ...payload, tokenType: 'access' },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

export function generateRefreshToken(payload: Omit<JWTPayload, 'tokenType'>): string {
  return jwt.sign(
    { ...payload, tokenType: 'refresh' },
    config.jwt.secret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );
}

export function verifyRefreshToken(token: string): JWTPayload {
  const payload = jwt.verify(token, config.jwt.secret) as JWTPayload;

  if (payload.tokenType !== 'refresh') {
    throw new Error('Invalid token type');
  }

  return payload;
}

// Legacy function for backward compatibility
export function generateToken(payload: Omit<JWTPayload, 'tokenType'>): string {
  return generateAccessToken(payload);
}
