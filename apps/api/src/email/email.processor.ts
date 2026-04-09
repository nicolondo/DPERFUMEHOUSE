import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmailService } from './email.service';

@Processor('email-send')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly emailService: EmailService) {
    super();
  }

  async process(job: Job): Promise<any> {
    this.logger.log(
      `Processing email job ${job.id} of type ${job.name}`,
    );

    switch (job.name) {
      case 'send-payment-link': {
        const { customerEmail, customerName, orderNumber, paymentUrl, total } =
          job.data;
        const sent = await this.emailService.sendPaymentLink(
          customerEmail,
          customerName,
          orderNumber,
          paymentUrl,
          total,
        );
        if (!sent) {
          throw new Error(
            `Failed to send payment link email to ${customerEmail}`,
          );
        }
        this.logger.log(
          `Payment link email sent to ${customerEmail} for order ${orderNumber}`,
        );
        return { sent: true };
      }

      case 'send-order-confirmation': {
        const { customerEmail, customerName, orderNumber } = job.data;
        const sent = await this.emailService.sendOrderConfirmation(
          customerEmail,
          customerName,
          orderNumber,
        );
        if (!sent) {
          throw new Error(
            `Failed to send order confirmation email to ${customerEmail}`,
          );
        }
        this.logger.log(
          `Order confirmation email sent to ${customerEmail} for order ${orderNumber}`,
        );
        return { sent: true };
      }

      case 'send-commission-notification': {
        const { sellerEmail, sellerName, amount, orderNumber } = job.data;
        const sent = await this.emailService.sendCommissionNotification(
          sellerEmail,
          sellerName,
          amount,
          orderNumber,
        );
        if (!sent) {
          throw new Error(
            `Failed to send commission notification email to ${sellerEmail}`,
          );
        }
        this.logger.log(
          `Commission notification email sent to ${sellerEmail} for order ${orderNumber}`,
        );
        return { sent: true };
      }

      case 'send-welcome-email': {
        const { email, name, inviterName, setPasswordUrl } = job.data;
        const sent = await this.emailService.sendWelcomeEmail(
          email,
          name,
          inviterName,
          setPasswordUrl,
        );
        if (!sent) {
          throw new Error(
            `Failed to send welcome email to ${email}`,
          );
        }
        this.logger.log(
          `Welcome email sent to ${email}`,
        );
        return { sent: true };
      }

      case 'send-shipping-notification': {
        const { customerEmail, customerName, orderNumber, trackingNumber, trackUrl, carrier } = job.data;
        const sent = await this.emailService.sendShippingNotification(
          customerEmail,
          customerName,
          orderNumber,
          trackingNumber,
          trackUrl,
          carrier,
        );
        if (!sent) {
          throw new Error(`Failed to send shipping notification email to ${customerEmail}`);
        }
        this.logger.log(`Shipping notification email sent to ${customerEmail} for order ${orderNumber}`);
        return { sent: true };
      }

      case 'send-delivered-notification': {
        const { customerEmail, customerName, orderNumber } = job.data;
        const sent = await this.emailService.sendDeliveredNotification(
          customerEmail,
          customerName,
          orderNumber,
        );
        if (!sent) {
          throw new Error(`Failed to send delivered notification email to ${customerEmail}`);
        }
        this.logger.log(`Delivered notification email sent to ${customerEmail} for order ${orderNumber}`);
        return { sent: true };
      }

      default:
        this.logger.warn(`Unknown email job type: ${job.name}`);
        throw new Error(`Unknown email job type: ${job.name}`);
    }
  }
}
