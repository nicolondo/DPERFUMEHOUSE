import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto, ForgotPasswordDto, ResetPasswordDto, GoogleAuthDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { EmailService } from '../email/email.service';
import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        passwordHash: true,
        isActive: true,
        pendingApproval: true,
        canManageSellers: true,
        odooCompanyId: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      if (user.pendingApproval) {
        throw new ForbiddenException('Tu solicitud de registro está pendiente de aprobación por el administrador');
      }
      throw new ForbiddenException('Tu cuenta ha sido desactivada. Contacta al administrador');
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      canManageSellers: user.canManageSellers,
      odooCompanyId: user.odooCompanyId,
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
      odooCompanyId: user.odooCompanyId ?? undefined,
    });

    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        canManageSellers: user.canManageSellers,
      },
    };
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        refreshToken: true,
        isActive: true,
        canManageSellers: true,
        odooCompanyId: true,
      },
    });

    if (!user || !user.isActive || !user.refreshToken) {
      throw new ForbiddenException('Access denied');
    }

    const refreshTokenValid = await bcrypt.compare(
      refreshToken,
      user.refreshToken,
    );
    if (!refreshTokenValid) {
      throw new ForbiddenException('Invalid refresh token');
    }

    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
      odooCompanyId: user.odooCompanyId ?? undefined,
    });

    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        canManageSellers: user.canManageSellers,
      },
    };
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Este email ya está registrado');
    }

    if (dto.phone) {
      const phoneExists = await this.prisma.user.findFirst({
        where: { phone: dto.phone },
      });
      if (phoneExists) {
        throw new ConflictException('Este teléfono ya está registrado');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        phone: dto.phone,
        role: 'SELLER_L1',
        isActive: false,
        pendingApproval: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    await this.emailService.sendRegistrationRequestReceived(
      user.email,
      user.name,
    );

    return { user, message: 'Solicitud enviada. El administrador revisará tu cuenta.' };
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, name: true, email: true },
    });

    // Always return same message to prevent email enumeration
    if (!user) {
      return { message: 'Si el email existe, recibirás un enlace para restablecer tu contraseña.' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetToken: hashedToken, resetTokenExpiry: expiry },
    });

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    await this.emailService.send(
      user.email,
      'Restablecer contraseña - D Perfume House',
      `<!DOCTYPE html>
      <html>
      <head><meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
          .header { background-color: #1a1a2e; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .btn { display: inline-block; background-color: #e94560; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
          .footer { background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; }
        </style>
      </head>
      <body>
        <div class="header"><h1>D Perfume House</h1></div>
        <div class="content">
          <p>Hola ${user.name},</p>
          <p>Recibimos una solicitud para restablecer tu contraseña.</p>
          <p style="text-align: center;">
            <a href="${resetUrl}" class="btn">Restablecer Contraseña</a>
          </p>
          <p>Este enlace expira en <strong>1 hora</strong>.</p>
          <p>Si no solicitaste este cambio, ignora este correo.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} D Perfume House. Todos los derechos reservados.</p>
        </div>
      </body>
      </html>`,
    );

    return { message: 'Si el email existe, recibirás un enlace para restablecer tu contraseña.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const hashedToken = crypto.createHash('sha256').update(dto.token).digest('hex');

    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: hashedToken,
        resetTokenExpiry: { gt: new Date() },
      },
      select: { id: true },
    });

    if (!user) {
      throw new BadRequestException('El enlace es inválido o ha expirado.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return { message: 'Contraseña actualizada exitosamente.' };
  }

  async googleLogin(dto: GoogleAuthDto) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      throw new BadRequestException('Google authentication is not configured');
    }

    const client = new OAuth2Client(clientId);
    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken: dto.credential,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Token de Google inválido');
    }

    if (!payload || !payload.email) {
      throw new UnauthorizedException('Token de Google inválido');
    }

    const { email, name, sub: googleId } = payload;

    // Check if user exists by email or googleId
    let user = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { googleId }] },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        pendingApproval: true,
        canManageSellers: true,
        odooCompanyId: true,
        googleId: true,
      },
    });

    if (user) {
      // Link Google account if not yet linked
      if (!user.googleId) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { googleId },
        });
      }

      if (!user.isActive) {
        if (user.pendingApproval) {
          throw new ForbiddenException('Tu solicitud de registro está pendiente de aprobación por el administrador');
        }
        throw new ForbiddenException('Tu cuenta ha sido desactivada. Contacta al administrador');
      }

      const tokens = await this.generateTokens({
        sub: user.id,
        email: user.email,
        role: user.role,
        odooCompanyId: user.odooCompanyId ?? undefined,
      });

      await this.updateRefreshToken(user.id, tokens.refreshToken);

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          canManageSellers: user.canManageSellers,
        },
      };
    }

    // New user — register with pending approval
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(randomPassword, 12);

    const newUser = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name || email.split('@')[0],
        googleId,
        role: 'SELLER_L1',
        isActive: false,
        pendingApproval: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    await this.emailService.sendRegistrationRequestReceived(
      newUser.email,
      newUser.name,
    );

    return {
      pendingApproval: true,
      message: 'Solicitud enviada. El administrador revisará tu cuenta.',
      user: { id: newUser.id, email: newUser.email, name: newUser.name },
    };
  }

  private async generateTokens(payload: JwtPayload) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async updateRefreshToken(userId: string, refreshToken: string) {
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hashedRefreshToken },
    });
  }
}
