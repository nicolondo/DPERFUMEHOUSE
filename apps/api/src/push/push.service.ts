import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly initialized: boolean = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const email = this.config.get<string>('VAPID_EMAIL', 'mailto:noreply@dperfumehouse.com');

    if (publicKey && privateKey) {
      webpush.setVapidDetails(email, publicKey, privateKey);
      this.initialized = true;
      this.logger.log('Web Push initialized with VAPID keys');
    } else {
      this.logger.warn('VAPID keys not configured — push notifications disabled');
    }
  }

  /** Store push subscription for a user */
  async saveSubscription(userId: string, subscription: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<void> {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userId,
      },
      create: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });
    this.logger.log(`Push subscription saved for user ${userId}`);
  }

  /** Remove a push subscription */
  async removeSubscription(endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
  }

  /** Send push notification to all subscriptions of a user */
  async sendToUser(userId: string, payload: { title: string; body: string; icon?: string; data?: Record<string, any> }): Promise<void> {
    if (!this.initialized) {
      this.logger.warn('Push not initialized, skipping notification');
      return;
    }

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });

    if (!subscriptions.length) {
      this.logger.log(`No push subscriptions found for user ${userId}`);
      return;
    }

    const payloadStr = JSON.stringify(payload);
    const stale: string[] = [];

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payloadStr,
          );
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            stale.push(sub.endpoint);
          } else {
            this.logger.error(`Push send error for user ${userId}: ${err.message}`);
          }
        }
      }),
    );

    // Clean up expired subscriptions
    if (stale.length) {
      await this.prisma.pushSubscription.deleteMany({ where: { endpoint: { in: stale } } });
      this.logger.log(`Removed ${stale.length} stale push subscription(s) for user ${userId}`);
    }
  }

  getVapidPublicKey(): string {
    return this.config.get<string>('VAPID_PUBLIC_KEY', '');
  }
}
