import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CustomersModule } from './customers/customers.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { OdooModule } from './odoo/odoo.module';
import { EmailModule } from './email/email.module';
import { SettingsModule } from './settings/settings.module';
import { QueueModule } from './queue/queue.module';
import { ImageModule } from './image/image.module';
import { CommissionsModule } from './commissions/commissions.module';
import { PayoutsModule } from './payouts/payouts.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ProductRequestsModule } from './product-requests/product-requests.module';
import { ShippingModule } from './shipping/shipping.module';
import { FragranceProfilesModule } from './fragrance-profiles/fragrance-profiles.module';
import { LeadsModule } from './leads/leads.module';
import { QuestionnaireQuestionsModule } from './questionnaire-questions/questionnaire-questions.module';
import { PerfumeSearchModule } from './perfume-search/perfume-search.module';
import { ProposalsModule } from './proposals/proposals.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SellerProductLinksModule } from './seller-product-links/seller-product-links.module';
import { DiscountsModule } from './discounts/discounts.module';
import { WompiModule } from './wompi/wompi.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const redisUrl = new URL(configService.get<string>('REDIS_URL', 'redis://localhost:6379'));
        return {
          connection: {
            host: redisUrl.hostname,
            port: parseInt(redisUrl.port || '6379', 10),
          },
        };
      },
      inject: [ConfigService],
    }),

    ScheduleModule.forRoot(),

    // Core
    PrismaModule,
    QueueModule,

    // Auth & Users
    AuthModule,
    UsersModule,

    // Business modules
    CustomersModule,
    ProductsModule,
    OrdersModule,
    PaymentsModule,
    CommissionsModule,
    PayoutsModule,

    // Integrations
    OdooModule,
    EmailModule,

    // Support
    SettingsModule,
    ImageModule,
    DashboardModule,
    ProductRequestsModule,
    ShippingModule,
    FragranceProfilesModule,
    LeadsModule,
    QuestionnaireQuestionsModule,
    PerfumeSearchModule,
    ProposalsModule,
    NotificationsModule,
    SellerProductLinksModule,
    DiscountsModule,
    WompiModule,
  ],
})
export class AppModule {}
