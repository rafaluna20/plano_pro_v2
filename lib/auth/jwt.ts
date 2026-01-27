import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = '7d'; // 7 días

export interface JWTPayload {
  userId: string;
  email: string;
  apiKeyId?: string;
}

/**
 * Genera un token JWT para un usuario
 */
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
}

/**
 * Verifica y decodifica un token JWT
 */
export function verifyToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expirado');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Token inválido');
    }
    throw new Error('Error al verificar token');
  }
}

/**
 * Extrae el token del header Authorization
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) return null;
  
  // Soporta tanto "Bearer token" como solo "token"
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') {
    return parts[1];
  }
  return authHeader;
}
