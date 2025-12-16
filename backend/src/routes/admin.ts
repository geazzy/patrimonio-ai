import { Router, Request, Response } from 'express';
import { getDatabase } from '../services/dbService.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { adminLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Aplicar middlewares de autenticação e admin em todas as rotas
router.use(requireAuth);
router.use(requireAdmin);
router.use(adminLimiter);

// GET /api/admin/pending-users - Listar usuários pendentes de aprovação
router.get('/pending-users', (req: Request, res: Response) => {
  try {
    const db = getDatabase(process.env.DATABASE_PATH || './data/patrimonio.db');
    const pendingUsers = db.listPendingUsers();

    res.json({ users: pendingUsers });
  } catch (error) {
    console.error('Erro ao listar usuários pendentes:', error);
    res.status(500).json({ error: 'Erro ao listar usuários pendentes' });
  }
});

// POST /api/admin/approve/:userId - Aprovar usuário
router.post('/approve/:userId', (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const db = getDatabase(process.env.DATABASE_PATH || './data/patrimonio.db');

    const user = db.getUserById(userId);

    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado' });
      return;
    }

    if (user.isApproved) {
      res.status(400).json({ error: 'Usuário já está aprovado' });
      return;
    }

    db.approveUser(userId);

    res.json({ 
      message: 'Usuário aprovado com sucesso',
      user: db.getUserById(userId)
    });
  } catch (error) {
    console.error('Erro ao aprovar usuário:', error);
    res.status(500).json({ error: 'Erro ao aprovar usuário' });
  }
});

// POST /api/admin/revoke/:userId - Revogar acesso de usuário
router.post('/revoke/:userId', (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const db = getDatabase(process.env.DATABASE_PATH || './data/patrimonio.db');

    const user = db.getUserById(userId);

    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado' });
      return;
    }

    // Não permitir revogar o próprio acesso
    if (req.user?.id === userId) {
      res.status(400).json({ error: 'Você não pode revogar seu próprio acesso' });
      return;
    }

    db.revokeUser(userId);

    res.json({ 
      message: 'Acesso do usuário revogado com sucesso',
      user: db.getUserById(userId)
    });
  } catch (error) {
    console.error('Erro ao revogar usuário:', error);
    res.status(500).json({ error: 'Erro ao revogar acesso do usuário' });
  }
});

// POST /api/admin/promote/:userId - Promover usuário a admin
router.post('/promote/:userId', (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const db = getDatabase(process.env.DATABASE_PATH || './data/patrimonio.db');

    const user = db.getUserById(userId);

    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado' });
      return;
    }

    if (!user.isApproved) {
      res.status(400).json({ error: 'Usuário precisa estar aprovado antes de ser promovido' });
      return;
    }

    if (user.isAdmin) {
      res.status(400).json({ error: 'Usuário já é administrador' });
      return;
    }

    db.promoteToAdmin(userId);

    res.json({ 
      message: 'Usuário promovido a administrador com sucesso',
      user: db.getUserById(userId)
    });
  } catch (error) {
    console.error('Erro ao promover usuário:', error);
    res.status(500).json({ error: 'Erro ao promover usuário' });
  }
});

export default router;
