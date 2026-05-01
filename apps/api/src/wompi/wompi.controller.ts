import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { WompiService } from './wompi.service';

@ApiTags('Wompi')
@Controller('wompi')
export class WompiController {
  private readonly logger = new Logger(WompiController.name);

  constructor(
    private readonly wompi: WompiService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('banks')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List Wompi banks (admin only)' })
  async banks() {
    const data = await this.wompi.getBanks();
    return { success: true, data };
  }

  @Post('events')
  @HttpCode(200)
  @ApiOperation({ summary: 'Wompi events webhook (HMAC verified)' })
  async events(
    @Req() req: Request,
    @Headers('x-event-checksum') checksum: string,
    @Body() body: any,
  ) {
    const raw =
      (req as any).rawBody?.toString('utf8') ?? JSON.stringify(body ?? {});

    const valid = await this.wompi.verifyEventSignature(raw, checksum || '');
    if (!valid) {
      this.logger.warn('Wompi webhook signature INVALID — ignoring event');
      return { received: true, valid: false };
    }

    const event = body?.event || body?.type || 'unknown';
    const data = body?.data || body;

    this.logger.log(`Wompi event: ${event}`);

    // Update payout status based on transaction events
    const txn = data?.transaction || data;
    const txnId: string | undefined = txn?.id;
    const txnStatus: string | undefined = txn?.status;
    const txnReason: string | undefined =
      txn?.failedReason || txn?.failed_reason || txn?.rejectionReason;

    if (txnId) {
      const payout = await this.prisma.sellerPayout.findFirst({
        where: { wompiTransactionId: txnId },
      });
      if (payout) {
        const newStatus =
          txnStatus === 'APPROVED'
            ? 'COMPLETED'
            : txnStatus === 'FAILED' || txnStatus === 'CANCELLED'
              ? 'FAILED'
              : payout.status;

        await this.prisma.sellerPayout.update({
          where: { id: payout.id },
          data: {
            wompiStatus: txnStatus,
            wompiFailReason: txnReason ?? null,
            status: newStatus as any,
            processedAt: new Date(),
          },
        });

        // If approved, mark linked commissions as PAID
        if (newStatus === 'COMPLETED') {
          await this.prisma.commission.updateMany({
            where: { payoutId: payout.id, status: 'APPROVED' },
            data: { status: 'PAID', paidAt: new Date() },
          });
        }

        this.logger.log(
          `Payout ${payout.id} updated → ${newStatus} (txn ${txnId} = ${txnStatus})`,
        );
      }
    }

    return { received: true, valid: true };
  }
}
