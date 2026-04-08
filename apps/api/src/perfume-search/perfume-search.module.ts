import { Module } from '@nestjs/common';
import { PerfumeSearchController } from './perfume-search.controller';
import { PerfumeSearchService } from './perfume-search.service';
import { FragellaModule } from '../fragella/fragella.module';

@Module({
  imports: [FragellaModule],
  controllers: [PerfumeSearchController],
  providers: [PerfumeSearchService],
})
export class PerfumeSearchModule {}
