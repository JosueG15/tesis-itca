import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  PracticeActivity,
  PracticeActivityDocument,
  ActivityStatus,
} from './schemas/practice-activity.schema';
import {
  Application,
  ApplicationDocument,
  ApplicationStatus,
} from '@/modules/opportunities/schemas/application.schema';
import {
  Opportunity,
  OpportunityDocument,
} from '@/modules/opportunities/schemas/opportunity.schema';
import {
  Student,
  StudentDocument,
} from '@/modules/students/schemas/student.schema';
import { User, UserDocument } from '@/modules/auth/schemas/user.schema';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityStatusDto } from './dto/update-activity-status.dto';
import { PracticeProfessionalResponseDto } from './dto/practice-professional-response.dto';
import { ActivityResponseDto } from './dto/activity-response.dto';
import { ActivitiesResponseDto } from './dto/activities-response.dto';
import { PracticeHistoryResponseDto } from './dto/practice-history-response.dto';
import {
  PracticeHistoryItemDto,
  PracticeStatus,
} from './dto/practice-history-item.dto';
import { StudentsService } from '@/modules/students/students.service';

@Injectable()
export class PracticeProfessionalService {
  constructor(
    @InjectModel(PracticeActivity.name)
    private practiceActivityModel: Model<PracticeActivityDocument>,
    @InjectModel(Application.name)
    private applicationModel: Model<ApplicationDocument>,
    @InjectModel(Opportunity.name)
    private opportunityModel: Model<OpportunityDocument>,
    @InjectModel(Student.name)
    private studentModel: Model<StudentDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private studentsService: StudentsService,
  ) {}

  private async getCompanyIdByUserId(userId: string): Promise<string> {
    const user = await this.userModel
      .findById(userId)
      .select('companyId')
      .lean()
      .exec();

    if (!user || !user.companyId) {
      throw new NotFoundException('Usuario de empresa no encontrado');
    }

    return user.companyId.toString();
  }

