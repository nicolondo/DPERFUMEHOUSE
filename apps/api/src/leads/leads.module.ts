import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { AnthropicService } from '../questionnaires/anthropic.service';
import { FragranceProfilesModule } from '../fragrance-profiles/fragrance-profiles.module';
import { FragellaModule } from '../fragella/fragella.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [FragranceProfilesModule, FragellaModule, EmailModule],
  controllers: [LeadsController],
  providers: [LeadsService, AnthropicService],
  exports: [LeadsService],
})
export class LeadsModule {}
