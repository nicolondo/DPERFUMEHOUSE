import { Module } from '@nestjs/common';
import { ProductRequestsService } from './product-requests.service';
import { ProductRequestsController } from './product-requests.controller';

@Module({
  controllers: [ProductRequestsController],
  providers: [ProductRequestsService],
  exports: [ProductRequestsService],
})
export class ProductRequestsModule {}
