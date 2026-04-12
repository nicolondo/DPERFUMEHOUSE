import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private initialized = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    try {
      const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
      const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
      const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');

      if (!projectId || !clientEmail || !privateKey) {
        this.logger.warn('Firebase credentials not configured — push notifications disabled');
        return;
      }

      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
          }),
        });
      }

      this.initialized = true;
      this.logger.log('Firebase Admin SDK initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Firebase', error);
    }
  }

  async registerToken(userId: string, token: string, device?: string) {
    return this.prisma.pushToken.upsert({
      where: { userId_token: { userId, token } },
      update: { device, updatedAt: new Date() },
      create: { userId, token, device },
    });
  }

  async removeToken(userId: string, token: string) {
    return this.prisma.pushToken.deleteMany({
      where: { userId, token },
    });
  }

  async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
    url?: string,
  ) {
    if (!this.initialized) return;

    const tokens = await this.prisma.pushToken.findMany({
      where: { userId },
      select: { token: true, id: true },
    });

    if (!tokens.length) return;

    const sellerAppUrl = this.configService.get<string>('SELLER_APP_URL', 'http://localhost:3000');

    const payload: admin.messaging.MulticastMessage = {
      tokens: tokens.map((t) => t.token),
      notification: { title, body },
      webpush: {
        notification: {
          icon: `${sellerAppUrl}/icons/icon-192x192.png`,
          badge: `${sellerAppUrl}/icons/icon-72x72.png`,
          ...(url ? { data: { url } } : {}),
        },
        fcmOptions: url ? { link: `${sellerAppUrl}${url}` } : undefined,
      },
      data: data || {},
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(payload);
      this.logger.log(`Push sent to ${userId}: ${response.successCount} ok, ${response.failureCount} failed`);

      // Remove invalid tokens
      const invalidIndexes: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (
          resp.error &&
          (resp.error.code === 'messaging/invalid-registration-token' ||
            resp.error.code === 'messaging/registration-token-not-registered')
        ) {
          invalidIndexes.push(tokens[idx].id);
        }
      });
      if (invalidIndexes.length) {
        await this.prisma.pushToken.deleteMany({
          where: { id: { in: invalidIndexes } },
        });
        this.logger.log(`Removed ${invalidIndexes.length} invalid push tokens`);
      }
    } catch (error) {
      this.logger.error(`Push notification error for ${userId}`, error);
    }
  }

  // ---- Convenience methods ----

  async notifyNewOrder(sellerId: string, orderNumber: string, customerName: string, total: string) {
    await this.sendToUser(
      sellerId,
      '🛍️ Nuevo pedido',
      `${customerName} — Pedido ${orderNumber} por ${total}`,
      { type: 'order', orderNumber },
      '/orders',
    );
  }

  async notifyQuestionnaireCompleted(sellerId: string, clientName: string, leadId: string) {
    await this.sendToUser(
      sellerId,
      '📋 Cuestionario completado',
      `${clientName} terminó su cuestionario de fragancias`,
      { type: 'lead', leadId },
      `/leads/${leadId}`,
    );
  }

  async notifyPaymentReceived(sellerId: string, orderNumber: string, total: string) {
    await this.sendToUser(
      sellerId,
      '💰 Pago recibido',
      `Pedido ${orderNumber} pagado — ${total}`,
      { type: 'payment', orderNumber },
      '/orders',
    );
  }

  async notifyNewLead(sellerId: string, clientName: string) {
    await this.sendToUser(
      sellerId,
      '✨ Nuevo lead',
      `${clientName} — Nuevo lead generado`,
      { type: 'lead' },
      '/leads',
    );
  }

  async notifyProposalViewed(sellerId: string, customerName: string, proposalId: string) {
    await this.sendToUser(
      sellerId,
      '👀 Propuesta vista',
      `${customerName} abrió tu propuesta`,
      { type: 'proposal', proposalId },
      `/proposals/${proposalId}`,
    );
  }
}
