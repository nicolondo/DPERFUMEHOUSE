import { Module } from '@nestjs/common';
import { PayoutsService } from './payouts.service';
import { PayoutsController } from './payouts.controller';
import { OdooModule } from '../odoo/odoo.module';
import { WompiModule } from '../wompi/wompi.module';

@Module({
  imports: [OdooModule, WompiModule],
  controllers: [PayoutsController],
  providers: [PayoutsService],
  exports: [PayoutsService],
})
export class PayoutsModule {}
