import { Module } from '@nestjs/common';
import { OdooModule } from '../odoo/odoo.module';
import { CommissionsService } from './commissions.service';
import { CommissionsController } from './commissions.controller';
import { CommissionsProcessor } from './commissions.processor';
import { MonthlyCommissionBonusScheduler } from './monthly-commission-bonus.scheduler';

@Module({
  imports: [OdooModule],
  controllers: [CommissionsController],
  providers: [CommissionsService, CommissionsProcessor, MonthlyCommissionBonusScheduler],
  exports: [CommissionsService],
})
export class CommissionsModule {}
