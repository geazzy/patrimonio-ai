import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthUser } from '../models/types.js';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const JWT_SECRET = process.env.APP_JWT_SECRET || 'your-secret-key-change-in-production';
const ACCESS_TOKEN_EXPIRY = '15m';

export function generateAccessToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function verifyAccessToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch (error) {
    return null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const accessToken = req.cookies?.access_token;

  if (!accessToken) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }

  const user = verifyAccessToken(accessToken);

  if (!user) {
    res.status(401).json({ error: 'Token inválido ou expirado' });
    return;
  }

  if (!user.isApproved) {
    res.status(403).json({ error: 'Aguardando aprovação do administrador' });
    return;
  }

  req.user = user;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }

  if (!req.user.isAdmin) {
    res.status(403).json({ error: 'Acesso negado: apenas administradores' });
    return;
  }

  next();
}
