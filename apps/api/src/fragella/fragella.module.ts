import { Module } from '@nestjs/common';
import { FragellaService } from './fragella.service';

@Module({
  providers: [FragellaService],
  exports: [FragellaService],
})
export class FragellaModule {}
