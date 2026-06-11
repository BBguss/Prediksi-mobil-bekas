/**
 * auth.js — Login admin
 * POST /api/auth/login   → { token, username }
 * GET  /api/auth/me      → { username } (butuh token)
 */
import express from 'express';
import jwt from 'jsonwebtoken';
import { findAdminByUsername, updateAdminLastLogin, hashPassword } from '../db/database.js';
import { requireAdmin, JWT_SECRET } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi.' });
  }

  try {
    const admin = await findAdminByUsername(username.trim());
    if (!admin) {
      return res.status(401).json({ error: 'Username atau password salah.' });
    }

    const hash = hashPassword(password);
    if (hash !== admin.password_hash) {
      return res.status(401).json({ error: 'Username atau password salah.' });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    await updateAdminLastLogin(admin.id);

    res.json({ token, username: admin.username, message: 'Login berhasil.' });
  } catch (err) {
    console.error('[auth/login]', err.message);
    res.status(500).json({ error: 'Server error saat login.' });
  }
});

router.get('/me', requireAdmin, (req, res) => {
  res.json({ username: req.admin.username, id: req.admin.id });
});

export default router;
