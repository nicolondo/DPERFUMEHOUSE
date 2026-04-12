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
  private readonly sellerAppUrl: string;
  private readonly ordersEmail: string;

  constructor(private readonly configService: ConfigService) {
    this.fromAddress = this.configService.get<string>(
      'MAIL_FROM',
      'noreply@dperfumehouse.com',
    );
    this.fromName = this.configService.get<string>(
      'MAIL_FROM_NAME',
      'D Perfume House',
    );
    this.sellerAppUrl = this.configService.get<string>(
      'SELLER_APP_URL',
      'http://localhost:3000',
    );
    this.ordersEmail = this.configService.get<string>(
      'ORDERS_EMAIL',
      'ordenes@dperfumehouse.com',
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
    const logoUrl = `${this.sellerAppUrl}/icons/logo-email.png`;
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

  async sendCollectReference(
    customerEmail: string,
    customerName: string,
    orderNumber: string,
    businessAgreementCode: string,
    paymentIntentionIdentifier: string,
    total: number,
  ): Promise<boolean> {
    const subject = `Tu referencia de pago - Pedido ${orderNumber}`;
    const logoUrl = `${this.configService.get('SELLER_APP_URL', 'https://pos.dperfumehouse.com')}/icons/logo-dperfumehouse.svg`;
    const formattedTotal = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(total);

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Referencia de pago - ${this.escapeHtml(orderNumber)}</title>
        <style>
          :root { color-scheme: light only; }
          body { margin: 0; padding: 0; font-family: 'Outfit', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f0b05 !important; }
        </style>
      </head>
      <body style="margin:0;padding:0;background-color:#0f0b05;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#0f0b05;">
          <tr><td align="center" style="padding:24px 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="620" style="max-width:620px;width:100%;background-color:#16110a;border-radius:16px;overflow:hidden;">

              <!-- Header / Logo -->
              <tr><td align="center" style="padding:32px 32px 20px;background-color:#16110a;">
                <img src="${logoUrl}" alt="D Perfume House" width="200" style="display:block;width:200px;max-width:60%;height:auto;" />
                <p style="margin:10px 0 0 0;color:#bfa685;letter-spacing:2px;font-size:11px;text-transform:uppercase;">Tienda en línea</p>
              </td></tr>

              <!-- Divider -->
              <tr><td style="padding:0 32px;"><div style="height:1px;background-color:#3b2c17;"></div></td></tr>

              <!-- Body -->
              <tr><td style="padding:28px 32px;color:#f4ece1;background-color:#16110a;">

                <!-- Badge -->
                <div style="margin-bottom:18px;">
                  <span style="display:inline-block;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#ffdca7;border:1px solid #7a5b2f;background-color:rgba(196,148,77,.14);">Referencia lista</span>
                </div>

                <p style="margin:0 0 6px 0;font-size:25px;line-height:1.2;color:#fff7eb;font-weight:700;">Hola, ${this.escapeHtml(customerName)} 👋</p>
                <p style="margin:0 0 22px 0;font-size:15px;color:#d6c3a8;line-height:1.6;">
                  Tu referencia de pago Bancolombia Corresponsal para el pedido
                  <strong style="color:#fff7eb;">${this.escapeHtml(orderNumber)}</strong> ya está lista.
                  Dirígete a cualquier punto Corresponsal Bancolombia para completar tu pago.
                </p>

                <!-- Amount -->
                <div style="margin:0 0 24px 0;border:1px solid #3b2c17;border-radius:12px;background-color:#1e160d;padding:18px 20px;text-align:center;">
                  <p style="margin:0 0 4px 0;color:#9c8568;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Total a pagar</p>
                  <p style="margin:0;font-size:32px;font-weight:800;color:#c9a96e;letter-spacing:1px;">${formattedTotal}</p>
                </div>

                <!-- Reference codes -->
                <p style="margin:0 0 12px 0;font-size:13px;color:#9c8568;text-transform:uppercase;letter-spacing:.8px;font-weight:600;">Datos para el pago</p>

                <!-- No. Convenio -->
                <div style="margin:0 0 12px 0;border:1px solid #3b2c17;border-radius:10px;background-color:#1a130a;padding:16px 20px;">
                  <p style="margin:0 0 6px 0;color:#9c8568;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Número de Convenio</p>
                  <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:4px;font-family:'Courier New',Courier,monospace;">${this.escapeHtml(businessAgreementCode)}</p>
                </div>

                <!-- No. Pago -->
                <div style="margin:0 0 24px 0;border:1px solid #3b2c17;border-radius:10px;background-color:#1a130a;padding:16px 20px;">
                  <p style="margin:0 0 6px 0;color:#9c8568;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Número de Pago (Referencia)</p>
                  <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:3px;font-family:'Courier New',Courier,monospace;word-break:break-all;">${this.escapeHtml(paymentIntentionIdentifier)}</p>
                </div>

                <!-- Instructions -->
                <div style="border:1px solid #3b2c17;border-radius:10px;background-color:#1e160d;padding:18px 20px;margin:0 0 24px 0;">
                  <p style="margin:0 0 10px 0;font-size:13px;font-weight:700;color:#c9a96e;text-transform:uppercase;letter-spacing:.7px;">¿Cómo pagar?</p>
                  <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td width="28" valign="top" style="padding:3px 10px 6px 0;color:#c9a96e;font-size:14px;font-weight:700;">1.</td>
                      <td style="padding:0 0 6px 0;font-size:13px;color:#d6c3a8;line-height:1.5;">Ve a cualquier <strong style="color:#fff7eb;">Corresponsal Bancolombia</strong> o punto de recaudo autorizado.</td>
                    </tr>
                    <tr>
                      <td width="28" valign="top" style="padding:3px 10px 6px 0;color:#c9a96e;font-size:14px;font-weight:700;">2.</td>
                      <td style="padding:0 0 6px 0;font-size:13px;color:#d6c3a8;line-height:1.5;">Indica que deseas hacer un pago por <strong style="color:#fff7eb;">Convenio</strong>.</td>
                    </tr>
                    <tr>
                      <td width="28" valign="top" style="padding:3px 10px 0 0;color:#c9a96e;font-size:14px;font-weight:700;">3.</td>
                      <td style="padding:0;font-size:13px;color:#d6c3a8;line-height:1.5;">Proporciona el <strong style="color:#fff7eb;">Número de Convenio</strong> y el <strong style="color:#fff7eb;">Número de Pago</strong> indicados arriba.</td>
                    </tr>
                  </table>
                </div>

                <!-- Note -->
                <div style="border-top:1px solid #3b2c17;padding-top:16px;">
                  <p style="margin:0;font-size:13px;color:#9c8568;line-height:1.5;">
                    ¿Tienes alguna pregunta? Contáctanos y con gusto te ayudamos.
                  </p>
                </div>

              </td></tr>

              <!-- Footer -->
              <tr><td style="padding:18px 32px 24px;color:#9c8568;font-size:12px;text-align:center;background-color:#16110a;border-top:1px solid #3b2c17;">
                <p style="margin:4px 0;font-weight:700;color:#bfa685;">D Perfume House</p>
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
    const logoUrl = `${this.sellerAppUrl}/icons/logo-email.png`;
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
        </style>
      </head>
      <body style="margin:0;padding:0;background-color:#0f0b05;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#0f0b05;">
          <tr><td align="center" style="padding:24px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="620" style="max-width:620px;width:100%;background-color:#16110a;">
              <!-- Header with logo -->
              <tr><td align="center" style="padding:30px 32px 20px;background-color:#16110a;">
                <img src="${logoUrl}" alt="D Perfume House" width="320" style="display:block;width:320px;max-width:80%;height:auto;" />
                <p style="margin:12px 0 0 0;color:#bfa685;letter-spacing:2px;font-size:11px;text-transform:uppercase;">Tu plataforma de ventas</p>
              </td></tr>
              <!-- Content -->
              <tr><td style="padding:28px 32px 14px;color:#f4ece1;background-color:#16110a;">
                <div style="text-align:center;">
                  <span style="display:inline-block;margin-bottom:14px;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#ffdca7;border:1px solid #7a5b2f;background-color:rgba(196,148,77,.14);">🎉 Nuevo vendedor</span>
                </div>
                <p style="margin:0 0 12px 0;font-size:25px;line-height:1.2;color:#fff7eb;font-weight:700;">¡Hola ${this.escapeHtml(name)}!</p>
                <p style="margin:0 0 10px 0;font-size:15px;color:#d6c3a8;">
                  <strong style="color:#fff7eb;">${this.escapeHtml(inviterName)}</strong> te ha invitado a unirte al equipo de ventas de
                  <strong style="color:#fff7eb;">D Perfume House</strong>. Ya tienes una cuenta lista, solo necesitas crear tu contraseña para comenzar.
                </p>
                <!-- Steps card -->
                <div style="margin:22px 0;border:1px solid #3b2c17;border-radius:12px;background-color:#1e160d;padding:20px;">
                  <p style="margin:0 0 14px 0;color:#ffdca7;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;">Pasos para comenzar</p>
                  <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td width="32" valign="top" style="padding:0 12px 12px 0;">
                        <div style="width:26px;height:26px;border-radius:50%;background-color:#e94560;color:#ffffff;font-size:13px;font-weight:700;text-align:center;line-height:26px;">1</div>
                      </td>
                      <td style="padding:0 0 12px 0;color:#d6c3a8;font-size:14px;line-height:1.4;">Haz clic en el botón de abajo para crear tu contraseña</td>
                    </tr>
                    <tr>
                      <td width="32" valign="top" style="padding:0 12px 12px 0;">
                        <div style="width:26px;height:26px;border-radius:50%;background-color:#e94560;color:#ffffff;font-size:13px;font-weight:700;text-align:center;line-height:26px;">2</div>
                      </td>
                      <td style="padding:0 0 12px 0;color:#d6c3a8;font-size:14px;line-height:1.4;">Inicia sesión con tu email y nueva contraseña</td>
                    </tr>
                    <tr>
                      <td width="32" valign="top" style="padding:0 12px 0 0;">
                        <div style="width:26px;height:26px;border-radius:50%;background-color:#e94560;color:#ffffff;font-size:13px;font-weight:700;text-align:center;line-height:26px;">3</div>
                      </td>
                      <td style="padding:0;color:#d6c3a8;font-size:14px;line-height:1.4;">¡Comienza a vender y ganar comisiones!</td>
                    </tr>
                  </table>
                </div>
                <!-- CTA Button -->
                <div style="text-align:center;margin:28px 0;">
                  <p style="margin:0 0 18px 0;font-size:14px;color:#9c8568;">Configura tu contraseña para activar tu cuenta</p>
                  <a href="${this.escapeHtml(setPasswordUrl)}" style="display:inline-block;background-color:#e94560;color:#ffffff;padding:16px 44px;text-decoration:none;border-radius:999px;font-weight:700;font-size:16px;letter-spacing:.5px;">Crear Mi Contraseña</a>
                  <p style="margin:16px 0 0 0;font-size:12px;color:#7a5b2f;">⏱ Este enlace expira en 72 horas</p>
                </div>
                <!-- Fallback link -->
                <div style="border-top:1px solid #3b2c17;padding-top:16px;margin-top:10px;">
                  <p style="margin:0 0 8px 0;font-size:13px;color:#9c8568;">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
                  <p style="margin:0 0 16px 0;word-break:break-all;font-size:12px;color:#7a5b2f;">${this.escapeHtml(setPasswordUrl)}</p>
                  <p style="margin:0;font-size:13px;color:#9c8568;">
                    Si no esperabas este correo, puedes ignorarlo. No se realizará ningún cambio en tu cuenta.
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

    return this.send(email, subject, html);
  }

  async sendRegistrationRequestReceived(
    email: string,
    name: string,
  ): Promise<boolean> {
    const subject = 'Solicitud de registro recibida - D Perfume House';
    const logoUrl = `${this.sellerAppUrl}/icons/logo-email.png`;
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
    const logoUrl = `${this.sellerAppUrl}/icons/logo-email.png`;
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
    const logoUrl = `${this.sellerAppUrl}/icons/logo-email.png`;
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

  async sendNewOrderNotification(data: {
    orderNumber: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    sellerName: string;
    items: { name: string; quantity: number; unitPrice: number }[];
    subtotal: number;
    tax: number;
    shipping: number;
    total: number;
    paidAt: string;
  }): Promise<boolean> {
    const logoUrl = `${this.sellerAppUrl}/icons/logo-email.png`;
    const fmt = (n: number) =>
      new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);

    const itemRows = data.items
      .map(
        (item) => `
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #3b2c17;color:#d6c3a8;font-size:14px;">${this.escapeHtml(item.name)}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #3b2c17;color:#d6c3a8;font-size:14px;text-align:center;">${item.quantity}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #3b2c17;color:#d6c3a8;font-size:14px;text-align:right;">${fmt(item.unitPrice)}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #3b2c17;color:#fff7eb;font-size:14px;text-align:right;font-weight:600;">${fmt(item.unitPrice * item.quantity)}</td>
          </tr>`,
      )
      .join('');

    const paidDate = new Date(data.paidAt).toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const subject = `🛒 Nuevo Pedido Pagado: ${data.orderNumber}`;
    const html = `
      <!DOCTYPE html>
      <html xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { margin: 0; padding: 0; font-family: 'Outfit', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f0b05; }
        </style>
      </head>
      <body style="margin:0;padding:0;background-color:#0f0b05;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#0f0b05;">
          <tr><td align="center" style="padding:24px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="620" style="max-width:620px;width:100%;background-color:#16110a;">
              <!-- Header -->
              <tr><td align="center" style="padding:30px 32px 20px;background-color:#16110a;">
                <img src="${logoUrl}" alt="D Perfume House" width="320" style="display:block;width:320px;max-width:80%;height:auto;" />
                <p style="margin:12px 0 0 0;color:#bfa685;letter-spacing:2px;font-size:11px;text-transform:uppercase;">Notificación de Pedido</p>
              </td></tr>
              <!-- Badge -->
              <tr><td style="padding:20px 32px 10px;background-color:#16110a;">
                <span style="display:inline-block;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#a3e635;border:1px solid #4d7c0f;background-color:rgba(74,222,128,.1);">✓ Pago Confirmado</span>
              </td></tr>
              <!-- Order info -->
              <tr><td style="padding:14px 32px;color:#f4ece1;background-color:#16110a;">
                <p style="margin:0 0 6px 0;font-size:22px;font-weight:700;color:#fff7eb;">Pedido ${this.escapeHtml(data.orderNumber)}</p>
                <p style="margin:0 0 18px 0;font-size:13px;color:#9c8568;">${paidDate}</p>
                <!-- Info cards -->
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:20px;">
                  <tr>
                    <td style="width:50%;vertical-align:top;padding-right:8px;">
                      <div style="border:1px solid #3b2c17;border-radius:10px;background-color:#1e160d;padding:14px;">
                        <p style="margin:0 0 4px 0;color:#9c8568;font-size:11px;text-transform:uppercase;letter-spacing:.5px;">Cliente</p>
                        <p style="margin:0 0 2px 0;color:#fff7eb;font-size:14px;font-weight:600;">${this.escapeHtml(data.customerName)}</p>
                        <p style="margin:0 0 2px 0;color:#d6c3a8;font-size:12px;">${this.escapeHtml(data.customerEmail)}</p>
                        <p style="margin:0;color:#d6c3a8;font-size:12px;">${this.escapeHtml(data.customerPhone)}</p>
                      </div>
                    </td>
                    <td style="width:50%;vertical-align:top;padding-left:8px;">
                      <div style="border:1px solid #3b2c17;border-radius:10px;background-color:#1e160d;padding:14px;">
                        <p style="margin:0 0 4px 0;color:#9c8568;font-size:11px;text-transform:uppercase;letter-spacing:.5px;">Vendedor</p>
                        <p style="margin:0;color:#fff7eb;font-size:14px;font-weight:600;">${this.escapeHtml(data.sellerName)}</p>
                      </div>
                    </td>
                  </tr>
                </table>
                <!-- Items table -->
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #3b2c17;border-radius:10px;overflow:hidden;background-color:#1e160d;">
                  <tr style="background-color:#281e11;">
                    <th style="padding:10px 12px;text-align:left;color:#bfa685;font-size:11px;text-transform:uppercase;letter-spacing:.5px;font-weight:600;">Producto</th>
                    <th style="padding:10px 12px;text-align:center;color:#bfa685;font-size:11px;text-transform:uppercase;letter-spacing:.5px;font-weight:600;">Cant.</th>
                    <th style="padding:10px 12px;text-align:right;color:#bfa685;font-size:11px;text-transform:uppercase;letter-spacing:.5px;font-weight:600;">P. Unit.</th>
                    <th style="padding:10px 12px;text-align:right;color:#bfa685;font-size:11px;text-transform:uppercase;letter-spacing:.5px;font-weight:600;">Total</th>
                  </tr>
                  ${itemRows}
                </table>
                <!-- Totals -->
                <div style="margin-top:16px;border:1px solid #3b2c17;border-radius:10px;background-color:#1e160d;padding:16px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="padding:4px 0;color:#9c8568;font-size:14px;">Subtotal</td>
                      <td style="padding:4px 0;color:#d6c3a8;font-size:14px;text-align:right;">${fmt(data.subtotal)}</td>
                    </tr>
                    ${data.tax > 0 ? `<tr><td style="padding:4px 0;color:#9c8568;font-size:14px;">IVA</td><td style="padding:4px 0;color:#d6c3a8;font-size:14px;text-align:right;">${fmt(data.tax)}</td></tr>` : ''}
                    ${data.shipping > 0 ? `<tr><td style="padding:4px 0;color:#9c8568;font-size:14px;">Envío</td><td style="padding:4px 0;color:#d6c3a8;font-size:14px;text-align:right;">${fmt(data.shipping)}</td></tr>` : ''}
                    <tr>
                      <td style="padding:10px 0 4px 0;border-top:1px solid #3b2c17;color:#fff7eb;font-size:18px;font-weight:700;">Total</td>
                      <td style="padding:10px 0 4px 0;border-top:1px solid #3b2c17;color:#e94560;font-size:18px;font-weight:800;text-align:right;">${fmt(data.total)}</td>
                    </tr>
                  </table>
                </div>
              </td></tr>
              <!-- Footer -->
              <tr><td style="padding:18px 32px 24px;color:#9c8568;font-size:12px;text-align:center;background-color:#16110a;">
                <p style="margin:4px 0;">Este correo fue generado automáticamente al confirmar el pago.</p>
                <p style="margin:4px 0;"><strong>D Perfume House</strong> &mdash; &copy; ${new Date().getFullYear()}</p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `;

    return this.send(this.ordersEmail, subject, html);
  }

  /**
   * Email to customer when order is shipped with tracking info
   */
  async sendShippedNotification(data: {
    customerEmail: string;
    customerName: string;
    orderNumber: string;
    trackingNumber: string | null;
    trackUrl: string | null;
    carrier: string | null;
    items: { name: string; quantity: number; price: number }[];
    total: number;
  }): Promise<boolean> {
    const subject = `🚚 Tu pedido ${data.orderNumber} ha sido enviado`;
    const logoUrl = `${this.sellerAppUrl}/icons/logo-dperfumehouse.svg`;
    const fmt = (n: number) =>
      new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
      }).format(n);

    const itemRows = data.items
      .map(
        (item) => `
        <tr>
          <td style="padding:10px 0;color:#f4ece1;font-size:14px;border-bottom:1px solid #3b2c17;">${this.escapeHtml(item.name)}</td>
          <td style="padding:10px 0;color:#d6c3a8;font-size:14px;border-bottom:1px solid #3b2c17;text-align:center;">x${item.quantity}</td>
          <td style="padding:10px 0;color:#d6c3a8;font-size:14px;border-bottom:1px solid #3b2c17;text-align:right;">${fmt(item.price * item.quantity)}</td>
        </tr>`,
      )
      .join('');

    const trackingSection = data.trackingNumber
      ? `
        <!-- Tracking Info -->
        <div style="margin:0 0 24px 0;border:1px solid #3b2c17;border-radius:12px;background-color:#1e160d;padding:20px;">
          <p style="margin:0 0 16px 0;font-size:13px;color:#9c8568;text-transform:uppercase;letter-spacing:.8px;font-weight:600;">📍 Información de rastreo</p>
          ${data.carrier ? `
          <div style="margin:0 0 12px 0;">
            <p style="margin:0 0 4px 0;color:#9c8568;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Transportadora</p>
            <p style="margin:0;font-size:16px;font-weight:700;color:#fff7eb;">${this.escapeHtml(data.carrier)}</p>
          </div>` : ''}
          <div style="margin:0 0 12px 0;">
            <p style="margin:0 0 4px 0;color:#9c8568;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Número de guía</p>
            <p style="margin:0;font-size:20px;font-weight:800;color:#c9a96e;letter-spacing:2px;font-family:'Courier New',Courier,monospace;">${this.escapeHtml(data.trackingNumber)}</p>
          </div>
          ${data.trackUrl ? `
          <div style="margin:16px 0 0 0;text-align:center;">
            <a href="${this.escapeHtml(data.trackUrl)}" style="display:inline-block;padding:12px 32px;background-color:#c9a96e;color:#0f0b05;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;text-transform:uppercase;letter-spacing:1px;">Rastrear mi pedido</a>
          </div>` : ''}
        </div>
      `
      : `
        <div style="margin:0 0 24px 0;border:1px solid #3b2c17;border-radius:12px;background-color:#1e160d;padding:20px;text-align:center;">
          <p style="margin:0;font-size:14px;color:#d6c3a8;">Tu pedido ha sido despachado. Te notificaremos cuando tengamos la información de rastreo disponible.</p>
        </div>
      `;

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Pedido enviado - ${this.escapeHtml(data.orderNumber)}</title>
      </head>
      <body style="margin:0;padding:0;background-color:#0f0b05;font-family:'Outfit','Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#0f0b05;">
          <tr><td align="center" style="padding:24px 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="620" style="max-width:620px;width:100%;background-color:#16110a;border-radius:16px;overflow:hidden;">

              <!-- Header / Logo -->
              <tr><td align="center" style="padding:32px 32px 20px;background-color:#16110a;">
                <img src="${logoUrl}" alt="D Perfume House" width="200" style="display:block;width:200px;max-width:60%;height:auto;" />
              </td></tr>

              <!-- Divider -->
              <tr><td style="padding:0 32px;"><div style="height:1px;background-color:#3b2c17;"></div></td></tr>

              <!-- Body -->
              <tr><td style="padding:28px 32px;color:#f4ece1;background-color:#16110a;">

                <!-- Badge -->
                <div style="margin-bottom:18px;">
                  <span style="display:inline-block;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#ffdca7;border:1px solid #7a5b2f;background-color:rgba(196,148,77,.14);">🚚 Pedido enviado</span>
                </div>

                <p style="margin:0 0 6px 0;font-size:25px;line-height:1.2;color:#fff7eb;font-weight:700;">Hola, ${this.escapeHtml(data.customerName)} 👋</p>
                <p style="margin:0 0 22px 0;font-size:15px;color:#d6c3a8;line-height:1.6;">
                  ¡Buenas noticias! Tu pedido <strong style="color:#fff7eb;">${this.escapeHtml(data.orderNumber)}</strong> ya está en camino.
                </p>

                ${trackingSection}

                <!-- Order items -->
                <p style="margin:0 0 12px 0;font-size:13px;color:#9c8568;text-transform:uppercase;letter-spacing:.8px;font-weight:600;">Productos en tu pedido</p>
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px 0;">
                  <tr>
                    <td style="padding:8px 0;color:#9c8568;font-size:11px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #3b2c17;">Producto</td>
                    <td style="padding:8px 0;color:#9c8568;font-size:11px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #3b2c17;text-align:center;">Cant.</td>
                    <td style="padding:8px 0;color:#9c8568;font-size:11px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #3b2c17;text-align:right;">Total</td>
                  </tr>
                  ${itemRows}
                </table>

                <div style="margin:0 0 24px 0;border:1px solid #3b2c17;border-radius:10px;background-color:#1e160d;padding:16px;text-align:right;">
                  <span style="color:#9c8568;font-size:14px;">Total: </span>
                  <span style="color:#c9a96e;font-size:20px;font-weight:800;">${fmt(data.total)}</span>
                </div>

                <!-- Note -->
                <div style="border-top:1px solid #3b2c17;padding-top:16px;">
                  <p style="margin:0;font-size:13px;color:#9c8568;line-height:1.5;">
                    ¿Tienes alguna pregunta sobre tu envío? Contáctanos y con gusto te ayudamos.
                  </p>
                </div>

              </td></tr>

              <!-- Footer -->
              <tr><td style="padding:18px 32px 24px;color:#9c8568;font-size:12px;text-align:center;background-color:#16110a;border-top:1px solid #3b2c17;">
                <p style="margin:4px 0;font-weight:700;color:#bfa685;">D Perfume House</p>
                <p style="margin:4px 0;">&copy; ${new Date().getFullYear()} Todos los derechos reservados.</p>
              </td></tr>

            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `;

    return this.send(data.customerEmail, subject, html);
  }

  /**
   * Email to customer when order is delivered
   */
  async sendDeliveredNotification(data: {
    customerEmail: string;
    customerName: string;
    orderNumber: string;
    items: { name: string; quantity: number; price: number }[];
    total: number;
  }): Promise<boolean> {
    const subject = `✅ Tu pedido ${data.orderNumber} fue entregado`;
    const logoUrl = `${this.sellerAppUrl}/icons/logo-dperfumehouse.svg`;
    const fmt = (n: number) =>
      new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
      }).format(n);

    const itemRows = data.items
      .map(
        (item) => `
        <tr>
          <td style="padding:10px 0;color:#f4ece1;font-size:14px;border-bottom:1px solid #3b2c17;">${this.escapeHtml(item.name)}</td>
          <td style="padding:10px 0;color:#d6c3a8;font-size:14px;border-bottom:1px solid #3b2c17;text-align:center;">x${item.quantity}</td>
          <td style="padding:10px 0;color:#d6c3a8;font-size:14px;border-bottom:1px solid #3b2c17;text-align:right;">${fmt(item.price * item.quantity)}</td>
        </tr>`,
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Pedido entregado - ${this.escapeHtml(data.orderNumber)}</title>
      </head>
      <body style="margin:0;padding:0;background-color:#0f0b05;font-family:'Outfit','Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#0f0b05;">
          <tr><td align="center" style="padding:24px 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="620" style="max-width:620px;width:100%;background-color:#16110a;border-radius:16px;overflow:hidden;">

              <!-- Header / Logo -->
              <tr><td align="center" style="padding:32px 32px 20px;background-color:#16110a;">
                <img src="${logoUrl}" alt="D Perfume House" width="200" style="display:block;width:200px;max-width:60%;height:auto;" />
              </td></tr>

              <!-- Divider -->
              <tr><td style="padding:0 32px;"><div style="height:1px;background-color:#3b2c17;"></div></td></tr>

              <!-- Body -->
              <tr><td style="padding:28px 32px;color:#f4ece1;background-color:#16110a;">

                <!-- Badge -->
                <div style="margin-bottom:18px;">
                  <span style="display:inline-block;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#27ae60;border:1px solid #1e8449;background-color:rgba(39,174,96,.12);">✅ Entregado</span>
                </div>

                <p style="margin:0 0 6px 0;font-size:25px;line-height:1.2;color:#fff7eb;font-weight:700;">¡Tu pedido llegó! 🎉</p>
                <p style="margin:0 0 22px 0;font-size:15px;color:#d6c3a8;line-height:1.6;">
                  Hola <strong style="color:#fff7eb;">${this.escapeHtml(data.customerName)}</strong>, tu pedido <strong style="color:#fff7eb;">${this.escapeHtml(data.orderNumber)}</strong> ha sido entregado exitosamente.
                </p>

                <!-- Success icon -->
                <div style="margin:0 0 24px 0;text-align:center;padding:24px 0;">
                  <div style="display:inline-block;width:80px;height:80px;border-radius:50%;background-color:rgba(39,174,96,.15);border:2px solid #27ae60;line-height:80px;font-size:40px;text-align:center;">
                    ✓
                  </div>
                </div>

                <!-- Order items -->
                <p style="margin:0 0 12px 0;font-size:13px;color:#9c8568;text-transform:uppercase;letter-spacing:.8px;font-weight:600;">Resumen de tu pedido</p>
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px 0;">
                  <tr>
                    <td style="padding:8px 0;color:#9c8568;font-size:11px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #3b2c17;">Producto</td>
                    <td style="padding:8px 0;color:#9c8568;font-size:11px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #3b2c17;text-align:center;">Cant.</td>
                    <td style="padding:8px 0;color:#9c8568;font-size:11px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #3b2c17;text-align:right;">Total</td>
                  </tr>
                  ${itemRows}
                </table>

                <div style="margin:0 0 24px 0;border:1px solid #3b2c17;border-radius:10px;background-color:#1e160d;padding:16px;text-align:right;">
                  <span style="color:#9c8568;font-size:14px;">Total: </span>
                  <span style="color:#c9a96e;font-size:20px;font-weight:800;">${fmt(data.total)}</span>
                </div>

                <!-- Thank you message -->
                <div style="border:1px solid #3b2c17;border-radius:12px;background-color:#1e160d;padding:20px;text-align:center;margin:0 0 24px 0;">
                  <p style="margin:0 0 8px 0;font-size:18px;font-weight:700;color:#c9a96e;">¡Gracias por tu compra! 💛</p>
                  <p style="margin:0;font-size:14px;color:#d6c3a8;line-height:1.6;">Esperamos que disfrutes tus fragancias. Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos.</p>
                </div>

                <!-- Note -->
                <div style="border-top:1px solid #3b2c17;padding-top:16px;">
                  <p style="margin:0;font-size:13px;color:#9c8568;line-height:1.5;">
                    Tu opinión es muy importante para nosotros. Si tuviste una buena experiencia, te invitamos a recomendarnos con tus amigos y familiares.
                  </p>
                </div>

              </td></tr>

              <!-- Footer -->
              <tr><td style="padding:18px 32px 24px;color:#9c8568;font-size:12px;text-align:center;background-color:#16110a;border-top:1px solid #3b2c17;">
                <p style="margin:4px 0;font-weight:700;color:#bfa685;">D Perfume House</p>
                <p style="margin:4px 0;">&copy; ${new Date().getFullYear()} Todos los derechos reservados.</p>
              </td></tr>

            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `;

    return this.send(data.customerEmail, subject, html);
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
