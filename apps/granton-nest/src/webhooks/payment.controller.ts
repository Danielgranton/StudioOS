import { Controller , Post, Body, HttpCode } from '@nestjs/common';
import { PaymentService } from './payment.service';

@Controller('webhooks/payment')
export class PaymentWebHookController {
    constructor(private paymentService: PaymentService) {}

    @Post()
    @HttpCode(200)
    async handlePaymentWebhook(@Body() payload: any) {
        return this.paymentService.processPayment(payload);
    }
}