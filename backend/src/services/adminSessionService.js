import crypto from 'node:crypto';

export class AdminSessionService {
  constructor() {
    this.tokens = new Set();
  }

  login(pin) {
    const expectedPin = process.env.ADMIN_PIN || '2468';
    if (String(pin) !== expectedPin) return null;
    const token = crypto.randomBytes(24).toString('hex');
    this.tokens.add(token);
    return token;
  }

  isValid(token) {
    return Boolean(token && this.tokens.has(token));
  }
}
