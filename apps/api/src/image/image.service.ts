import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { IMAGE } from '@dperfumehouse/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);
  private readonly storageType: string;
  private readonly uploadDir: string;
  private readonly baseUrl: string;
  private readonly s3Bucket: string;
  private readonly s3Region: string;
  private readonly s3Endpoint: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.storageType = this.configService.get<string>('STORAGE_TYPE', 'local');
    this.uploadDir = this.configService.get<string>(
      'UPLOAD_DIR',
      path.join(process.cwd(), 'uploads'),
    );
    this.baseUrl = this.configService.get<string>(
      'APP_URL',
      'http://localhost:3001',
    );
    this.s3Bucket = this.configService.get<string>('S3_BUCKET', '');
    this.s3Region = this.configService.get<string>('S3_REGION', 'us-east-1');
    this.s3Endpoint = this.configService.get<string>('S3_ENDPOINT', '');
  }

  /**
   * Process an uploaded image: resize to max width and create thumbnail.
   */
  async processImage(
    buffer: Buffer,
    filename: string,
  ): Promise<{ url: string; thumbnailUrl: string }> {
    const ext = path.extname(filename).toLowerCase() || '.jpg';
    const baseName = uuidv4();
    const processedFilename = `${baseName}${ext}`;
    const thumbnailFilename = `${baseName}_thumb${ext}`;

    // Process main image
    const processedBuffer = await this.resizeImage(buffer);

    // Create thumbnail
    const thumbnailBuffer = await this.createThumbnail(buffer);

    const imagePath = `products/${processedFilename}`;
    const thumbPath = `products/${thumbnailFilename}`;

    let url: string;
    let thumbnailUrl: string;

    if (this.storageType === 's3') {
      url = await this.saveS3(processedBuffer, imagePath);
      thumbnailUrl = await this.saveS3(thumbnailBuffer, thumbPath);
    } else {
      url = await this.saveLocal(processedBuffer, imagePath);
      thumbnailUrl = await this.saveLocal(thumbnailBuffer, thumbPath);
    }

    this.logger.log(`Processed image: ${url}`);
    return { url, thumbnailUrl };
  }

  /**
   * Process a product image and store with variant-based path.
   */
  async processProductImage(
    buffer: Buffer,
    filename: string,
    variantId: string,
  ): Promise<{ url: string; thumbnailUrl: string }> {
    const ext = path.extname(filename).toLowerCase() || '.jpg';
    const baseName = uuidv4();
    const processedFilename = `${baseName}${ext}`;
    const thumbnailFilename = `${baseName}_thumb${ext}`;

    const processedBuffer = await this.resizeImage(buffer);
    const thumbnailBuffer = await this.createThumbnail(buffer);

    const imagePath = `products/${variantId}/${processedFilename}`;
    const thumbPath = `products/${variantId}/${thumbnailFilename}`;

    let url: string;
    let thumbnailUrl: string;

    if (this.storageType === 's3') {
      url = await this.saveS3(processedBuffer, imagePath);
      thumbnailUrl = await this.saveS3(thumbnailBuffer, thumbPath);
    } else {
      url = await this.saveLocal(processedBuffer, imagePath);
      thumbnailUrl = await this.saveLocal(thumbnailBuffer, thumbPath);
    }

    this.logger.log(`Processed product image for variant ${variantId}: ${url}`);
    return { url, thumbnailUrl };
  }

  /**
   * Process a certificate image (bank certificate upload).
   */
  async processCertificateImage(
    buffer: Buffer,
    filename: string,
    userId: string,
  ): Promise<string> {
    const ext = path.extname(filename).toLowerCase() || '.jpg';
    const baseName = uuidv4();
    const processedFilename = `${baseName}${ext}`;

    const processedBuffer = await this.resizeImage(buffer);
    const imagePath = `certificates/${userId}/${processedFilename}`;

    let url: string;

    if (this.storageType === 's3') {
      url = await this.saveS3(processedBuffer, imagePath);
    } else {
      url = await this.saveLocal(processedBuffer, imagePath);
    }

    this.logger.log(`Processed certificate for user ${userId}: ${url}`);
    return url;
  }

  /**
   * Process an image from Odoo base64 data.
   */
  async processOdooImage(
    base64Data: string,
    variantId: string,
  ): Promise<{ url: string; thumbnailUrl: string }> {
    const buffer = Buffer.from(base64Data, 'base64');

    // Detect format from buffer
    const metadata = await sharp(buffer).metadata();
    const ext = metadata.format ? `.${metadata.format}` : '.jpg';
    const filename = `odoo_${Date.now()}${ext}`;

    return this.processProductImage(buffer, filename, variantId);
  }

  /**
   * Delete an image and its thumbnail from storage.
   */
  async deleteImage(url: string): Promise<void> {
    try {
      if (this.storageType === 's3') {
        await this.deleteFromS3(url);
      } else {
        await this.deleteLocal(url);
      }
      this.logger.log(`Deleted image: ${url}`);
    } catch (error) {
      this.logger.error(`Failed to delete image ${url}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a product image record and its files.
   */
  async deleteProductImage(imageId: string): Promise<void> {
    const image = await this.prisma.productImage.findUnique({
      where: { id: imageId },
    });

    if (!image) {
      throw new NotFoundException(`Image with ID ${imageId} not found`);
    }

    // Delete files
    await this.deleteImage(image.url);
    if (image.thumbnailUrl) {
      await this.deleteImage(image.thumbnailUrl);
    }

    // Delete database record
    await this.prisma.productImage.delete({ where: { id: imageId } });

    this.logger.log(`Deleted product image record ${imageId}`);
  }

  /**
   * Resize image to max width, preserving aspect ratio.
   */
  private async resizeImage(buffer: Buffer): Promise<Buffer> {
    const metadata = await sharp(buffer).metadata();

    let pipeline = sharp(buffer);

    if (metadata.width && metadata.width > IMAGE.MAX_WIDTH) {
      pipeline = pipeline.resize(IMAGE.MAX_WIDTH, null, {
        withoutEnlargement: true,
        fit: 'inside',
      });
    }

    // Output as the same format, optimize quality
    if (metadata.format === 'png') {
      pipeline = pipeline.png({ quality: IMAGE.QUALITY });
    } else if (metadata.format === 'webp') {
      pipeline = pipeline.webp({ quality: IMAGE.QUALITY });
    } else {
      pipeline = pipeline.jpeg({ quality: IMAGE.QUALITY, mozjpeg: true });
    }

    return pipeline.toBuffer();
  }

  /**
   * Create a thumbnail (300px width).
   */
  private async createThumbnail(buffer: Buffer): Promise<Buffer> {
    const metadata = await sharp(buffer).metadata();

    let pipeline = sharp(buffer).resize(IMAGE.THUMBNAIL_WIDTH, null, {
      withoutEnlargement: true,
      fit: 'inside',
    });

    if (metadata.format === 'png') {
      pipeline = pipeline.png({ quality: IMAGE.THUMBNAIL_QUALITY });
    } else if (metadata.format === 'webp') {
      pipeline = pipeline.webp({ quality: IMAGE.THUMBNAIL_QUALITY });
    } else {
      pipeline = pipeline.jpeg({
        quality: IMAGE.THUMBNAIL_QUALITY,
        mozjpeg: true,
      });
    }

    return pipeline.toBuffer();
  }

  /**
   * Save buffer to local filesystem.
   */
  private async saveLocal(buffer: Buffer, filePath: string): Promise<string> {
    const fullPath = path.join(this.uploadDir, filePath);
    const dir = path.dirname(fullPath);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, buffer);

    return `${this.baseUrl}/uploads/${filePath}`;
  }

  /**
   * Save buffer to S3-compatible storage.
   */
  private async saveS3(buffer: Buffer, filePath: string): Promise<string> {
    try {
      // Dynamic import to avoid requiring AWS SDK when using local storage
      // @ts-ignore - @aws-sdk/client-s3 is an optional dependency
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

      const clientConfig: any = {
        region: this.s3Region,
      };

      if (this.s3Endpoint) {
        clientConfig.endpoint = this.s3Endpoint;
        clientConfig.forcePathStyle = true;
      }

      const s3 = new S3Client(clientConfig);

      const ext = path.extname(filePath).toLowerCase();
      const contentTypeMap: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
      };

      const command = new PutObjectCommand({
        Bucket: this.s3Bucket,
        Key: filePath,
        Body: buffer,
        ContentType: contentTypeMap[ext] || 'image/jpeg',
        CacheControl: 'public, max-age=31536000',
      });

      await s3.send(command);

      if (this.s3Endpoint) {
        return `${this.s3Endpoint}/${this.s3Bucket}/${filePath}`;
      }

      return `https://${this.s3Bucket}.s3.${this.s3Region}.amazonaws.com/${filePath}`;
    } catch (error) {
      this.logger.error(`S3 upload failed for ${filePath}: ${error.message}`);
      throw new BadRequestException('Failed to upload image to S3');
    }
  }

  /**
   * Delete file from local filesystem.
   */
  private async deleteLocal(url: string): Promise<void> {
    const relativePath = url.replace(`${this.baseUrl}/uploads/`, '');
    const fullPath = path.join(this.uploadDir, relativePath);

    try {
      await fs.unlink(fullPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      this.logger.warn(`File not found for deletion: ${fullPath}`);
    }
  }

  /**
   * Delete file from S3-compatible storage.
   */
  private async deleteFromS3(url: string): Promise<void> {
    try {
      // @ts-ignore - @aws-sdk/client-s3 is an optional dependency
      const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');

      const clientConfig: any = {
        region: this.s3Region,
      };

      if (this.s3Endpoint) {
        clientConfig.endpoint = this.s3Endpoint;
        clientConfig.forcePathStyle = true;
      }

      const s3 = new S3Client(clientConfig);

      // Extract key from URL
      let key: string;
      if (this.s3Endpoint) {
        key = url.replace(`${this.s3Endpoint}/${this.s3Bucket}/`, '');
      } else {
        key = url.replace(
          `https://${this.s3Bucket}.s3.${this.s3Region}.amazonaws.com/`,
          '',
        );
      }

      const command = new DeleteObjectCommand({
        Bucket: this.s3Bucket,
        Key: key,
      });

      await s3.send(command);
    } catch (error) {
      this.logger.error(`S3 deletion failed for ${url}: ${error.message}`);
      throw error;
    }
  }
}
