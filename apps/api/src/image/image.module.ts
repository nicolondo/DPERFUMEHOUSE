import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ImageService } from './image.service';
import { ImageController } from './image.controller';
import { ImageProcessor } from './image.processor';

@Module({
  imports: [ConfigModule],
  controllers: [ImageController],
  providers: [ImageService, ImageProcessor],
  exports: [ImageService],
})
export class ImageModule {}
