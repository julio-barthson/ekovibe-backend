import { IsIn } from 'class-validator';

export class SubmitRsvpDto {
  @IsIn(['confirm', 'decline'])
  action: 'confirm' | 'decline';
}