  async getPracticeProfessional(
    userId: string,
  ): Promise<PracticeProfessionalResponseDto> {
    const acceptedApplication = await this.applicationModel
      .findOne({
        studentId: new Types.ObjectId(userId),
        status: ApplicationStatus.ACCEPTED,
      })
      .populate({
        path: 'opportunityId',
        populate: [
          { path: 'careerId', select: 'name code' },
          { path: 'companyId', select: 'name logo' },
        ],
      })
      .lean()
      .exec();

    if (!acceptedApplication) {
      throw new NotFoundException(
        'No tienes una práctica profesional activa',
      );
    }

    // Obtener todas las actividades para calcular totales (sin paginación para estadísticas)
    const activities = await this.practiceActivityModel
      .find({
        applicationId: acceptedApplication._id,
      })
      .sort({ activityDate: -1, createdAt: -1 })
      .lean()
      .exec();

    const totalHours = activities.reduce(
      (sum, activity) => sum + (activity.hours || 0),
      0,
    );

    const approvedHours = activities
      .filter((activity) => activity.status === ActivityStatus.APPROVED)
      .reduce((sum, activity) => sum + (activity.hours || 0), 0);

    const applicationObj = acceptedApplication as unknown as {
      _id: Types.ObjectId;
      opportunityId: unknown;
      studentId: Types.ObjectId;
      coverLetter?: string;
      status: string;
      rejectionReason?: string;
      finalizedAt?: Date;
      createdAt: Date;
      updatedAt: Date;
    };

    const opportunityIdValue = applicationObj.opportunityId;
    let opportunity: any = null;

    if (opportunityIdValue) {
      if (
        typeof opportunityIdValue === 'object' &&
        opportunityIdValue !== null &&
        '_id' in opportunityIdValue
      ) {
        opportunity = opportunityIdValue;
      } else {
        opportunity = await this.opportunityModel
          .findById(opportunityIdValue)
          .populate('careerId', 'name code')
          .populate('companyId', 'name logo')
          .lean()
          .exec();
      }
    }

    if (!opportunity) {
      throw new NotFoundException('Oportunidad no encontrada');
    }

    const activitiesResponse: ActivityResponseDto[] = activities.map(
      (activity) => {
        const activityObj = activity as unknown as {
          _id: Types.ObjectId;
          applicationId: Types.ObjectId;
          description: string;
          activityDate: Date;
          hours: number;
          equipmentOrTool: string;
          status: ActivityStatus;
          rejectionReason?: string;
          createdAt: Date;
          updatedAt: Date;
        };

        return {
          _id: activityObj._id.toString(),
          applicationId: activityObj.applicationId.toString(),
          description: activityObj.description,
          activityDate: activityObj.activityDate,
          hours: activityObj.hours,
          equipmentOrTool: activityObj.equipmentOrTool,
          status: activityObj.status,
          rejectionReason: activityObj.rejectionReason,
          createdAt: activityObj.createdAt,
          updatedAt: activityObj.updatedAt,
        };
      },
    );

    return {
      application: {
        _id: applicationObj._id.toString(),
        opportunityId:
          typeof opportunity._id === 'string'
            ? opportunity._id
            : opportunity._id.toString(),
        studentId: applicationObj.studentId.toString(),
        coverLetter: applicationObj.coverLetter,
        status: applicationObj.status as ApplicationStatus,
        rejectionReason: applicationObj.rejectionReason,
        finalizedAt: applicationObj.finalizedAt,
        createdAt: applicationObj.createdAt,
        updatedAt: applicationObj.updatedAt,
      },
      opportunity: {
        _id:
          typeof opportunity._id === 'string'
            ? opportunity._id
            : opportunity._id.toString(),
        title: opportunity.title,
        description: opportunity.description,
        activities: opportunity.activities,
        careerId:
          typeof opportunity.careerId === 'object' &&
          opportunity.careerId !== null &&
          '_id' in opportunity.careerId
            ? typeof (opportunity.careerId as { _id: unknown })._id === 'string'
              ? (opportunity.careerId as { _id: string })._id
              : (opportunity.careerId as { _id: Types.ObjectId })._id.toString()
            : typeof opportunity.careerId === 'string'
              ? opportunity.careerId
              : '',
        companyId:
          typeof opportunity.companyId === 'object' &&
          opportunity.companyId !== null &&
          '_id' in opportunity.companyId
            ? typeof (opportunity.companyId as { _id: unknown })._id === 'string'
              ? (opportunity.companyId as { _id: string })._id
              : (opportunity.companyId as { _id: Types.ObjectId })._id.toString()
            : typeof opportunity.companyId === 'string'
              ? opportunity.companyId
              : '',
        responsibleUserId: opportunity.responsibleUserId
          ? typeof opportunity.responsibleUserId === 'string'
            ? opportunity.responsibleUserId
            : opportunity.responsibleUserId.toString()
          : undefined,
        totalHours: opportunity.totalHours,
        availablePositions: opportunity.availablePositions,
        modality: opportunity.modality,
        workType: opportunity.workType,
        expirationDate: opportunity.expirationDate,
        status: opportunity.status,
        isActive: opportunity.isActive,
        shareToken: opportunity.shareToken,
        createdAt: opportunity.createdAt,
        updatedAt: opportunity.updatedAt,
        career:
          opportunity.careerId &&
          typeof opportunity.careerId === 'object' &&
          opportunity.careerId !== null &&
          !(opportunity.careerId instanceof Types.ObjectId) &&
          '_id' in opportunity.careerId &&
          'name' in opportunity.careerId
            ? {
                _id:
                  typeof (opportunity.careerId as { _id: Types.ObjectId | string })
                    ._id === 'string'
                    ? (opportunity.careerId as { _id: string })._id
                    : (
                        opportunity.careerId as { _id: Types.ObjectId }
                      )._id.toString(),
                name:
                  (opportunity.careerId as { name?: string }).name || '',
                code:
                  (opportunity.careerId as { code?: string }).code || '',
              }
            : undefined,
        company:
          opportunity.companyId &&
          typeof opportunity.companyId === 'object' &&
          opportunity.companyId !== null &&
          !(opportunity.companyId instanceof Types.ObjectId) &&
          '_id' in opportunity.companyId &&
          'name' in opportunity.companyId
            ? {
                _id:
                  typeof (
                    opportunity.companyId as { _id: Types.ObjectId | string }
                  )._id === 'string'
                    ? (opportunity.companyId as { _id: string })._id
                    : (
                        opportunity.companyId as { _id: Types.ObjectId }
                      )._id.toString(),
                name:
                  (opportunity.companyId as { name?: string }).name || '',
                logo: (opportunity.companyId as { logo?: string }).logo,
              }
            : undefined,
      },
      activities: activitiesResponse,
      totalHours,
      approvedHours,
      status: applicationObj.finalizedAt
        ? PracticeStatus.FINALIZADA
        : approvedHours >= (opportunity?.totalHours || 0) &&
            (opportunity?.totalHours || 0) > 0
          ? PracticeStatus.FINALIZADA
          : PracticeStatus.EN_CURSO,
    };
  }

