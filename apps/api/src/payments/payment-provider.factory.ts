import { Injectable, Logger } from '@nestjs/common';
import { PaymentProvider } from './payment.interface';
import { MyxSpendService } from './myxspend.service';
import { WompiService } from './wompi.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class PaymentProviderFactory {
  private readonly logger = new Logger(PaymentProviderFactory.name);

  constructor(
    private readonly myxSpendService: MyxSpendService,
    private readonly wompiService: WompiService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Get the currently active payment provider based on settings.
   */
  async getActiveProvider(): Promise<{ provider: PaymentProvider; name: string }> {
    const providerName =
      (await this.settingsService.get('active_payment_provider')) || 'myxspend';

    return {
      provider: this.getProviderByName(providerName),
      name: providerName,
    };
  }

  /**
   * Get a specific payment provider by name.
   * Used for webhook handling of existing payment links.
   */
  getProviderByName(name: string): PaymentProvider {
    switch (name) {
      case 'wompi':
        return this.wompiService;
      case 'myxspend':
      default:
        return this.myxSpendService;
    }
  }

  /**
   * Get the Wompi service directly (for webhook verification).
   */
  getWompiService(): WompiService {
    return this.wompiService;
  }
}
