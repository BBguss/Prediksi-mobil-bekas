/**
 * authMiddleware.js — Verifikasi JWT token untuk route admin
 */
import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'cp_jwt_secret_2026_change_me';

export function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Tidak terautentikasi.' });
  }
  const token = auth.slice(7);
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token tidak valid atau kadaluarsa. Silakan login ulang.' });
  }
}
