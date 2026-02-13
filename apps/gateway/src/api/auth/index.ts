import { Router } from 'express';
import { registerHandler } from './register.js';
import { loginHandler } from './login.js';

const router = Router();

router.post('/register', registerHandler);
router.post('/login', loginHandler);

export default router;
