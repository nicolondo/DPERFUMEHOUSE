import { Controller, Post, Delete, Body, Req, UseGuards, Get } from '@nestjs/common';
import { PushService } from './push.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';

interface AuthRequest extends Request {
  user: { id: string; email: string; role: string };
}

@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  /** Returns VAPID public key for the client to subscribe */
  @Get('vapid-public-key')
  getVapidPublicKey() {
    return { publicKey: this.pushService.getVapidPublicKey() };
  }

  /** Register a push subscription for the authenticated seller */
  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  async subscribe(
    @Req() req: AuthRequest,
    @Body() body: { endpoint: string; keys: { p256dh: string; auth: string } },
  ) {
    await this.pushService.saveSubscription(req.user.id, body);
    return { ok: true };
  }

  /** Unregister a push subscription */
  @Delete('unsubscribe')
  @UseGuards(JwtAuthGuard)
  async unsubscribe(@Body() body: { endpoint: string }) {
    await this.pushService.removeSubscription(body.endpoint);
    return { ok: true };
  }
}
