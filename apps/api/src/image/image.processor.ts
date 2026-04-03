import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '@dperfumehouse/config';
import { ImageService } from './image.service';
import { PrismaService } from '../prisma/prisma.service';

interface ProcessImageJob {
  type: 'product' | 'odoo';
  variantId: string;
  base64Data?: string;
  buffer?: number[];
  filename?: string;
  sortOrder?: number;
  isPrimary?: boolean;
}

@Processor(QUEUE_NAMES.IMAGE_PROCESS)
export class ImageProcessor extends WorkerHost {
  private readonly logger = new Logger(ImageProcessor.name);

  constructor(
    private readonly imageService: ImageService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<ProcessImageJob>): Promise<void> {
    const { type, variantId } = job.data;

    this.logger.log(
      `Processing image job ${job.id} for variant ${variantId} (type: ${type})`,
    );

    try {
      let result: { url: string; thumbnailUrl: string };

      if (type === 'odoo' && job.data.base64Data) {
        result = await this.imageService.processOdooImage(
          job.data.base64Data,
          variantId,
        );
      } else if (type === 'product' && job.data.buffer && job.data.filename) {
        const buffer = Buffer.from(job.data.buffer);
        result = await this.imageService.processProductImage(
          buffer,
          job.data.filename,
          variantId,
        );
      } else {
        throw new Error(`Invalid image job data for type: ${type}`);
      }

      // Save to database
      await this.prisma.productImage.create({
        data: {
          variantId,
          url: result.url,
          thumbnailUrl: result.thumbnailUrl,
          sortOrder: job.data.sortOrder ?? 0,
          isPrimary: job.data.isPrimary ?? false,
        },
      });

      this.logger.log(
        `Image processed and saved for variant ${variantId}: ${result.url}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process image job ${job.id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
