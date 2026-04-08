import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class QuestionnaireQuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.questionnaireQuestion.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findActive() {
    return this.prisma.questionnaireQuestion.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOne(id: string) {
    const q = await this.prisma.questionnaireQuestion.findUnique({ where: { id } });
    if (!q) throw new NotFoundException('Question not found');
    return q;
  }

  async create(data: {
    questionId: string;
    question: string;
    type: string;
    options?: any[];
    placeholder?: string;
    optional?: boolean;
    showIf?: any;
    sortOrder: number;
  }) {
    return this.prisma.questionnaireQuestion.create({ data: data as any });
  }

  async update(id: string, data: Partial<{
    questionId: string;
    question: string;
    type: string;
    options: any[];
    placeholder: string;
    optional: boolean;
    showIf: any;
    sortOrder: number;
    isActive: boolean;
  }>) {
    await this.findOne(id);
    return this.prisma.questionnaireQuestion.update({
      where: { id },
      data: data as any,
    });
  }

  async delete(id: string) {
    await this.findOne(id);
    return this.prisma.questionnaireQuestion.delete({ where: { id } });
  }

  async reorder(ids: string[]) {
    const updates = ids.map((id, index) =>
      this.prisma.questionnaireQuestion.update({
        where: { id },
        data: { sortOrder: index },
      }),
    );
    await this.prisma.$transaction(updates);
    return { success: true };
  }
}
