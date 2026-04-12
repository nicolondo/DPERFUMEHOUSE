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
import { LoginDto, RegisterDto, ForgotPasswordDto, ResetPasswordDto, GoogleAuthDto, AppleAuthDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { EmailService } from '../email/email.service';
import { OAuth2Client } from 'google-auth-library';
import * as jose from 'jose';

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

    const frontendUrl = this.configService.get<string>('SELLER_APP_URL', 'http://localhost:3000');
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    await this.emailService.send(
      user.email,
      'Restablecer contraseña - D Perfume House',
      `<!DOCTYPE html>
      <html xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="light only">
        <meta name="supported-color-schemes" content="light only">
        <style>
          :root { color-scheme: light only; }
          body { margin: 0; padding: 0; font-family: 'Outfit', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f0b05 !important; }
        </style>
      </head>
      <body style="margin:0;padding:0;background-color:#0f0b05;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#0f0b05;">
          <tr><td align="center" style="padding:24px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="620" style="max-width:620px;width:100%;background-color:#16110a;">
              <!-- Header -->
              <tr><td align="center" style="padding:30px 32px 20px;background-color:#16110a;">
                <img src="${frontendUrl}/icons/logo-email.png" alt="D Perfume House" width="320" style="display:block;width:320px;max-width:80%;height:auto;" />
                <p style="margin:12px 0 0 0;color:#bfa685;letter-spacing:2px;font-size:11px;text-transform:uppercase;">Seguridad de tu cuenta</p>
              </td></tr>
              <!-- Content -->
              <tr><td style="padding:28px 32px 14px;color:#f4ece1;background-color:#16110a;">
                <span style="display:inline-block;margin-bottom:14px;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#ffdca7;border:1px solid #7a5b2f;background-color:rgba(196,148,77,.14);">🔐 Restablecer contraseña</span>
                <p style="margin:0 0 12px 0;font-size:25px;line-height:1.2;color:#fff7eb;font-weight:700;">Hola ${user.name}</p>
                <p style="margin:0 0 10px 0;font-size:15px;color:#d6c3a8;">
                  Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong style="color:#fff7eb;">D Perfume House</strong>.
                </p>
                <!-- Info card -->
                <div style="margin:22px 0;border:1px solid #3b2c17;border-radius:12px;background-color:#1e160d;padding:20px;text-align:center;">
                  <p style="margin:0 0 6px 0;color:#9c8568;font-size:12px;text-transform:uppercase;letter-spacing:1px;">⏱ Tiempo de expiración</p>
                  <p style="margin:0;font-size:24px;font-weight:800;color:#ffdca7;letter-spacing:1px;">1 hora</p>
                </div>
                <p style="margin:0 0 20px 0;font-size:15px;color:#d6c3a8;">
                  Haz clic en el botón para crear tu nueva contraseña:
                </p>
                <!-- CTA Button -->
                <div style="text-align:center;margin:0 0 24px 0;">
                  <a href="${resetUrl}" style="display:inline-block;background-color:#e94560;color:#ffffff;padding:16px 40px;text-decoration:none;border-radius:999px;font-weight:700;font-size:16px;letter-spacing:.5px;">Restablecer Contraseña</a>
                </div>
                <p style="margin:0 0 10px 0;font-size:13px;color:#9c8568;">
                  Si el botón no funciona, copia y pega este enlace en tu navegador:
                </p>
                <p style="margin:0 0 20px 0;word-break:break-all;font-size:12px;color:#7a5b2f;">${resetUrl}</p>
                <div style="border-top:1px solid #3b2c17;padding-top:16px;margin-top:10px;">
                  <p style="margin:0;font-size:13px;color:#9c8568;">
                    Si no solicitaste este cambio, puedes ignorar este correo. No se realizará ningún cambio en tu cuenta.
                  </p>
                </div>
              </td></tr>
              <!-- Footer -->
              <tr><td style="padding:18px 32px 24px;color:#9c8568;font-size:12px;text-align:center;background-color:#16110a;">
                <p style="margin:4px 0;"><strong>D Perfume House</strong></p>
                <p style="margin:4px 0;">&copy; ${new Date().getFullYear()} Todos los derechos reservados.</p>
              </td></tr>
            </table>
          </td></tr>
        </table>
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

  async appleLogin(dto: AppleAuthDto) {
    const clientId = this.configService.get<string>('APPLE_CLIENT_ID');
    if (!clientId) {
      throw new BadRequestException('Apple authentication is not configured');
    }

    // Verify Apple's id_token using Apple's JWKS
    let payload: jose.JWTPayload;
    try {
      const JWKS = jose.createRemoteJWKSet(
        new URL('https://appleid.apple.com/auth/keys'),
      );
      const { payload: verified } = await jose.jwtVerify(dto.idToken, JWKS, {
        issuer: 'https://appleid.apple.com',
        audience: clientId,
      });
      payload = verified;
    } catch {
      throw new UnauthorizedException('Token de Apple inválido');
    }

    const appleId = payload.sub;
    const email = payload.email as string | undefined;

    if (!appleId || !email) {
      throw new UnauthorizedException('Token de Apple inválido — falta email');
    }

    // Check if user exists by email or appleId
    let user = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { appleId }] },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        pendingApproval: true,
        canManageSellers: true,
        odooCompanyId: true,
        appleId: true,
      },
    });

    if (user) {
      // Link Apple account if not yet linked
      if (!user.appleId) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { appleId },
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
        name: dto.name || email.split('@')[0],
        appleId,
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
