import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface EmailProvider {
  send(to: string, subject: string, html: string): Promise<boolean>;
}

@Injectable()
export class EmailService implements EmailProvider {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter;
  private readonly fromAddress: string;
  private readonly fromName: string;

  constructor(private readonly configService: ConfigService) {
    this.fromAddress = this.configService.get<string>(
      'MAIL_FROM',
      'noreply@dperfumehouse.com',
    );
    this.fromName = this.configService.get<string>(
      'MAIL_FROM_NAME',
      'D Perfume House',
    );

    const host = this.configService.get<string>('MAIL_HOST');
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: parseInt(
          this.configService.get<string>('MAIL_PORT', '587'),
          10,
        ),
        secure: this.configService.get<string>('MAIL_SECURE', 'false') === 'true',
        auth: {
          user: this.configService.get<string>('MAIL_USER', ''),
          pass: this.configService.get<string>('MAIL_PASS', ''),
        },
      });
      this.logger.log('Email service initialized with Nodemailer');
    } else {
      // Dev mode: log emails instead of sending
      this.transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
      this.logger.warn(
        'MAIL_HOST not configured - emails will be logged to console instead of sent',
      );
    }
  }

  async send(to: string, subject: string, html: string): Promise<boolean> {
    try {
      const info = await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromAddress}>`,
        to,
        subject,
        html,
      });

      this.logger.log(`Email sent to ${to}: ${info.messageId}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${to}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  async sendPaymentLink(
    customerEmail: string,
    customerName: string,
    orderNumber: string,
    paymentUrl: string,
    total: number,
  ): Promise<boolean> {
    const subject = `Link de pago para tu pedido ${orderNumber} - D Perfume House`;
    const logoUrl = 'https://pos.dperfumehouse.com/icons/logo-email.png';
    const formattedTotal = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(total);
    const html = `
      <!DOCTYPE html>
      <html xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="light only">
        <meta name="supported-color-schemes" content="light only">
        <style>
          :root { color-scheme: light only; }
          body { margin: 0; padding: 0; font-family: 'Outfit', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f0b05 !important; }
          [data-ogsc] .wrapper, [data-ogsc] .header, [data-ogsc] .content, [data-ogsc] .footer { background-color: #16110a !important; }
          [data-ogsc] .title { color: #fff7eb !important; }
          [data-ogsc] .message { color: #d6c3a8 !important; }
        </style>
      </head>
      <body style="margin:0;padding:0;background-color:#0f0b05;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#0f0b05;">
          <tr><td align="center" style="padding:24px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="620" style="max-width:620px;width:100%;background-color:#16110a;">
              <!-- Header -->
              <tr><td align="center" style="padding:30px 32px 20px;background-color:#16110a;">
                <img src="${logoUrl}" alt="D Perfume House" width="320" style="display:block;width:320px;max-width:80%;height:auto;" />
                <p style="margin:12px 0 0 0;color:#bfa685;letter-spacing:2px;font-size:11px;text-transform:uppercase;">Tienda en línea</p>
              </td></tr>
              <!-- Content -->
              <tr><td style="padding:28px 32px 14px;color:#f4ece1;background-color:#16110a;">
                <span style="display:inline-block;margin-bottom:14px;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#ffdca7;border:1px solid #7a5b2f;background-color:rgba(196,148,77,.14);">Pago pendiente</span>
                <p style="margin:0 0 12px 0;font-size:25px;line-height:1.2;color:#fff7eb;font-weight:700;">Hola ${this.escapeHtml(customerName)}</p>
                <p style="margin:0 0 10px 0;font-size:15px;color:#d6c3a8;">
                  Gracias por tu pedido <strong style="color:#fff7eb;">${this.escapeHtml(orderNumber)}</strong> en D Perfume House.
                </p>
                <!-- Amount card -->
                <div style="margin:22px 0;border:1px solid #3b2c17;border-radius:12px;background-color:#1e160d;padding:20px;text-align:center;">
                  <p style="margin:0 0 6px 0;color:#9c8568;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Total a pagar</p>
                  <p style="margin:0;font-size:32px;font-weight:800;color:#e94560;letter-spacing:1px;">${formattedTotal}</p>
                </div>
                <p style="margin:0 0 20px 0;font-size:15px;color:#d6c3a8;">
                  Haz clic en el botón para completar tu pago de forma segura:
                </p>
                <!-- CTA Button -->
                <div style="text-align:center;margin:0 0 24px 0;">
                  <a href="${this.escapeHtml(paymentUrl)}" style="display:inline-block;background-color:#e94560;color:#ffffff;padding:16px 40px;text-decoration:none;border-radius:999px;font-weight:700;font-size:16px;letter-spacing:.5px;">Pagar ahora</a>
                </div>
                <p style="margin:0 0 10px 0;font-size:13px;color:#9c8568;">
                  Si el botón no funciona, copia y pega este enlace en tu navegador:
                </p>
                <p style="margin:0 0 20px 0;word-break:break-all;font-size:12px;color:#7a5b2f;">${this.escapeHtml(paymentUrl)}</p>
                <div style="border-top:1px solid #3b2c17;padding-top:16px;margin-top:10px;">
                  <p style="margin:0;font-size:13px;color:#9c8568;">
                    Si tienes alguna pregunta sobre tu pedido, no dudes en contactarnos.
                  </p>
                </div>
              </td></tr>
              <!-- Footer -->
              <tr><td style="padding:18px 32px 24px;color:#9c8568;font-size:12px;text-align:center;background-color:#16110a;">
                <p style="margin:4px 0;"><strong>D Perfume House</strong></p>
                <p style="margin:4px 0;">&copy; ${new Date().getFullYear()} Todos los derechos reservados.</p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `;

    return this.send(customerEmail, subject, html);
  }

  async sendOrderConfirmation(
    customerEmail: string,
    customerName: string,
    orderNumber: string,
  ): Promise<boolean> {
    const subject = `Order ${orderNumber} confirmed!`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
          .header { background-color: #1a1a2e; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .success { color: #27ae60; font-size: 18px; font-weight: bold; }
          .footer { background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>D Perfume House</h1>
        </div>
        <div class="content">
          <p>Hello ${this.escapeHtml(customerName)},</p>
          <p class="success">Your payment has been received and your order is confirmed!</p>
          <p>Order number: <strong>${this.escapeHtml(orderNumber)}</strong></p>
          <p>We are now preparing your order for shipment. You will receive another email with tracking information once your order has been shipped.</p>
          <p>Thank you for shopping with us!</p>
          <p>Best regards,<br>D Perfume House Team</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} D Perfume House. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    return this.send(customerEmail, subject, html);
  }

  async sendCommissionNotification(
    sellerEmail: string,
    sellerName: string,
    amount: number,
    orderNumber: string,
  ): Promise<boolean> {
    const subject = `Commission earned on order ${orderNumber}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
          .header { background-color: #1a1a2e; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .amount { font-size: 24px; font-weight: bold; color: #27ae60; }
          .footer { background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>D Perfume House</h1>
        </div>
        <div class="content">
          <p>Hello ${this.escapeHtml(sellerName)},</p>
          <p>Great news! You have earned a commission on order <strong>${this.escapeHtml(orderNumber)}</strong>.</p>
          <p>Commission amount:</p>
          <p class="amount">$${amount.toFixed(2)}</p>
          <p>This commission is pending approval and will be included in your next payout.</p>
          <p>Keep up the great work!</p>
          <p>Best regards,<br>D Perfume House Team</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} D Perfume House. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    return this.send(sellerEmail, subject, html);
  }

  async sendWelcomeEmail(
    email: string,
    name: string,
    inviterName: string,
    setPasswordUrl: string,
  ): Promise<boolean> {
    const subject = '¡Bienvenido a D Perfume House! Configura tu cuenta';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1a1a2e; background-color: #f0f0f5; }
          .wrapper { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
          .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); color: white; padding: 40px 30px; text-align: center; }
          .header h1 { margin: 0 0 4px 0; font-size: 28px; font-weight: 700; letter-spacing: 1px; }
          .header p { margin: 0; font-size: 13px; color: rgba(255,255,255,0.7); letter-spacing: 2px; text-transform: uppercase; }
          .welcome-badge { display: inline-block; background: rgba(233, 69, 96, 0.15); border: 1px solid rgba(233, 69, 96, 0.3); color: #e94560; padding: 6px 18px; border-radius: 50px; font-size: 12px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 20px; }
          .content { padding: 40px 30px; }
          .greeting { font-size: 22px; font-weight: 700; color: #1a1a2e; margin: 0 0 20px 0; }
          .message { font-size: 15px; color: #555; margin: 0 0 12px 0; }
          .highlight { color: #1a1a2e; font-weight: 600; }
          .cta-section { text-align: center; margin: 32px 0; padding: 28px; background: linear-gradient(135deg, #f8f9ff 0%, #f0f0f5 100%); border-radius: 12px; }
          .cta-section p { font-size: 14px; color: #666; margin: 0 0 20px 0; }
          .btn { display: inline-block; background: linear-gradient(135deg, #e94560 0%, #c23152 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; letter-spacing: 0.5px; box-shadow: 0 4px 15px rgba(233, 69, 96, 0.3); }
          .expiry-note { display: inline-block; margin-top: 16px; font-size: 12px; color: #999; }
          .steps { margin: 28px 0; padding: 0; }
          .step { display: flex; align-items: flex-start; margin-bottom: 16px; }
          .step-number { flex-shrink: 0; width: 28px; height: 28px; background: linear-gradient(135deg, #e94560, #c23152); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; margin-right: 14px; margin-top: 2px; }
          .step-text { font-size: 14px; color: #555; }
          .divider { border: none; border-top: 1px solid #eee; margin: 28px 0; }
          .footer { background-color: #1a1a2e; color: rgba(255,255,255,0.6); padding: 24px 30px; text-align: center; font-size: 12px; }
          .footer p { margin: 4px 0; }
          .footer a { color: rgba(255,255,255,0.6); text-decoration: none; }
          .fallback-link { word-break: break-all; font-size: 11px; color: #999; margin-top: 8px; }
          @media only screen and (max-width: 480px) {
            .content { padding: 24px 20px; }
            .header { padding: 30px 20px; }
            .cta-section { padding: 20px; }
            .btn { padding: 14px 32px; font-size: 14px; }
          }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="header">
            <h1>D Perfume House</h1>
            <p>Tu plataforma de ventas</p>
          </div>
          <div class="content">
            <div style="text-align: center;">
              <span class="welcome-badge">Nuevo vendedor</span>
            </div>
            <p class="greeting">¡Hola ${this.escapeHtml(name)}!</p>
            <p class="message">
              <span class="highlight">${this.escapeHtml(inviterName)}</span> te ha invitado a unirte al equipo de ventas de
              <span class="highlight">D Perfume House</span>. Ya tienes una cuenta lista, solo necesitas crear tu contraseña para comenzar.
            </p>

            <div class="steps">
              <div class="step">
                <div class="step-number">1</div>
                <div class="step-text">Haz clic en el botón de abajo para crear tu contraseña</div>
              </div>
              <div class="step">
                <div class="step-number">2</div>
                <div class="step-text">Inicia sesión con tu email y nueva contraseña</div>
              </div>
              <div class="step">
                <div class="step-number">3</div>
                <div class="step-text">¡Comienza a vender y ganar comisiones!</div>
              </div>
            </div>

            <div class="cta-section">
              <p>Configura tu contraseña para activar tu cuenta</p>
              <a href="${this.escapeHtml(setPasswordUrl)}" class="btn" style="color: #ffffff;">Crear Mi Contraseña</a>
              <br>
              <span class="expiry-note">Este enlace expira en 72 horas</span>
            </div>

            <hr class="divider">

            <p class="message">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
            <p class="fallback-link">${this.escapeHtml(setPasswordUrl)}</p>

            <hr class="divider">

            <p class="message" style="color: #999; font-size: 13px;">
              Si no esperabas este correo, puedes ignorarlo. No se realizará ningún cambio en tu cuenta.
            </p>
          </div>
          <div class="footer">
            <p><strong>D Perfume House</strong></p>
            <p>&copy; ${new Date().getFullYear()} Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.send(email, subject, html);
  }

  async sendRegistrationRequestReceived(
    email: string,
    name: string,
  ): Promise<boolean> {
    const subject = 'Solicitud de registro recibida - D Perfume House';
    const logoUrl = 'https://pos.dperfumehouse.com/icons/logo-email.png';
    const html = `
      <!DOCTYPE html>
      <html xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="light only">
        <meta name="supported-color-schemes" content="light only">
        <style>
          :root { color-scheme: light only; }
          body { margin: 0; padding: 0; font-family: 'Outfit', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f0b05 !important; }
          .shell { width: 100%; padding: 24px 0; background-color: #0f0b05 !important; }
          .wrapper { max-width: 620px; margin: 0 auto; background-color: #16110a !important; border-radius: 0; overflow: hidden; }
          .header { padding: 30px 32px 20px; text-align: center; background-color: #16110a !important; }
          .logo { display: block; width: 320px; max-width: 80%; height: auto; margin: 0 auto; }
          .subtitle { margin: 12px 0 0 0; color: #bfa685 !important; letter-spacing: 2px; font-size: 11px; text-transform: uppercase; }
          .content { padding: 28px 32px 14px; color: #f4ece1 !important; background-color: #16110a !important; }
          .badge { display: inline-block; margin-bottom: 14px; padding: 6px 14px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: .7px; text-transform: uppercase; color: #ffdca7 !important; border: 1px solid #7a5b2f; background-color: rgba(196, 148, 77, .14) !important; }
          .title { margin: 0 0 12px 0; font-size: 25px; line-height: 1.2; color: #fff7eb !important; font-weight: 700; }
          .message { margin: 0 0 10px 0; font-size: 15px; color: #d6c3a8 !important; }
          .card { margin: 22px 0; border: 1px solid #3b2c17; border-radius: 12px; background-color: #1e160d !important; padding: 14px 16px; }
          .card p { margin: 0; color: #e7d6be !important; font-size: 14px; }
          .list { margin: 14px 0 0; padding-left: 18px; }
          .list li { margin-bottom: 8px; color: #ccb393 !important; font-size: 14px; }
          .footer { margin-top: 14px; padding: 18px 32px 24px; color: #9c8568 !important; font-size: 12px; text-align: center; background-color: #16110a !important; }
          .footer p { margin: 4px 0; }
          [data-ogsc] .wrapper, [data-ogsc] .header, [data-ogsc] .content, [data-ogsc] .footer { background-color: #16110a !important; }
          [data-ogsc] .title, [data-ogsc] .card p { color: #fff7eb !important; }
          [data-ogsc] .message, [data-ogsc] .list li { color: #d6c3a8 !important; }
          [data-ogsc] .subtitle { color: #bfa685 !important; }
          [data-ogsc] .footer { color: #9c8568 !important; }
        </style>
      </head>
      <body style="margin:0;padding:0;background-color:#0f0b05;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#0f0b05;">
          <tr><td align="center" style="padding:24px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="620" style="max-width:620px;width:100%;background-color:#16110a;">
              <tr><td align="center" style="padding:30px 32px 20px;background-color:#16110a;">
                <img src="${logoUrl}" alt="D Perfume House" width="320" style="display:block;width:320px;max-width:80%;height:auto;" />
                <p style="margin:12px 0 0 0;color:#bfa685;letter-spacing:2px;font-size:11px;text-transform:uppercase;">Panel de administración</p>
              </td></tr>
              <tr><td style="padding:28px 32px 14px;color:#f4ece1;background-color:#16110a;">
                <span class="badge" style="display:inline-block;margin-bottom:14px;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#ffdca7;border:1px solid #7a5b2f;background-color:rgba(196,148,77,.14);">Solicitud en revisión</span>
                <p style="margin:0 0 12px 0;font-size:25px;line-height:1.2;color:#fff7eb;font-weight:700;">Hola ${this.escapeHtml(name)}, recibimos tu solicitud</p>
                <p style="margin:0 0 10px 0;font-size:15px;color:#d6c3a8;">
                  Tu registro en <strong>D Perfume House</strong> fue enviado correctamente y está pendiente de aprobación.
                </p>
                <div style="margin:22px 0;border:1px solid #3b2c17;border-radius:12px;background-color:#1e160d;padding:14px 16px;">
                  <p style="margin:0;color:#e7d6be;font-size:14px;">Próximos pasos:</p>
                  <ul style="margin:14px 0 0;padding-left:18px;">
                    <li style="margin-bottom:8px;color:#ccb393;font-size:14px;">Revisaremos tu solicitud en el menor tiempo posible.</li>
                    <li style="margin-bottom:8px;color:#ccb393;font-size:14px;">Cuando tu cuenta sea aprobada, recibirás otro correo de bienvenida.</li>
                    <li style="margin-bottom:8px;color:#ccb393;font-size:14px;">Desde ahí podrás iniciar sesión y comenzar a gestionar ventas.</li>
                  </ul>
                </div>
                <p style="margin:0 0 10px 0;font-size:15px;color:#d6c3a8;">
                  Gracias por confiar en nosotros.
                </p>
              </td></tr>
              <tr><td style="padding:18px 32px 24px;color:#9c8568;font-size:12px;text-align:center;background-color:#16110a;">
                <p style="margin:4px 0;"><strong>D Perfume House</strong></p>
                <p style="margin:4px 0;">&copy; ${new Date().getFullYear()} Todos los derechos reservados.</p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `;

    return this.send(email, subject, html);
  }

  async sendRegistrationApprovedWelcome(
    email: string,
    name: string,
    loginUrl: string,
  ): Promise<boolean> {
    const subject = '¡Tu cuenta fue aprobada! - D Perfume House';
    const logoUrl = 'https://pos.dperfumehouse.com/icons/logo-email.png';
    const html = `
      <!DOCTYPE html>
      <html xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="light only">
        <meta name="supported-color-schemes" content="light only">
        <style>
          :root { color-scheme: light only; }
          body { margin: 0; padding: 0; font-family: 'Outfit', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f0b05 !important; }
          .shell { width: 100%; padding: 24px 0; background-color: #0f0b05 !important; }
          .wrapper { max-width: 620px; margin: 0 auto; background-color: #16110a !important; border-radius: 0; overflow: hidden; }
          .header { padding: 30px 32px 20px; text-align: center; background-color: #16110a !important; }
          .logo { display: block; width: 320px; max-width: 80%; height: auto; margin: 0 auto; }
          .subtitle { margin: 12px 0 0 0; color: #bfa685 !important; letter-spacing: 2px; font-size: 11px; text-transform: uppercase; }
          .content { padding: 28px 32px 14px; color: #f4ece1 !important; background-color: #16110a !important; }
          .badge { display: inline-block; margin-bottom: 14px; padding: 6px 14px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: .7px; text-transform: uppercase; color: #bff6d5 !important; border: 1px solid #2f6b4b; background-color: rgba(47, 107, 75, .20) !important; }
          .title { margin: 0 0 12px 0; font-size: 25px; line-height: 1.2; color: #fff7eb !important; font-weight: 700; }
          .message { margin: 0 0 10px 0; font-size: 15px; color: #d6c3a8 !important; }
          .cta-wrap { text-align: center; margin: 24px 0 16px; }
          .btn { display: inline-block; background: linear-gradient(135deg, #d3a86f 0%, #b8843f 100%); color: #1b1208 !important; text-decoration: none; padding: 14px 34px; border-radius: 10px; font-size: 15px; font-weight: 800; letter-spacing: .3px; }
          .fallback { font-size: 12px; color: #8f7b62 !important; word-break: break-all; margin-top: 12px; }
          .footer { margin-top: 14px; padding: 18px 32px 24px; color: #9c8568 !important; font-size: 12px; text-align: center; background-color: #16110a !important; }
          .footer p { margin: 4px 0; }
          [data-ogsc] .wrapper, [data-ogsc] .header, [data-ogsc] .content, [data-ogsc] .footer { background-color: #16110a !important; }
          [data-ogsc] .title, [data-ogsc] .card p { color: #fff7eb !important; }
          [data-ogsc] .message, [data-ogsc] .list li { color: #d6c3a8 !important; }
          [data-ogsc] .subtitle, [data-ogsc] .fallback { color: #bfa685 !important; }
          [data-ogsc] .footer { color: #9c8568 !important; }
        </style>
      </head>
      <body style="margin:0;padding:0;background-color:#0f0b05;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#0f0b05;">
          <tr><td align="center" style="padding:24px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="620" style="max-width:620px;width:100%;background-color:#16110a;">
              <tr><td align="center" style="padding:30px 32px 20px;background-color:#16110a;">
                <img src="${logoUrl}" alt="D Perfume House" width="320" style="display:block;width:320px;max-width:80%;height:auto;" />
                <p style="margin:12px 0 0 0;color:#bfa685;letter-spacing:2px;font-size:11px;text-transform:uppercase;">Panel de administración</p>
              </td></tr>
              <tr><td style="padding:28px 32px 14px;color:#f4ece1;background-color:#16110a;">
                <span style="display:inline-block;margin-bottom:14px;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#bff6d5;border:1px solid #2f6b4b;background-color:rgba(47,107,75,.20);">Cuenta aprobada</span>
                <p style="margin:0 0 12px 0;font-size:25px;line-height:1.2;color:#fff7eb;font-weight:700;">¡Bienvenido, ${this.escapeHtml(name)}!</p>
                <p style="margin:0 0 10px 0;font-size:15px;color:#d6c3a8;">
                  Tu cuenta ya fue aprobada. Ya puedes ingresar a la plataforma y comenzar a gestionar tus ventas y comisiones.
                </p>
                <div style="text-align:center;margin:24px 0 16px;">
                  <a href="${this.escapeHtml(loginUrl)}" style="display:inline-block;background:linear-gradient(135deg,#d3a86f 0%,#b8843f 100%);color:#1b1208;text-decoration:none;padding:14px 34px;border-radius:10px;font-size:15px;font-weight:800;letter-spacing:.3px;">Iniciar sesión</a>
                  <p style="font-size:12px;color:#8f7b62;word-break:break-all;margin-top:12px;">${this.escapeHtml(loginUrl)}</p>
                </div>
                <p style="margin:0 0 10px 0;font-size:15px;color:#d6c3a8;">
                  Si tienes dudas, responde este correo y te ayudamos.
                </p>
              </td></tr>
              <tr><td style="padding:18px 32px 24px;color:#9c8568;font-size:12px;text-align:center;background-color:#16110a;">
                <p style="margin:4px 0;"><strong>D Perfume House</strong></p>
                <p style="margin:4px 0;">&copy; ${new Date().getFullYear()} Todos los derechos reservados.</p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `;

    return this.send(email, subject, html);
  }

  async sendQuestionnaire(
    customerEmail: string,
    customerName: string,
    questionnaireUrl: string,
  ): Promise<boolean> {
    const subject = 'Descubre tu perfume ideal - D Perfume House';
    const logoUrl = 'https://pos.dperfumehouse.com/icons/logo-email.png';
    const firstName = customerName.split(' ')[0];
    const html = `
      <!DOCTYPE html>
      <html xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="light only">
        <meta name="supported-color-schemes" content="light only">
        <style>
          :root { color-scheme: light only; }
          body { margin: 0; padding: 0; font-family: 'Outfit', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f0b05 !important; }
          [data-ogsc] .wrapper, [data-ogsc] .header, [data-ogsc] .content, [data-ogsc] .footer { background-color: #16110a !important; }
          [data-ogsc] .title { color: #fff7eb !important; }
          [data-ogsc] .message { color: #d6c3a8 !important; }
        </style>
      </head>
      <body style="margin:0;padding:0;background-color:#0f0b05;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#0f0b05;">
          <tr><td align="center" style="padding:24px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="620" style="max-width:620px;width:100%;background-color:#16110a;">
              <!-- Header -->
              <tr><td align="center" style="padding:30px 32px 20px;background-color:#16110a;">
                <img src="${logoUrl}" alt="D Perfume House" width="320" style="display:block;width:320px;max-width:80%;height:auto;" />
                <p style="margin:12px 0 0 0;color:#bfa685;letter-spacing:2px;font-size:11px;text-transform:uppercase;">Cuestionario de fragancias</p>
              </td></tr>
              <!-- Content -->
              <tr><td style="padding:28px 32px 14px;color:#f4ece1;background-color:#16110a;">
                <span style="display:inline-block;margin-bottom:14px;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#ffdca7;border:1px solid #7a5b2f;background-color:rgba(196,148,77,.14);">✨ Personalizado para ti</span>
                <p style="margin:0 0 12px 0;font-size:25px;line-height:1.2;color:#fff7eb;font-weight:700;">Hola ${this.escapeHtml(firstName)} 🌿</p>
                <p style="margin:0 0 10px 0;font-size:15px;color:#d6c3a8;">
                  En <strong style="color:#fff7eb;">D Perfume House</strong> queremos ayudarte a encontrar tu fragancia ideal.
                </p>
                <p style="margin:0 0 20px 0;font-size:15px;color:#d6c3a8;">
                  Preparamos un cuestionario rápido y divertido para conocer tus gustos y recomendarte los perfumes perfectos para ti.
                </p>
                <!-- CTA Button -->
                <div style="text-align:center;margin:0 0 24px 0;">
                  <a href="${this.escapeHtml(questionnaireUrl)}" style="display:inline-block;background:linear-gradient(135deg,#d3a86f 0%,#b8843f 100%);color:#1b1208;padding:16px 40px;text-decoration:none;border-radius:999px;font-weight:700;font-size:16px;letter-spacing:.5px;">Completar Cuestionario</a>
                </div>
                <p style="margin:0 0 10px 0;font-size:13px;color:#9c8568;">
                  Solo toma 2 minutos y recibirás recomendaciones personalizadas al instante.
                </p>
                <p style="margin:0 0 20px 0;word-break:break-all;font-size:12px;color:#7a5b2f;">${this.escapeHtml(questionnaireUrl)}</p>
                <div style="border-top:1px solid #3b2c17;padding-top:16px;margin-top:10px;">
                  <p style="margin:0;font-size:13px;color:#9c8568;">
                    Si tienes alguna pregunta, no dudes en responder este correo.
                  </p>
                </div>
              </td></tr>
              <!-- Footer -->
              <tr><td style="padding:18px 32px 24px;color:#9c8568;font-size:12px;text-align:center;background-color:#16110a;">
                <p style="margin:4px 0;"><strong>D Perfume House</strong></p>
                <p style="margin:4px 0;">&copy; ${new Date().getFullYear()} Todos los derechos reservados.</p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `;

    return this.send(customerEmail, subject, html);
  }

  async sendShippingNotification(
    customerEmail: string,
    customerName: string,
    orderNumber: string,
    trackingNumber: string,
    trackUrl: string,
    carrier: string,
  ): Promise<boolean> {
    const subject = `Tu pedido ${orderNumber} está en camino 🚚 - D Perfume House`;
    const logoUrl = 'https://pos.dperfumehouse.com/icons/logo-email.png';
    const html = `
      <!DOCTYPE html>
      <html xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="light only">
        <meta name="supported-color-schemes" content="light only">
        <style>
          :root { color-scheme: light only; }
          body { margin:0; padding:0; font-family: 'Outfit','Segoe UI',Tahoma,Geneva,Verdana,sans-serif; background-color:#0f0b05 !important; }
        </style>
      </head>
      <body style="margin:0;padding:0;background-color:#0f0b05;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#0f0b05;">
          <tr><td align="center" style="padding:24px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="620" style="max-width:620px;width:100%;background-color:#16110a;">
              <!-- Header -->
              <tr><td align="center" style="padding:30px 32px 20px;background-color:#16110a;">
                <img src="${logoUrl}" alt="D Perfume House" width="320" style="display:block;width:320px;max-width:80%;height:auto;" />
                <p style="margin:12px 0 0 0;color:#bfa685;letter-spacing:2px;font-size:11px;text-transform:uppercase;">Tienda en línea</p>
              </td></tr>
              <!-- Content -->
              <tr><td style="padding:28px 32px 14px;color:#f4ece1;background-color:#16110a;">
                <span style="display:inline-block;margin-bottom:14px;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#a8e6cf;border:1px solid #2d7a5a;background-color:rgba(46,160,100,.14);">📦 Pedido enviado</span>
                <p style="margin:0 0 12px 0;font-size:25px;line-height:1.2;color:#fff7eb;font-weight:700;">¡Hola ${this.escapeHtml(customerName)}!</p>
                <p style="margin:0 0 10px 0;font-size:15px;color:#d6c3a8;">
                  Tu pedido <strong style="color:#fff7eb;">${this.escapeHtml(orderNumber)}</strong> ya está en camino. 
                  <strong style="color:#fff7eb;">${this.escapeHtml(carrier)}</strong> está transportando tu fragancia.
                </p>
                <!-- Tracking card -->
                <div style="margin:22px 0;border:1px solid #2d7a5a;border-radius:12px;background-color:#0e1e16;padding:20px;">
                  <p style="margin:0 0 6px 0;color:#9c8568;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Número de guía</p>
                  <p style="margin:0 0 16px 0;font-size:22px;font-weight:800;color:#a8e6cf;letter-spacing:2px;">${this.escapeHtml(trackingNumber)}</p>
                  <p style="margin:0 0 6px 0;color:#9c8568;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Transportadora</p>
                  <p style="margin:0 0 0 0;font-size:15px;font-weight:600;color:#f4ece1;">${this.escapeHtml(carrier)}</p>
                </div>
                <!-- CTA -->
                <div style="text-align:center;margin:0 0 24px 0;">
                  <a href="${this.escapeHtml(trackUrl)}" style="display:inline-block;background-color:#2e9e64;color:#ffffff;padding:16px 40px;text-decoration:none;border-radius:999px;font-weight:700;font-size:16px;letter-spacing:.5px;">Rastrear mi pedido</a>
                </div>
                <p style="margin:0 0 10px 0;font-size:13px;color:#9c8568;">
                  Si el botón no funciona, copia y pega este enlace:
                </p>
                <p style="margin:0 0 20px 0;word-break:break-all;font-size:12px;color:#7a5b2f;">${this.escapeHtml(trackUrl)}</p>
                <div style="border-top:1px solid #3b2c17;padding-top:16px;margin-top:10px;">
                  <p style="margin:0;font-size:13px;color:#9c8568;">
                    Pronto recibirás tu fragancia. ¡Gracias por confiar en D Perfume House!
                  </p>
                </div>
              </td></tr>
              <!-- Footer -->
              <tr><td style="padding:18px 32px 24px;color:#9c8568;font-size:12px;text-align:center;background-color:#16110a;">
                <p style="margin:4px 0;"><strong>D Perfume House</strong></p>
                <p style="margin:4px 0;">&copy; ${new Date().getFullYear()} Todos los derechos reservados.</p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `;

    return this.send(customerEmail, subject, html);
  }

  async sendDeliveredNotification(
    customerEmail: string,
    customerName: string,
    orderNumber: string,
  ): Promise<boolean> {
    const subject = `Tu pedido ${orderNumber} fue entregado ✅ - D Perfume House`;
    const logoUrl = 'https://pos.dperfumehouse.com/icons/logo-email.png';
    const html = `
      <!DOCTYPE html>
      <html xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="light only">
        <meta name="supported-color-schemes" content="light only">
        <style>
          :root { color-scheme: light only; }
          body { margin:0; padding:0; font-family: 'Outfit','Segoe UI',Tahoma,Geneva,Verdana,sans-serif; background-color:#0f0b05 !important; }
        </style>
      </head>
      <body style="margin:0;padding:0;background-color:#0f0b05;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#0f0b05;">
          <tr><td align="center" style="padding:24px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="620" style="max-width:620px;width:100%;background-color:#16110a;">
              <!-- Header -->
              <tr><td align="center" style="padding:30px 32px 20px;background-color:#16110a;">
                <img src="${logoUrl}" alt="D Perfume House" width="320" style="display:block;width:320px;max-width:80%;height:auto;" />
                <p style="margin:12px 0 0 0;color:#bfa685;letter-spacing:2px;font-size:11px;text-transform:uppercase;">Tienda en línea</p>
              </td></tr>
              <!-- Content -->
              <tr><td style="padding:28px 32px 14px;color:#f4ece1;background-color:#16110a;">
                <span style="display:inline-block;margin-bottom:14px;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#ffd700;border:1px solid #7a6500;background-color:rgba(255,215,0,.10);">✅ Pedido entregado</span>
                <p style="margin:0 0 12px 0;font-size:25px;line-height:1.2;color:#fff7eb;font-weight:700;">¡Tu fragancia llegó, ${this.escapeHtml(customerName)}!</p>
                <p style="margin:0 0 10px 0;font-size:15px;color:#d6c3a8;">
                  Tu pedido <strong style="color:#fff7eb;">${this.escapeHtml(orderNumber)}</strong> fue entregado exitosamente. 
                  Esperamos que disfrutes tu nueva fragancia.
                </p>
                <!-- Delivered icon card -->
                <div style="margin:22px 0;border:1px solid #7a6500;border-radius:12px;background-color:#1a1500;padding:28px;text-align:center;">
                  <p style="margin:0 0 8px 0;font-size:48px;">🎁</p>
                  <p style="margin:0;font-size:17px;font-weight:700;color:#ffd700;">¡Bienvenida a casa, fragancia!</p>
                  <p style="margin:8px 0 0 0;font-size:14px;color:#9c8568;">Pedido <strong>${this.escapeHtml(orderNumber)}</strong> entregado</p>
                </div>
                <div style="border-top:1px solid #3b2c17;padding-top:16px;margin-top:10px;">
                  <p style="margin:0;font-size:13px;color:#9c8568;">
                    Si tienes alguna duda sobre tu pedido, escríbenos. ¡Gracias por elegir D Perfume House!
                  </p>
                </div>
              </td></tr>
              <!-- Footer -->
              <tr><td style="padding:18px 32px 24px;color:#9c8568;font-size:12px;text-align:center;background-color:#16110a;">
                <p style="margin:4px 0;"><strong>D Perfume House</strong></p>
                <p style="margin:4px 0;">&copy; ${new Date().getFullYear()} Todos los derechos reservados.</p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `;

    return this.send(customerEmail, subject, html);
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
    };
    return text.replace(/[&<>"']/g, (char) => map[char]);
  }
}
