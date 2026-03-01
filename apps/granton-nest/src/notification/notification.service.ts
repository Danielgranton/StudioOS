import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  async sendArtistConfirmation(phone: string, title: string ) {
    this.logger.log(  `[SMS/WhatsApp MOCK] Artist notified: "${title}" ready in 7 days → ${phone}`,);
  }

  async sendProducerReminder(email: string, title: string){
    this.logger.log(`[REMINDER MOCK] Producer reminder for "${title}" → ${email}`,);
  }
}
