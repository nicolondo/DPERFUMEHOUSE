import {
  Controller,
  Post,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { IsString, IsOptional } from 'class-validator';

class RegisterTokenDto {
  @IsString()
  token: string;

  @IsOptional()
  @IsString()
  device?: string;
}

class RemoveTokenDto {
  @IsString()
  token: string;
}

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('register-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register a push notification token' })
  async registerToken(
    @CurrentUser() user: { sub: string },
    @Body() dto: RegisterTokenDto,
  ) {
    await this.notificationsService.registerToken(user.sub, dto.token, dto.device);
    return { success: true };
  }

  @Delete('remove-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a push notification token' })
  async removeToken(
    @CurrentUser() user: { sub: string },
    @Body() dto: RemoveTokenDto,
  ) {
    await this.notificationsService.removeToken(user.sub, dto.token);
    return { success: true };
  }

  @Post('test/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a test push notification (admin only)' })
  async sendTest(
    @Param('userId') userId: string,
    @Body() body: { title?: string; body?: string },
  ) {
    await this.notificationsService.sendToUser(
      userId,
      body.title || '🧪 Prueba',
      body.body || 'Las notificaciones push funcionan correctamente.',
      { type: 'test' },
      '/dashboard',
    );
    return { success: true };
  }
}
