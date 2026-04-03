import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { CertificateAnalyzerService } from './certificate-analyzer.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  controllers: [UsersController],
  providers: [UsersService, CertificateAnalyzerService],
  exports: [UsersService],
})
export class UsersModule {}
