import rateLimit from 'express-rate-limit';

// Rate limiter para login (muito restritivo)
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 tentativas por IP
  message: {
    error: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true, // Retorna info de rate limit em headers
  legacyHeaders: false,
  skip: (req) => {
    // Skip para admin (localhost) em desenvolvimento
    return process.env.NODE_ENV === 'development' && req.ip === '::1';
  },
});

// Rate limiter para refresh token (moderado)
export const refreshLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 10, // máximo 10 tentativas por IP
  message: {
    error: 'Muitas solicitações de renovação. Tente novamente em 5 minutos.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter global para API (geral)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requisições por IP
  message: {
    error: 'Muitas requisições. Tente novamente mais tarde.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter para admin (más restritivo que login)
export const adminLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 20, // máximo 20 operações por IP
  message: {
    error: 'Muitas operações de admin. Tente novamente em 10 minutos.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
