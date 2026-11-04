import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

/*
 * Envío de correos.
 * - MAIL_DRIVER=smtp: se envía de verdad por SMTP (Gmail: smtp.gmail.com, puerto 465, con una «contraseña de aplicación»).
 * - MAIL_DRIVER=outbox (por omisión): cada correo se guarda como archivo en MAIL_OUTBOX_DIR para revisarlo en desarrollo.
 * En pruebas se guarda en memoria (sentMail).
 */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  /** Enlace principal: en el correo HTML se muestra como botón */
  action?: { label: string; url: string };
}

export const sentMail: MailMessage[] = [];

let transport: Transporter | null = null;
function smtp(): Transporter {
  transport ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  return transport;
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Versión HTML sencilla: el texto con saltos de línea y el enlace principal como botón. */
function html(m: MailMessage): string {
  const body = escape(m.text).replace(/\n/g, '<br>');
  const button = m.action
    ? `<p style="margin:24px 0"><a href="${escape(m.action.url)}" style="background:#1F5BDB;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${escape(m.action.label)}</a></p>`
    : '';
  return `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1B2A44;max-width:560px">${body}${button}<p style="color:#5A6A82;font-size:13px">Inmobiliaria Zugar · Homiz</p></div>`;
}

/** No lanza error: si el correo no sale, se registra (quien llama no debe revelar si la cuenta existe). */
export async function sendMail(message: MailMessage): Promise<void> {
  sentMail.push(message);
  if (sentMail.length > 50) sentMail.shift();
  if (env.isTest) return;
  if (env.MAIL_DRIVER === 'smtp') {
    try {
      await smtp().sendMail({ from: env.MAIL_FROM || `Inmobiliaria Zugar <${env.SMTP_USER}>`, to: message.to, subject: message.subject, text: message.text, html: html(message) });
      logger.info({ subject: message.subject }, 'Correo enviado');
    } catch (err) {
      logger.error({ err: (err as Error).message, subject: message.subject }, 'No se pudo enviar el correo (revisa SMTP_USER y SMTP_PASS)');
    }
    return;
  }
  const dir = path.resolve(env.MAIL_OUTBOX_DIR);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}.txt`);
  await writeFile(file, `Para: ${message.to}\nAsunto: ${message.subject}\n\n${message.text}\n`, 'utf8');
  logger.info({ file: path.basename(file) }, 'Correo de desarrollo guardado en la bandeja local (MAIL_DRIVER=outbox)');
}
