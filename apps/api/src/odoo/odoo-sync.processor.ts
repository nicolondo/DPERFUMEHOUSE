import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { OdooSyncService } from './odoo-sync.service';
import { PrismaService } from '../prisma/prisma.service';

@Processor('odoo-sync')
export class OdooSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(OdooSyncProcessor.name);

  constructor(
    private readonly odooSyncService: OdooSyncService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    this.logger.log(
      `Processing job ${job.id} of type ${job.name}`,
    );

    const syncLog = await this.prisma.syncLog.create({
      data: { type: job.name, status: 'running' },
    });

    const startTime = Date.now();

    try {
      let result: any;

      switch (job.name) {
        case 'sync-products': {
          result = await this.odooSyncService.syncAllProducts();
          this.logger.log(
            `Product sync job completed: ${result.created} created, ${result.updated} updated, ${result.deactivated} deactivated`,
          );
          break;
        }

        case 'sync-stock': {
          result = await this.odooSyncService.syncStock();
          this.logger.log(
            `Stock sync job completed: ${result.updated} updated`,
          );
          break;
        }

        default:
          this.logger.warn(`Unknown job type: ${job.name}`);
          throw new Error(`Unknown job type: ${job.name}`);
      }

      const duration = Math.round((Date.now() - startTime) / 1000);
      const errors = result.errors || [];

      await this.prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'completed',
          result: result as any,
          error: errors.length > 0 ? errors.join('; ') : null,
          finishedAt: new Date(),
          duration,
        },
      });

      return result;
    } catch (error) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      await this.prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
          finishedAt: new Date(),
          duration,
        },
      });
      throw error;
    }
  }
}
