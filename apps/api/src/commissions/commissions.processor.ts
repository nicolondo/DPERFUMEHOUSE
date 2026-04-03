import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '@dperfumehouse/config';
import { CommissionsService } from './commissions.service';

interface CalculateCommissionJob {
  orderId: string;
}

@Processor(QUEUE_NAMES.COMMISSION_CALC)
export class CommissionsProcessor extends WorkerHost {
  private readonly logger = new Logger(CommissionsProcessor.name);

  constructor(private readonly commissionsService: CommissionsService) {
    super();
  }

  async process(job: Job<CalculateCommissionJob>): Promise<void> {
    const { orderId } = job.data;

    this.logger.log(
      `Processing commission calculation job ${job.id} for order ${orderId}`,
    );

    try {
      await this.commissionsService.calculateForOrder(orderId);
      this.logger.log(
        `Commission calculation completed for order ${orderId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to calculate commissions for order ${orderId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
