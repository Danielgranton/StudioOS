import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PaymentService } from './payment.service';

@Controller('webhooks/payment')
export class PaymentWebHookController {
    constructor(private paymentService: PaymentService) {}

    @Post()
    @HttpCode(200)
    async handlePaymentWebhook(
      @Body() payload: any,
      @Headers('x-webhook-secret') webhookSecret?: string,
    ) {
        const expectedSecret = process.env.PAYMENT_WEBHOOK_SECRET;

        if (!expectedSecret) {
            console.error('PAYMENT_WEBHOOK_SECRET is not configured');
            throw new InternalServerErrorException('Webhook security is not configured');
        }

        if (webhookSecret !== expectedSecret) {
            throw new UnauthorizedException('Invalid webhook secret');
        }

        return this.paymentService.processPayment(payload);
    }
}
