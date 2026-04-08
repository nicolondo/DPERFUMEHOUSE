import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { QuestionnaireQuestionsService } from './questionnaire-questions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('questionnaire-questions')
export class QuestionnaireQuestionsController {
  constructor(private readonly service: QuestionnaireQuestionsService) {}

  // Public — used by questionnaire pages
  @Get('public')
  async getPublicQuestions() {
    return this.service.findActive();
  }

  // Admin — all questions including inactive
  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() body: any) {
    return this.service.create(body);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Post('reorder')
  @UseGuards(JwtAuthGuard)
  async reorder(@Body() body: { ids: string[] }) {
    return this.service.reorder(body.ids);
  }
}
