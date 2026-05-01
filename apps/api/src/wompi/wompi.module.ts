import { Module } from '@nestjs/common';
import { WompiService } from './wompi.service';
import { WompiController } from './wompi.controller';

@Module({
  controllers: [WompiController],
  providers: [WompiService],
  exports: [WompiService],
})
export class WompiModule {}
