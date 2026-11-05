/**
 * Restablece la contraseña de un usuario (recuperación por administrador).
 *
 * No hay proveedor de correo configurado, así que el "¿Olvidaste tu contraseña?"
 * se resuelve entre personas: el usuario pide a un administrador y este corre:
 *
 *   npx tsx --env-file=.env scripts/reset-password.ts usuario@correo.com
 *
 * - La contraseña nueva se pide por teclado SIN mostrarse en pantalla (no va en
 *   argumentos ni queda en el historial de la terminal).
 * - Cumple las mismas reglas de fortaleza que el registro.
 * - Actúa sobre la base indicada por DATABASE_URL: revisa a cuál apunta tu .env
 *   antes de ejecutarlo (puede ser la de producción).
 * - Los tokens ya emitidos siguen valiendo hasta vencer (JWT sin estado); sirve
 *   para recuperar acceso, no para expulsar una sesión robada.
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword, validatePasswordStrength } from '../lib/auth/password';

function leerOculto(pregunta: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      reject(new Error('Hace falta una terminal interactiva para escribir la contraseña.'));
      return;
    }
    process.stdout.write(pregunta);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let texto = '';
    const alTecla = (ch: string) => {
      if (ch === '\u0003') {
        // Ctrl+C
        stdin.setRawMode(false);
        process.stdout.write('\n');
        process.exit(130);
      } else if (ch === '\r' || ch === '\n') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', alTecla);
        process.stdout.write('\n');
        resolve(texto);
      } else if (ch === '\u007f' || ch === '\b') {
        texto = texto.slice(0, -1);
      } else {
        texto += ch;
      }
    };
    stdin.on('data', alTecla);
  });
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error('Uso: npx tsx --env-file=.env scripts/reset-password.ts usuario@correo.com');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error(`No existe un usuario con el correo ${email}.`);
      process.exit(1);
    }

    const nueva = await leerOculto(`Nueva contraseña para ${email}: `);
    const repetida = await leerOculto('Repítela: ');
    if (nueva !== repetida) {
      console.error('Las contraseñas no coinciden. No se cambió nada.');
      process.exit(1);
    }

    const fuerza = validatePasswordStrength(nueva);
    if (!fuerza.valid) {
      console.error('Contraseña débil:\n- ' + fuerza.errors.join('\n- '));
      process.exit(1);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(nueva) },
    });
    console.log(`Listo: contraseña actualizada para ${email}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('Error:', e instanceof Error ? e.message : e);
  process.exit(1);
});
