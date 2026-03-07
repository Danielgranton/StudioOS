import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

type UploadFile = {
  buffer: Buffer;
  originalname: string;
};

@Injectable()
export class CloudStorageService {
  private readonly logger = new Logger(CloudStorageService.name);

  private readonly cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  private readonly apiKey = process.env.CLOUDINARY_API_KEY;
  private readonly apiSecret = process.env.CLOUDINARY_API_SECRET;

  private assertConfig() {
    if (!this.cloudName || !this.apiKey || !this.apiSecret) {
      throw new InternalServerErrorException(
        'Cloudinary config missing. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET',
      );
    }
  }

  async uploadFile(file: UploadFile, folder: string) {
    this.assertConfig();
    if (!file?.buffer?.length) {
      throw new InternalServerErrorException('Invalid upload file');
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const signatureBase = `folder=${folder}&timestamp=${timestamp}${this.apiSecret}`;
    const signature = createHash('sha1').update(signatureBase).digest('hex');

    const form = new FormData();
    const bytes = Uint8Array.from(file.buffer);
    form.append('file', new Blob([bytes]), file.originalname);
    form.append('api_key', this.apiKey as string);
    form.append('timestamp', String(timestamp));
    form.append('folder', folder);
    form.append('signature', signature);

    const endpoint = `https://api.cloudinary.com/v1_1/${this.cloudName}/auto/upload`;
    const response = await fetch(endpoint, {
      method: 'POST',
      body: form,
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Cloud upload failed for ${folder}: ${errorText}`);
      throw new InternalServerErrorException(`Cloud upload failed: ${errorText}`);
    }

    const result = (await response.json()) as { secure_url?: string };
    if (!result.secure_url) {
      throw new InternalServerErrorException('Cloud upload succeeded without secure_url');
    }

    this.logger.log(`Uploaded file to ${folder}`);
    return result.secure_url;
  }
}
