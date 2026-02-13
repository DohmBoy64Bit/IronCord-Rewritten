import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { listGuildsHandler } from './list.js';
import { createGuildHandler } from './create.js';
import { listChannelsHandler, createChannelHandler } from './channels.js';

const router = Router();

router.get('/mine', authMiddleware, listGuildsHandler);
router.post('/', authMiddleware, createGuildHandler);
router.get('/:id/channels', authMiddleware, listChannelsHandler);
router.post('/:id/channels', authMiddleware, createChannelHandler);

export default router;
