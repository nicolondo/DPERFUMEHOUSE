import { Module } from '@nestjs/common';
import { QuestionnaireQuestionsController } from './questionnaire-questions.controller';
import { QuestionnaireQuestionsService } from './questionnaire-questions.service';

@Module({
  controllers: [QuestionnaireQuestionsController],
  providers: [QuestionnaireQuestionsService],
  exports: [QuestionnaireQuestionsService],
})
export class QuestionnaireQuestionsModule {}
