import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { listGuildsHandler, updateGuildHandler, createGuildHandler, discoveryHandler, joinGuildHandler } from './list.js';
import { listChannelsHandler, createChannelHandler, updateChannelHandler, deleteChannelHandler } from './channels.js';

const router = Router();

router.get('/mine', authMiddleware, listGuildsHandler);
router.post('/', authMiddleware, createGuildHandler);
router.patch('/:id', authMiddleware, updateGuildHandler);
router.get('/discovery', authMiddleware, discoveryHandler);
router.post('/:id/join', authMiddleware, joinGuildHandler);
router.get('/:id/channels', authMiddleware, listChannelsHandler);
router.post('/:id/channels', authMiddleware, createChannelHandler);
router.patch('/:id/channels/:channelId', authMiddleware, updateChannelHandler);
router.delete('/:id/channels/:channelId', authMiddleware, deleteChannelHandler);

export default router;
