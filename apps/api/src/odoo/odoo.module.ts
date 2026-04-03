import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OdooService } from './odoo.service';
import { OdooSyncService } from './odoo-sync.service';
import { OdooSyncProcessor } from './odoo-sync.processor';
import { ImageModule } from '../image/image.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'odoo-sync',
    }),
    ImageModule,
  ],
  providers: [OdooService, OdooSyncService, OdooSyncProcessor],
  exports: [OdooService, OdooSyncService],
})
export class OdooModule {}
