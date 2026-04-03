import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CommissionsService } from './commissions.service';

@Injectable()
export class MonthlyCommissionBonusScheduler {
  private readonly logger = new Logger(MonthlyCommissionBonusScheduler.name);

  constructor(private readonly commissionsService: CommissionsService) {}

  // Runs on day 1 at 00:05 Colombia time for previous month.
  @Cron('5 0 1 * *', { timeZone: 'America/Bogota' })
  async runMonthlyBonus(): Promise<void> {
    const now = new Date();
    let year = now.getUTCFullYear();
    let month = now.getUTCMonth(); // previous month in 1-12 scale after adjustment

    if (month === 0) {
      month = 12;
      year -= 1;
    }

    try {
      const result = await this.commissionsService.processMonthlyScaleBonuses(year, month);
      this.logger.log(
        `Monthly bonus processed for ${year}-${String(month).padStart(2, '0')}: posted=${result.posted}, failed=${result.failed}, skipped=${result.skipped}`,
      );
    } catch (error) {
      this.logger.error(`Monthly bonus processing failed: ${error?.message || error}`);
    }
  }
}
