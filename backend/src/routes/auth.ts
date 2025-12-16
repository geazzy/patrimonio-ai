import { Router, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import { getDatabase } from '../services/dbService.js';
import { generateAccessToken, verifyAccessToken } from '../middleware/auth.js';
import { loginLimiter, refreshLimiter } from '../middleware/rateLimiter.js';

const router = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const REFRESH_TOKEN_EXPIRY_DAYS = 30;
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/'
};

// POST /api/auth/google - Login com Google
router.post('/google', loginLimiter, async (req: Request, res: Response) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      res.status(400).json({ error: 'Credential não fornecido' });
      return;
    }

    // Verificar o ID token do Google
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    
    if (!payload || !payload.email || !payload.sub) {
      res.status(400).json({ error: 'Token inválido' });
      return;
    }

    const db = getDatabase(process.env.DATABASE_PATH || './data/patrimonio.db');

    // Criar ou atualizar usuário
    const user = db.createOrUpdateUser(
      payload.sub,
      payload.email,
      payload.name || payload.email
    );

    // Verificar se usuário está aprovado
    if (!user.isApproved) {
      res.status(403).json({ 
        error: 'Aguardando aprovação do administrador',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isApproved: false
        }
      });
      return;
    }

    // Gerar tokens
    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      name: user.name,
      isAdmin: user.isAdmin,
      isApproved: user.isApproved
    });

    const refreshToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    
    db.createRefreshToken(user.id, refreshToken, expiresAt);

    // Configurar cookies
    res.cookie('access_token', accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 15 * 60 * 1000 // 15 minutos
    });

    res.cookie('refresh_token', refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000 // 30 dias
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.isAdmin,
        isApproved: user.isApproved
      }
    });

  } catch (error) {
    console.error('Erro no login Google:', error);
    res.status(500).json({ error: 'Erro ao autenticar com Google' });
  }
});

// GET /api/auth/me - Obter usuário atual
router.get('/me', (req: Request, res: Response) => {
  const accessToken = req.cookies?.access_token;
  const refreshToken = req.cookies?.refresh_token;

  if (!accessToken && !refreshToken) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }

  // Tentar validar access token
  let user = accessToken ? verifyAccessToken(accessToken) : null;

  // Se access token expirou, tentar renovar com refresh token
  if (!user && refreshToken) {
    try {
      const db = getDatabase(process.env.DATABASE_PATH || './data/patrimonio.db');
      const tokenData = db.validateRefreshToken(refreshToken);

      if (tokenData) {
        const userData = db.getUserById(tokenData.userId);

        if (userData && userData.isApproved) {
          // Gerar novo access token
          const newAccessToken = generateAccessToken({
            id: userData.id,
            email: userData.email,
            name: userData.name,
            isAdmin: userData.isAdmin,
            isApproved: userData.isApproved
          });

          res.cookie('access_token', newAccessToken, {
            ...COOKIE_OPTIONS,
            maxAge: 15 * 60 * 1000
          });

          res.json({
            user: {
              id: userData.id,
              email: userData.email,
              name: userData.name,
              isAdmin: userData.isAdmin,
              isApproved: userData.isApproved
            }
          });
          return;
        }
      }
    } catch (error) {
      console.error('Erro ao renovar token:', error);
    }
  }

  if (user) {
    res.json({ user });
  } else {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
});

// POST /api/auth/refresh - Renovar tokens
router.post('/refresh', refreshLimiter, (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refresh_token;

  if (!refreshToken) {
    res.status(401).json({ error: 'Refresh token não fornecido' });
    return;
  }

  try {
    const db = getDatabase(process.env.DATABASE_PATH || './data/patrimonio.db');
    const tokenData = db.validateRefreshToken(refreshToken);

    if (!tokenData) {
      res.status(401).json({ error: 'Refresh token inválido ou expirado' });
      return;
    }

    const user = db.getUserById(tokenData.userId);

    if (!user || !user.isApproved) {
      res.status(403).json({ error: 'Usuário não aprovado' });
      return;
    }

    // Revogar refresh token antigo
    db.revokeRefreshToken(refreshToken);

    // Gerar novos tokens (rotação)
    const newAccessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      name: user.name,
      isAdmin: user.isAdmin,
      isApproved: user.isApproved
    });

    const newRefreshToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    
    db.createRefreshToken(user.id, newRefreshToken, expiresAt);

    // Configurar novos cookies
    res.cookie('access_token', newAccessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 15 * 60 * 1000
    });

    res.cookie('refresh_token', newRefreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.isAdmin,
        isApproved: user.isApproved
      }
    });

  } catch (error) {
    console.error('Erro ao renovar tokens:', error);
    res.status(500).json({ error: 'Erro ao renovar tokens' });
  }
});

// POST /api/auth/logout - Logout (invalida refresh token atual)
router.post('/logout', (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refresh_token;

  if (refreshToken) {
    try {
      const db = getDatabase(process.env.DATABASE_PATH || './data/patrimonio.db');
      db.revokeRefreshToken(refreshToken);
    } catch (error) {
      console.error('Erro ao revogar token:', error);
    }
  }

  res.clearCookie('access_token', COOKIE_OPTIONS);
  res.clearCookie('refresh_token', COOKIE_OPTIONS);

  res.json({ message: 'Logout realizado com sucesso' });
});

// POST /api/auth/logout-all - Logout de todos os dispositivos
router.post('/logout-all', (req: Request, res: Response) => {
  const accessToken = req.cookies?.access_token;

  if (!accessToken) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }

  const user = verifyAccessToken(accessToken);

  if (!user) {
    res.status(401).json({ error: 'Token inválido' });
    return;
  }

  try {
    const db = getDatabase(process.env.DATABASE_PATH || './data/patrimonio.db');
    db.revokeAllUserTokens(user.id);

    res.clearCookie('access_token', COOKIE_OPTIONS);
    res.clearCookie('refresh_token', COOKIE_OPTIONS);

    res.json({ message: 'Logout de todos os dispositivos realizado com sucesso' });
  } catch (error) {
    console.error('Erro ao revogar todos os tokens:', error);
    res.status(500).json({ error: 'Erro ao realizar logout' });
  }
});

export default router;
