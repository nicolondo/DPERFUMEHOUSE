import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiOperation,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../auth/decorators/current-user.decorator';
import { ImageService } from './image.service';
import { PrismaService } from '../prisma/prisma.service';
import { IMAGE } from '@dperfumehouse/config';
import { UserRole } from '@prisma/client';

const MAX_FILE_SIZE = IMAGE.MAX_SIZE_MB * 1024 * 1024;

@ApiTags('Images')
@ApiBearerAuth('access-token')
@Controller('images')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ImageController {
  private readonly logger = new Logger(ImageController.name);

  constructor(
    private readonly imageService: ImageService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a product image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        variantId: { type: 'string' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        if (IMAGE.ALLOWED_MIME_TYPES.includes(file.mimetype as any)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              `Invalid file type. Allowed: ${IMAGE.ALLOWED_MIME_TYPES.join(', ')}`,
            ),
            false,
          );
        }
      },
    }),
  )
  async uploadProductImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('variantId') variantId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (!variantId) {
      throw new BadRequestException('variantId is required');
    }

    this.logger.log(
      `User ${user.sub} uploading product image for variant ${variantId}: ${file.originalname}`,
    );

    const { url, thumbnailUrl } =
      await this.imageService.processProductImage(
        file.buffer,
        file.originalname,
        variantId,
      );

    const existingImage = await this.prisma.productImage.findFirst({
      where: { variantId },
      orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    if (existingImage) {
      const previousUrl = existingImage.url;
      const previousThumbnailUrl = existingImage.thumbnailUrl;

      const image = await this.prisma.productImage.update({
        where: { id: existingImage.id },
        data: {
          url,
          thumbnailUrl,
        },
      });

      // Try to clean up previous files but do not fail the request if cleanup fails.
      if (previousUrl !== url) {
        this.imageService.deleteImage(previousUrl).catch((error) => {
          this.logger.warn(`Failed to delete previous image ${previousUrl}: ${error.message}`);
        });
      }
      if (previousThumbnailUrl && previousThumbnailUrl !== thumbnailUrl) {
        this.imageService.deleteImage(previousThumbnailUrl).catch((error) => {
          this.logger.warn(`Failed to delete previous thumbnail ${previousThumbnailUrl}: ${error.message}`);
        });
      }

      return {
        success: true,
        data: image,
      };
    }

    // Count existing images to determine sortOrder and isPrimary
    const existingCount = await this.prisma.productImage.count({
      where: { variantId },
    });

    const image = await this.prisma.productImage.create({
      data: {
        variantId,
        url,
        thumbnailUrl,
        isPrimary: existingCount === 0,
        sortOrder: existingCount,
      },
    });

    return {
      success: true,
      data: image,
    };
  }

  @Post('upload-certificate')
  @ApiOperation({ summary: 'Upload a bank certificate image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        const allowed = [...IMAGE.ALLOWED_MIME_TYPES, 'application/pdf'];
        if (allowed.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              `Invalid file type. Allowed: ${allowed.join(', ')}`,
            ),
            false,
          );
        }
      },
    }),
  )
  async uploadCertificate(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    this.logger.log(
      `User ${user.sub} uploading bank certificate: ${file.originalname}`,
    );

    const url = await this.imageService.processCertificateImage(
      file.buffer,
      file.originalname,
      user.sub,
    );

    return {
      success: true,
      data: { url },
    };
  }

  @Patch(':id/primary')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Set an image as the primary image for its variant' })
  async setPrimaryImage(@Param('id', ParseUUIDPipe) id: string) {
    const image = await this.prisma.productImage.findUnique({
      where: { id },
    });

    if (!image) {
      throw new BadRequestException(`Image with ID ${id} not found`);
    }

    // Unset any existing primary image for this variant
    await this.prisma.productImage.updateMany({
      where: { variantId: image.variantId, isPrimary: true },
      data: { isPrimary: false },
    });

    // Set this image as primary
    const updated = await this.prisma.productImage.update({
      where: { id },
      data: { isPrimary: true },
    });

    return {
      success: true,
      data: updated,
    };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a product image (admin only)' })
  async deleteImage(@Param('id', ParseUUIDPipe) id: string) {
    await this.imageService.deleteProductImage(id);

    return {
      success: true,
      message: 'Image deleted successfully',
    };
  }
}
