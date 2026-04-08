import { Module } from '@nestjs/common';
import { FragranceProfilesController } from './fragrance-profiles.controller';
import { FragranceProfilesService } from './fragrance-profiles.service';
import { AnthropicService } from '../questionnaires/anthropic.service';
import { FragellaModule } from '../fragella/fragella.module';

@Module({
  imports: [FragellaModule],
  controllers: [FragranceProfilesController],
  providers: [FragranceProfilesService, AnthropicService],
  exports: [FragranceProfilesService],
})
export class FragranceProfilesModule {}
