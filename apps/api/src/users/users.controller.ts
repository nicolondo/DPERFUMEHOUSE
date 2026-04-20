import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';
import { CertificateAnalyzerService } from './certificate-analyzer.service';
import { CreateUserDto, CreateSubSellerDto } from './dto/create-user.dto';
import { UpdateUserDto, UpdateBankInfoDto, ChangePasswordDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../auth/decorators/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly certificateAnalyzerService: CertificateAnalyzerService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new user (admin only)' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List all users (admin only)' })
  @ApiQuery({ name: 'role', enum: UserRole, required: false })
  @ApiQuery({ name: 'parentId', required: false })
  @ApiQuery({ name: 'isActive', type: Boolean, required: false })
  @ApiQuery({ name: 'pendingApproval', type: Boolean, required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'pageSize', type: Number, required: false })
  @ApiQuery({ name: 'search', required: false })
  async findAll(
    @Query('role') role?: UserRole,
    @Query('parentId') parentId?: string,
    @Query('isActive') isActive?: string,
    @Query('pendingApproval') pendingApproval?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    return this.usersService.findAll({
      role,
      parentId,
      isActive: isActive === undefined ? undefined : isActive === 'true',
      pendingApproval: pendingApproval === undefined ? undefined : pendingApproval === 'true',
      page: page ? parseInt(page, 10) : 1,
      limit: pageSize ? parseInt(pageSize, 10) : 20,
      search,
    });
  }

  @Get('sellers')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List all sellers (admin only)' })
  async findSellers() {
    const result = await this.usersService.findAll({
      role: undefined,
      limit: 200,
    });
    // Filter only sellers
    return result.data.filter(
      (u: any) => u.role === 'SELLER_L1' || u.role === 'SELLER_L2',
    );
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@CurrentUser() user: CurrentUserPayload) {
    return this.usersService.getProfile(user.sub);
  }

  @Put('me/bank-info')
  @ApiOperation({ summary: 'Update current user bank/payment info' })
  async updateMyBankInfo(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateBankInfoDto,
  ) {
    return this.usersService.updateBankInfo(user.sub, dto);
  }

  @Post('me/analyze-certificate')
  @ApiOperation({ summary: 'Upload and analyze bank certificate with AI' })
  @UseInterceptors(FileInterceptor('file'))
  async analyzeCertificate(
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No se subio ningun archivo');
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('Formato no soportado. Use PDF, JPG o PNG.');
    }

    // Save file to disk
    const ext = file.originalname.split('.').pop() || 'pdf';
    const filename = `cert_${user.sub}_${uuidv4()}.${ext}`;
    const uploadsDir = path.join(process.cwd(), 'uploads', 'certificates');
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(path.join(uploadsDir, filename), file.buffer);
    const bankCertificateUrl = `/uploads/certificates/${filename}`;

    const result = await this.certificateAnalyzerService.analyzeCertificate(
      file.buffer,
      file.mimetype,
    );

    // Auto-save the extracted data + file URL to the user profile
    await this.usersService.updateBankInfo(user.sub, {
      bankName: result.bankName,
      bankAccountType: result.bankAccountType,
      bankAccountNumber: result.bankAccountNumber,
      bankAccountHolder: result.bankAccountHolder,
      bankCertificateUrl,
    });

    return { ...result, bankCertificateUrl };
  }

  @Patch('me/password')
  @ApiOperation({ summary: 'Change current user password' })
  async changeMyPassword(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(user.sub, dto);
  }

  @Get('me/downline')
  @ApiOperation({ summary: 'Get current user direct downline sellers' })
  async getMyDownline(@CurrentUser() user: CurrentUserPayload) {
    return this.usersService.getDownline(user.sub);
  }

  @Get('me/downline/:id')
  @ApiOperation({ summary: 'Get a specific downline seller with stats' })
  async getDownlineSeller(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usersService.getDownlineSeller(user.sub, id);
  }

  @Post('me/sellers')
  @ApiOperation({ summary: 'Create a sub-seller under current user' })
  @ApiResponse({ status: 201, description: 'Sub-seller created successfully' })
  async createSubSeller(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateSubSellerDto,
  ) {
    return this.usersService.createSubSeller(user.sub, dto);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get a user by ID (admin only)' })
  @ApiResponse({ status: 200, description: 'User found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a user (admin only)' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(id, dto);
  }

  @Patch(':id/toggle-status')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Toggle user active status (admin only)' })
  async toggleStatus(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.usersService.findOne(id);
    const payload: any = { isActive: !user.isActive };
    if (!user.isActive && user.pendingApproval) {
      payload.pendingApproval = false;
    }
    return this.usersService.update(id, payload);
  }

  @Put(':id/bank-info')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update user bank/payment info (admin only)' })
  async updateBankInfo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBankInfoDto,
  ) {
    return this.usersService.updateBankInfo(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete user (admin only)' })
  async deleteUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.delete(id);
  }
}
