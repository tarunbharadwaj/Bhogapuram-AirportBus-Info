export const createRequireAdmin = (sessions) => (req, res, next) => {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!sessions.isValid(token)) return res.status(401).json({ error: 'Admin session expired.' });
  next();
};
