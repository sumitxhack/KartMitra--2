import jwt from 'jsonwebtoken';
import config from '../config';

export class AuthService {
  /**
   * Generates a JWT token for the user session.
   */
  static generateToken(payload: { id: string; email: string; role: string }): string {
    return jwt.sign(payload, config.jwtSecret, { expiresIn: '24h' });
  }
}
