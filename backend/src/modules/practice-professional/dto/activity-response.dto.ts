import { ApiProperty } from '@nestjs/swagger';
import { ActivityStatus } from '../schemas/practice-activity.schema';

export class ActivityResponseDto {
  @ApiProperty({ description: 'ID de la actividad' })
  _id: string;

  @ApiProperty({ description: 'ID de la aplicación asociada' })
  applicationId: string;

  @ApiProperty({ description: 'Descripción de la actividad' })
  description: string;

  @ApiProperty({ description: 'Fecha en que se realizó la actividad' })
  activityDate: Date;

  @ApiProperty({ description: 'Número de horas dedicadas' })
  hours: number;

  @ApiProperty({ description: 'Maquinaria o herramienta utilizada' })
  equipmentOrTool: string;

  @ApiProperty({
    description: 'Estado de la actividad',
    enum: ActivityStatus,
  })
  status: ActivityStatus;

  @ApiProperty({
    description: 'Razón de rechazo (si aplica)',
    required: false,
  })
  rejectionReason?: string;

  @ApiProperty({ description: 'Fecha de creación' })
  createdAt: Date;

  @ApiProperty({ description: 'Fecha de actualización' })
  updatedAt: Date;
}