  async createActivity(
    userId: string,
    createActivityDto: CreateActivityDto,
  ): Promise<ActivityResponseDto> {
    const acceptedApplication = await this.applicationModel
      .findOne({
        studentId: new Types.ObjectId(userId),
        status: ApplicationStatus.ACCEPTED,
      })
      .exec();

    if (!acceptedApplication) {
      throw new NotFoundException(
        'No tienes una práctica profesional activa',
      );
    }

    const activityDate = new Date(createActivityDto.activityDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (activityDate > today) {
      throw new BadRequestException(
        'La fecha de la actividad no puede ser futura',
      );
    }

    const activity = new this.practiceActivityModel({
      applicationId: acceptedApplication._id,
      description: createActivityDto.description,
      activityDate,
      hours: createActivityDto.hours,
      equipmentOrTool: createActivityDto.equipmentOrTool,
      status: ActivityStatus.PENDING_APPROVAL,
    });

    const savedActivity = await activity.save();

    return {
      _id: savedActivity._id.toString(),
      applicationId: savedActivity.applicationId.toString(),
      description: savedActivity.description,
      activityDate: savedActivity.activityDate,
      hours: savedActivity.hours,
      equipmentOrTool: savedActivity.equipmentOrTool,
      status: savedActivity.status,
      rejectionReason: savedActivity.rejectionReason,
      createdAt: savedActivity.createdAt,
      updatedAt: savedActivity.updatedAt,
    };
  }

  async getActivities(
    userId: string,
    page = 1,
    limit = 20,
  ) {
    const acceptedApplication = await this.applicationModel
      .findOne({
        studentId: new Types.ObjectId(userId),
        status: ApplicationStatus.ACCEPTED,
      })
      .exec();

    if (!acceptedApplication) {
      throw new NotFoundException(
        'No tienes una práctica profesional activa',
      );
    }

    const skip = (page - 1) * limit;

    const [activities, total] = await Promise.all([
      this.practiceActivityModel
        .find({
          applicationId: acceptedApplication._id,
        })
        .sort({ activityDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.practiceActivityModel
        .countDocuments({
          applicationId: acceptedApplication._id,
        })
        .exec(),
    ]);

    const data = activities.map((activity) => {
      const activityObj = activity as unknown as {
        _id: Types.ObjectId;
        applicationId: Types.ObjectId;
        description: string;
        activityDate: Date;
        hours: number;
        equipmentOrTool: string;
        status: ActivityStatus;
        rejectionReason?: string;
        createdAt: Date;
        updatedAt: Date;
      };

      return {
        _id: activityObj._id.toString(),
        applicationId: activityObj.applicationId.toString(),
        description: activityObj.description,
        activityDate: activityObj.activityDate,
        hours: activityObj.hours,
        equipmentOrTool: activityObj.equipmentOrTool,
        status: activityObj.status,
        rejectionReason: activityObj.rejectionReason,
        createdAt: activityObj.createdAt,
        updatedAt: activityObj.updatedAt,
      };
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getStudentActivities(
    studentId: string,
    companyUserId: string,
    page = 1,
    limit = 20,
  ): Promise<ActivitiesResponseDto> {
    // First, try to find the student to get their userId
    let studentUserId: Types.ObjectId | null = null;

    // Try to find by student _id first
    const student = await this.studentModel
      .findById(studentId)
      .select('userId')
      .lean()
      .exec();

    if (student && student.userId) {
      // Convert userId to ObjectId if it's a string
      const userIdValue = student.userId;
      if (userIdValue instanceof Types.ObjectId) {
        studentUserId = userIdValue;
      } else {
        studentUserId = new Types.ObjectId(String(userIdValue));
      }
    } else {
      // If not found, assume studentId is the userId
      try {
        studentUserId = new Types.ObjectId(studentId);
      } catch {
        throw new NotFoundException('Estudiante no encontrado');
      }
    }

    // Find accepted application for the student using userId
    const acceptedApplication = await this.applicationModel
      .findOne({
        studentId: studentUserId,
        status: ApplicationStatus.ACCEPTED,
      })
      .populate({
        path: 'opportunityId',
        select: 'companyId responsibleUserId',
      })
      .lean()
      .exec();

    if (!acceptedApplication) {
      throw new NotFoundException(
        'El estudiante no tiene una práctica profesional activa',
      );
    }

    const opportunity = acceptedApplication.opportunityId as unknown as {
      companyId: Types.ObjectId | string | { _id: Types.ObjectId | string };
      responsibleUserId?: Types.ObjectId | string;
    };

    // Verify that the company user has access to this opportunity
    // Handle companyId - it can be ObjectId, string, or populated object
    let opportunityCompanyId: string;
    if (typeof opportunity.companyId === 'object' && opportunity.companyId !== null && !(opportunity.companyId instanceof Types.ObjectId)) {
      // It's a populated object
      if ('_id' in opportunity.companyId) {
        opportunityCompanyId = opportunity.companyId._id.toString();
      } else {
        opportunityCompanyId = String(opportunity.companyId);
      }
    } else if (opportunity.companyId instanceof Types.ObjectId) {
      // It's an ObjectId
      opportunityCompanyId = opportunity.companyId.toString();
    } else {
      // It's a string
      opportunityCompanyId = opportunity.companyId?.toString() || String(opportunity.companyId);
    }

    const responsibleUserId = opportunity.responsibleUserId?.toString() || opportunity.responsibleUserId?.toString();
    const userCompanyId = await this.getCompanyIdByUserId(companyUserId);

    // Convert both to strings for comparison
    const opportunityCompanyIdStr = String(opportunityCompanyId);
    const userCompanyIdStr = String(userCompanyId);
    const responsibleUserIdStr = responsibleUserId ? String(responsibleUserId) : null;
    const companyUserIdStr = String(companyUserId);

    if (
      opportunityCompanyIdStr !== userCompanyIdStr &&
      (!responsibleUserIdStr || responsibleUserIdStr !== companyUserIdStr)
    ) {
      throw new BadRequestException(
        'No tienes permiso para ver las actividades de este estudiante',
      );
    }

    const skip = (page - 1) * limit;

    const [activities, total] = await Promise.all([
      this.practiceActivityModel
        .find({
          applicationId: acceptedApplication._id,
        })
        .sort({ activityDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.practiceActivityModel
        .countDocuments({
          applicationId: acceptedApplication._id,
        })
        .exec(),
    ]);

    const data = activities.map((activity) => {
      const activityObj = activity as unknown as {
        _id: Types.ObjectId;
        applicationId: Types.ObjectId;
        description: string;
        activityDate: Date;
        hours: number;
        equipmentOrTool: string;
        status: ActivityStatus;
        rejectionReason?: string;
        createdAt: Date;
        updatedAt: Date;
      };

      return {
        _id: activityObj._id.toString(),
        applicationId: activityObj.applicationId.toString(),
        description: activityObj.description,
        activityDate: activityObj.activityDate,
        hours: activityObj.hours,
        equipmentOrTool: activityObj.equipmentOrTool,
        status: activityObj.status,
        rejectionReason: activityObj.rejectionReason,
        createdAt: activityObj.createdAt,
        updatedAt: activityObj.updatedAt,
      };
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateActivityStatus(
    activityId: string,
    companyUserId: string,
    updateDto: UpdateActivityStatusDto,
  ): Promise<ActivityResponseDto> {
    const activity = await this.practiceActivityModel
      .findById(activityId)
      .populate({
        path: 'applicationId',
        populate: {
          path: 'opportunityId',
          select: 'companyId responsibleUserId',
        },
      })
      .exec();

    if (!activity) {
      throw new NotFoundException('Actividad no encontrada');
    }

    const application = activity.applicationId as unknown as {
      opportunityId: {
        companyId: Types.ObjectId;
        responsibleUserId?: Types.ObjectId;
      };
    };

    const opportunity = application.opportunityId as unknown as {
      companyId: Types.ObjectId | string | { _id: Types.ObjectId | string };
      responsibleUserId?: Types.ObjectId | string;
    };

    // Verify that the company user has access to this activity
    // Handle companyId - it can be ObjectId, string, or populated object
    let opportunityCompanyId: string;
    if (typeof opportunity.companyId === 'object' && opportunity.companyId !== null && !(opportunity.companyId instanceof Types.ObjectId)) {
      // It's a populated object
      if ('_id' in opportunity.companyId) {
        opportunityCompanyId = opportunity.companyId._id.toString();
      } else {
        opportunityCompanyId = String(opportunity.companyId);
      }
    } else if (opportunity.companyId instanceof Types.ObjectId) {
      // It's an ObjectId
      opportunityCompanyId = opportunity.companyId.toString();
    } else {
      // It's a string
      opportunityCompanyId = opportunity.companyId?.toString() || String(opportunity.companyId);
    }

    const responsibleUserId = opportunity.responsibleUserId?.toString() || opportunity.responsibleUserId?.toString();
    const userCompanyId = await this.getCompanyIdByUserId(companyUserId);

    // Convert both to strings for comparison
    const opportunityCompanyIdStr = String(opportunityCompanyId);
    const userCompanyIdStr = String(userCompanyId);
    const responsibleUserIdStr = responsibleUserId ? String(responsibleUserId) : null;
    const companyUserIdStr = String(companyUserId);

    if (
      opportunityCompanyIdStr !== userCompanyIdStr &&
      (!responsibleUserIdStr || responsibleUserIdStr !== companyUserIdStr)
    ) {
      throw new BadRequestException(
        'No tienes permiso para modificar esta actividad',
      );
    }

    // Validate rejection reason if status is rejected
    if (
      updateDto.status === ActivityStatus.REJECTED &&
      (!updateDto.rejectionReason || updateDto.rejectionReason.trim() === '')
    ) {
      throw new BadRequestException(
        'La razón de rechazo es requerida cuando se rechaza una actividad',
      );
    }

    // Update activity status
    activity.status = updateDto.status;
    if (updateDto.rejectionReason) {
      activity.rejectionReason = updateDto.rejectionReason;
    } else if (updateDto.status !== ActivityStatus.REJECTED) {
      activity.rejectionReason = undefined;
    }

    const savedActivity = await activity.save();

    return {
      _id: savedActivity._id.toString(),
      applicationId: savedActivity.applicationId.toString(),
      description: savedActivity.description,
      activityDate: savedActivity.activityDate,
      hours: savedActivity.hours,
      equipmentOrTool: savedActivity.equipmentOrTool,
      status: savedActivity.status,
      rejectionReason: savedActivity.rejectionReason,
      createdAt: savedActivity.createdAt,
      updatedAt: savedActivity.updatedAt,
    };
  }

  async getStudentDetailForCompany(
    studentId: string,
    companyUserId: string,
  ) {
    // First, try to find the student to get their userId
    // studentId can be either the student _id or the userId
    let studentUserId: Types.ObjectId | null = null;

    // Try to find by student _id first
    const student = await this.studentModel
      .findById(studentId)
      .select('userId')
      .lean()
      .exec();

    if (student && student.userId) {
      // Convert userId to ObjectId if it's a string
      const userIdValue = student.userId;
      if (userIdValue instanceof Types.ObjectId) {
        studentUserId = userIdValue;
      } else {
        studentUserId = new Types.ObjectId(String(userIdValue));
      }
    } else {
      // If not found, assume studentId is the userId
      try {
        studentUserId = new Types.ObjectId(studentId);
      } catch {
        throw new NotFoundException('Estudiante no encontrado');
      }
    }

    // Find accepted application using the userId
    const acceptedApplication = await this.applicationModel
      .findOne({
        studentId: studentUserId,
        status: ApplicationStatus.ACCEPTED,
      })
      .populate({
        path: 'opportunityId',
        populate: [
          { path: 'careerId', select: 'name code' },
          { path: 'companyId', select: 'name logo' },
        ],
      })
      .lean()
      .exec();

    if (!acceptedApplication) {
      throw new NotFoundException(
        'El estudiante no tiene una práctica profesional activa',
      );
    }

    const opportunity = acceptedApplication.opportunityId as unknown as {
      companyId: Types.ObjectId | string | { _id: Types.ObjectId | string };
      responsibleUserId?: Types.ObjectId | string;
    };

    // Verify that the company user has access to this student
    // Handle companyId - it can be ObjectId, string, or populated object
    let opportunityCompanyId: string;
    if (typeof opportunity.companyId === 'object' && opportunity.companyId !== null && !(opportunity.companyId instanceof Types.ObjectId)) {
      // It's a populated object
      if ('_id' in opportunity.companyId) {
        opportunityCompanyId = opportunity.companyId._id.toString();
      } else {
        opportunityCompanyId = String(opportunity.companyId);
      }
    } else if (opportunity.companyId instanceof Types.ObjectId) {
      // It's an ObjectId
      opportunityCompanyId = opportunity.companyId.toString();
    } else {
      // It's a string
      opportunityCompanyId = opportunity.companyId?.toString() || String(opportunity.companyId);
    }

    const responsibleUserId = opportunity.responsibleUserId?.toString() || opportunity.responsibleUserId?.toString();
    const userCompanyId = await this.getCompanyIdByUserId(companyUserId);

    // Convert both to strings for comparison
    const opportunityCompanyIdStr = String(opportunityCompanyId);
    const userCompanyIdStr = String(userCompanyId);
    const responsibleUserIdStr = responsibleUserId ? String(responsibleUserId) : null;
    const companyUserIdStr = String(companyUserId);

    if (
      opportunityCompanyIdStr !== userCompanyIdStr &&
      (!responsibleUserIdStr || responsibleUserIdStr !== companyUserIdStr)
    ) {
      throw new BadRequestException(
        'No tienes permiso para ver la información de este estudiante',
      );
    }

    // Get student using StudentsService (it handles both _id and userId)
    const transformedStudent = await this.studentsService.findOne(studentId);

    return {
      student: transformedStudent,
      application: acceptedApplication,
      opportunity: acceptedApplication.opportunityId,
    };
  }

  async finishPracticeProfessional(
    studentId: string,
    companyUserId: string,
  ): Promise<{ message: string }> {
    let studentUserId: Types.ObjectId | null = null;

    const student = await this.studentModel
      .findById(studentId)
      .select('userId')
      .lean()
      .exec();

    if (student && student.userId) {
      const userIdValue = student.userId;
      if (userIdValue instanceof Types.ObjectId) {
        studentUserId = userIdValue;
      } else {
        studentUserId = new Types.ObjectId(String(userIdValue));
      }
    } else {
      try {
        studentUserId = new Types.ObjectId(studentId);
      } catch {
        throw new NotFoundException('Estudiante no encontrado');
      }
    }

    const application = await this.applicationModel
      .findOne({
        studentId: studentUserId,
        status: ApplicationStatus.ACCEPTED,
      })
      .populate({
        path: 'opportunityId',
        populate: {
          path: 'companyId',
          select: '_id',
        },
      })
      .exec();

    if (!application) {
      throw new NotFoundException(
        'El estudiante no tiene una práctica profesional activa',
      );
    }

    if (application.finalizedAt) {
      throw new BadRequestException(
        'La práctica profesional ya está finalizada',
      );
    }

    const opportunity = application.opportunityId as unknown as {
      companyId: Types.ObjectId | string | { _id: Types.ObjectId | string };
    };

    let opportunityCompanyId: string;
    if (
      typeof opportunity.companyId === 'object' &&
      opportunity.companyId !== null &&
      !(opportunity.companyId instanceof Types.ObjectId)
    ) {
      if ('_id' in opportunity.companyId) {
        opportunityCompanyId = opportunity.companyId._id.toString();
      } else {
        opportunityCompanyId = String(opportunity.companyId);
      }
    } else if (opportunity.companyId instanceof Types.ObjectId) {
      opportunityCompanyId = opportunity.companyId.toString();
    } else {
      opportunityCompanyId =
        opportunity.companyId?.toString() || String(opportunity.companyId);
    }

    const userCompanyId = await this.getCompanyIdByUserId(companyUserId);

    const opportunityCompanyIdStr = String(opportunityCompanyId);
    const userCompanyIdStr = String(userCompanyId);

    if (opportunityCompanyIdStr !== userCompanyIdStr) {
      throw new BadRequestException(
        'No tienes permiso para finalizar la práctica profesional de este estudiante',
      );
    }

    application.finalizedAt = new Date();
    await application.save();

    return {
      message: 'Práctica profesional finalizada exitosamente',
    };
  }

  async getPracticeHistory(userId: string): Promise<PracticeHistoryResponseDto> {
    const applications = await this.applicationModel
      .find({
        studentId: new Types.ObjectId(userId),
        status: ApplicationStatus.ACCEPTED,
      })
      .populate({
        path: 'opportunityId',
        populate: [
          { path: 'careerId', select: 'name code' },
          { path: 'companyId', select: 'name logo' },
        ],
      })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const historyItems: PracticeHistoryItemDto[] = await Promise.all(
      applications.map(async (application) => {
        const appObj = application as unknown as {
          _id: Types.ObjectId;
          opportunityId: unknown;
          finalizedAt?: Date;
          createdAt: Date;
          updatedAt: Date;
        };

        const opportunity = appObj.opportunityId as unknown as {
          _id: Types.ObjectId | string;
          title: string;
          totalHours?: number;
          companyId?: {
            _id: Types.ObjectId | string;
            name: string;
            logo?: string;
          };
        };

        const activities = await this.practiceActivityModel
          .find({
            applicationId: appObj._id,
          })
          .sort({ activityDate: 1 })
          .lean()
          .exec();

        const totalHours = activities.reduce(
          (sum, activity) => sum + (activity.hours || 0),
          0,
        );

        const approvedHours = activities
          .filter((activity) => activity.status === ActivityStatus.APPROVED)
          .reduce((sum, activity) => sum + (activity.hours || 0), 0);

        const requiredHours = opportunity?.totalHours || 0;

        const startDate = appObj.createdAt;

        let endDate: Date | undefined;
        let status: PracticeStatus;

        if (appObj.finalizedAt) {
          status = PracticeStatus.FINALIZADA;
          endDate = appObj.finalizedAt;
        } else if (approvedHours >= requiredHours && requiredHours > 0) {
          status = PracticeStatus.FINALIZADA;
          if (activities.length > 0) {
            const lastApprovedActivity = activities
              .filter((activity) => activity.status === ActivityStatus.APPROVED)
              .sort(
                (a, b) =>
                  new Date(b.activityDate).getTime() -
                  new Date(a.activityDate).getTime(),
              )[0];
            if (lastApprovedActivity) {
              endDate = new Date(lastApprovedActivity.activityDate);
            }
          }
        } else {
          status = PracticeStatus.EN_CURSO;
        }

        const companyIdValue = opportunity?.companyId;
        let companyName = 'Empresa no especificada';
        let companyLogo: string | undefined;

        if (
          companyIdValue &&
          typeof companyIdValue === 'object' &&
          'name' in companyIdValue
        ) {
          companyName = companyIdValue.name || companyName;
          companyLogo = companyIdValue.logo;
        }

        return {
          applicationId: appObj._id.toString(),
          opportunityId:
            typeof opportunity._id === 'string'
              ? opportunity._id
              : opportunity._id.toString(),
          opportunityTitle: opportunity.title || 'Sin título',
          companyName,
          companyLogo,
          startDate,
          endDate,
          totalHours,
          approvedHours,
          requiredHours,
          status,
        };
      }),
    );

    return {
      data: historyItems,
      total: historyItems.length,
    };
  }

  async getPracticeProfessionalByApplicationId(
    applicationId: string,
    userId: string,
  ): Promise<PracticeProfessionalResponseDto> {
    const application = await this.applicationModel
      .findOne({
        _id: new Types.ObjectId(applicationId),
        studentId: new Types.ObjectId(userId),
        status: ApplicationStatus.ACCEPTED,
      })
      .populate({
        path: 'opportunityId',
        populate: [
          { path: 'careerId', select: 'name code' },
          { path: 'companyId', select: 'name logo' },
        ],
      })
      .lean()
      .exec();

    if (!application) {
      throw new NotFoundException(
        'Práctica profesional no encontrada o no tienes acceso a ella',
      );
    }

    const activities = await this.practiceActivityModel
      .find({
        applicationId: new Types.ObjectId(applicationId),
      })
      .sort({ activityDate: -1, createdAt: -1 })
      .lean()
      .exec();

    const totalHours = activities.reduce(
      (sum, activity) => sum + (activity.hours || 0),
      0,
    );

    const approvedHours = activities
      .filter((activity) => activity.status === ActivityStatus.APPROVED)
      .reduce((sum, activity) => sum + (activity.hours || 0), 0);

    const applicationObj = application as unknown as {
      _id: Types.ObjectId;
      opportunityId: unknown;
      studentId: Types.ObjectId;
      coverLetter?: string;
      status: string;
      rejectionReason?: string;
      finalizedAt?: Date;
      createdAt: Date;
      updatedAt: Date;
    };

    const opportunityIdValue = applicationObj.opportunityId;
    let opportunity: any = null;

    if (opportunityIdValue) {
      if (
        typeof opportunityIdValue === 'object' &&
        opportunityIdValue !== null &&
        '_id' in opportunityIdValue
      ) {
        opportunity = opportunityIdValue;
      } else {
        opportunity = await this.opportunityModel
          .findById(opportunityIdValue)
          .populate('careerId', 'name code')
          .populate('companyId', 'name logo')
          .lean()
          .exec();
      }
    }

    if (!opportunity) {
      throw new NotFoundException('Oportunidad no encontrada');
    }

    const activitiesResponse: ActivityResponseDto[] = activities.map(
      (activity) => {
        const activityObj = activity as unknown as {
          _id: Types.ObjectId;
          applicationId: Types.ObjectId;
          description: string;
          activityDate: Date;
          hours: number;
          equipmentOrTool: string;
          status: ActivityStatus;
          rejectionReason?: string;
          createdAt: Date;
          updatedAt: Date;
        };

        return {
          _id: activityObj._id.toString(),
          applicationId: activityObj.applicationId.toString(),
          description: activityObj.description,
          activityDate: activityObj.activityDate,
          hours: activityObj.hours,
          equipmentOrTool: activityObj.equipmentOrTool,
          status: activityObj.status,
          rejectionReason: activityObj.rejectionReason,
          createdAt: activityObj.createdAt,
          updatedAt: activityObj.updatedAt,
        };
      },
    );

    return {
      application: {
        _id: applicationObj._id.toString(),
        opportunityId:
          typeof opportunity._id === 'string'
            ? opportunity._id
            : opportunity._id.toString(),
        studentId: applicationObj.studentId.toString(),
        coverLetter: applicationObj.coverLetter,
        status: applicationObj.status as ApplicationStatus,
        rejectionReason: applicationObj.rejectionReason,
        finalizedAt: applicationObj.finalizedAt,
        createdAt: applicationObj.createdAt,
        updatedAt: applicationObj.updatedAt,
      },
      opportunity: {
        _id:
          typeof opportunity._id === 'string'
            ? opportunity._id
            : opportunity._id.toString(),
        title: opportunity.title,
        description: opportunity.description,
        activities: opportunity.activities,
        careerId:
          typeof opportunity.careerId === 'object' &&
          opportunity.careerId !== null &&
          '_id' in opportunity.careerId
            ? typeof (opportunity.careerId as { _id: unknown })._id === 'string'
              ? (opportunity.careerId as { _id: string })._id
              : (opportunity.careerId as { _id: Types.ObjectId })._id.toString()
            : typeof opportunity.careerId === 'string'
              ? opportunity.careerId
              : '',
        companyId:
          typeof opportunity.companyId === 'object' &&
          opportunity.companyId !== null &&
          '_id' in opportunity.companyId
            ? typeof (opportunity.companyId as { _id: unknown })._id === 'string'
              ? (opportunity.companyId as { _id: string })._id
              : (opportunity.companyId as { _id: Types.ObjectId })._id.toString()
            : typeof opportunity.companyId === 'string'
              ? opportunity.companyId
              : '',
        responsibleUserId: opportunity.responsibleUserId
          ? typeof opportunity.responsibleUserId === 'string'
            ? opportunity.responsibleUserId
            : opportunity.responsibleUserId.toString()
          : undefined,
        totalHours: opportunity.totalHours,
        availablePositions: opportunity.availablePositions,
        modality: opportunity.modality,
        workType: opportunity.workType,
        expirationDate: opportunity.expirationDate,
        status: opportunity.status,
        isActive: opportunity.isActive,
        shareToken: opportunity.shareToken,
        createdAt: opportunity.createdAt,
        updatedAt: opportunity.updatedAt,
        career:
          opportunity.careerId &&
          typeof opportunity.careerId === 'object' &&
          opportunity.careerId !== null &&
          !(opportunity.careerId instanceof Types.ObjectId) &&
          '_id' in opportunity.careerId &&
          'name' in opportunity.careerId
            ? {
                _id:
                  typeof (opportunity.careerId as { _id: Types.ObjectId | string })
                    ._id === 'string'
                    ? (opportunity.careerId as { _id: string })._id
                    : (
                        opportunity.careerId as { _id: Types.ObjectId }
                      )._id.toString(),
                name:
                  (opportunity.careerId as { name?: string }).name || '',
                code:
                  (opportunity.careerId as { code?: string }).code || '',
              }
            : undefined,
        company:
          opportunity.companyId &&
          typeof opportunity.companyId === 'object' &&
          opportunity.companyId !== null &&
          !(opportunity.companyId instanceof Types.ObjectId) &&
          '_id' in opportunity.companyId &&
          'name' in opportunity.companyId
            ? {
                _id:
                  typeof (
                    opportunity.companyId as { _id: Types.ObjectId | string }
                  )._id === 'string'
                    ? (opportunity.companyId as { _id: string })._id
                    : (
                        opportunity.companyId as { _id: Types.ObjectId }
                      )._id.toString(),
                name:
                  (opportunity.companyId as { name?: string }).name || '',
                logo: (opportunity.companyId as { logo?: string }).logo,
              }
            : undefined,
      },
      activities: activitiesResponse,
      totalHours,
      approvedHours,
      status: applicationObj.finalizedAt
        ? PracticeStatus.FINALIZADA
        : approvedHours >= (opportunity?.totalHours || 0) &&
            (opportunity?.totalHours || 0) > 0
          ? PracticeStatus.FINALIZADA
          : PracticeStatus.EN_CURSO,
    };
  }
}

