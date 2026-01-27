import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

/**
 * Hash de una contraseña usando bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verifica si una contraseña coincide con su hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

/**
 * Valida la fortaleza de una contraseña
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('La contraseña debe tener al menos 8 caracteres');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Debe contener al menos una letra minúscula');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Debe contener al menos una letra mayúscula');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Debe contener al menos un número');
  }

  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push('Debe contener al menos un carácter especial');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
