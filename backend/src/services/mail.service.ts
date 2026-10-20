import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

/*
 * Envío de correos. Aún no hay proveedor contratado: en desarrollo cada correo se guarda como archivo
 * en MAIL_OUTBOX_DIR y en pruebas se guarda en memoria. Para producción se agrega aquí el proveedor
 * (SMTP, SES, Resend, etc.) sin cambiar a quienes llaman a sendMail().
 */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export const sentMail: MailMessage[] = [];

export async function sendMail(message: MailMessage): Promise<void> {
  sentMail.push(message);
  if (sentMail.length > 50) sentMail.shift();
  if (env.isTest) return;
  if (env.isProduction) {
    // Sin proveedor configurado no se puede enviar: se registra el evento sin datos personales.
    logger.warn({ subject: message.subject }, 'Correo no enviado: falta configurar un proveedor de correo');
    return;
  }
  const dir = path.resolve(env.MAIL_OUTBOX_DIR);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}.txt`);
  await writeFile(file, `Para: ${message.to}\nAsunto: ${message.subject}\n\n${message.text}\n`, 'utf8');
  logger.info({ file: path.basename(file) }, 'Correo de desarrollo guardado en la bandeja local');
}
