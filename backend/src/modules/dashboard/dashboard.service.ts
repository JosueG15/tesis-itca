import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  User,
  UserDocument,
  UserRole,
} from '@/modules/auth/schemas/user.schema';
import {
  Company,
  CompanyDocument,
  CompanyStatus,
} from '@/modules/companies/schemas/company.schema';
import {
  Career,
  CareerDocument,
} from '@/modules/careers/schemas/career.schema';
import {
  CareerCategory,
  CareerCategoryDocument,
} from '@/modules/career-categories/schemas/career-category.schema';
import {
  Opportunity,
  OpportunityDocument,
  OpportunityStatus,
} from '@/modules/opportunities/schemas/opportunity.schema';
import {
  Application,
  ApplicationDocument,
  ApplicationStatus,
} from '@/modules/opportunities/schemas/application.schema';
import {
  PracticeActivity,
  PracticeActivityDocument,
  ActivityStatus,
} from '@/modules/practice-professional/schemas/practice-activity.schema';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
    @InjectModel(Career.name) private careerModel: Model<CareerDocument>,
    @InjectModel(CareerCategory.name)
    private careerCategoryModel: Model<CareerCategoryDocument>,
    @InjectModel(Opportunity.name)
    private opportunityModel: Model<OpportunityDocument>,
    @InjectModel(Application.name)
    private applicationModel: Model<ApplicationDocument>,
    @InjectModel(PracticeActivity.name)
    private practiceActivityModel: Model<PracticeActivityDocument>,
  ) {}

  async getStats(userId: string, userRole: string) {
    // Si es usuario COMPANY, devolver estadísticas específicas de la empresa
    if (userRole === 'company') {
      return this.getCompanyStats(userId);
    }

    // Si es usuario ESTUDIANTE, devolver estadísticas específicas del estudiante
    if (userRole === 'estudiante') {
      return this.getStudentStats(userId);
    }

    // Para ADMIN, devolver estadísticas generales
    const [
      totalUsers,
      students,
      companies,
      admins,
      totalCompanies,
      activeCompanies,
      inactiveCompanies,
      totalCareers,
      activeCareers,
      inactiveCareers,
      totalCategories,
      activeCategories,
      inactiveCategories,
      totalApplications,
      pendingApplications,
      acceptedApplications,
      rejectedApplications,
    ] = await Promise.all([
      this.userModel.countDocuments({ isActive: true }),
      this.userModel.countDocuments({
        role: UserRole.ESTUDIANTE,
        isActive: true,
      }),
      this.userModel.countDocuments({
        role: UserRole.COMPANY,
        isActive: true,
      }),
      this.userModel.countDocuments({
        role: UserRole.ADMIN,
        isActive: true,
      }),
      this.companyModel.countDocuments(),
      this.companyModel.countDocuments({ status: CompanyStatus.ACTIVE }),
      this.companyModel.countDocuments({ status: CompanyStatus.INACTIVE }),
      this.careerModel.countDocuments(),
      this.careerModel.countDocuments({ isActive: true }),
      this.careerModel.countDocuments({ isActive: false }),
      this.careerCategoryModel.countDocuments(),
      this.careerCategoryModel.countDocuments({ isActive: true }),
      this.careerCategoryModel.countDocuments({ isActive: false }),
      this.applicationModel.countDocuments(),
      this.applicationModel.countDocuments({
        status: ApplicationStatus.PENDING,
      }),
      this.applicationModel.countDocuments({
        status: ApplicationStatus.ACCEPTED,
      }),
      this.applicationModel.countDocuments({
        status: ApplicationStatus.REJECTED,
      }),
    ]);

    return {
      users: {
        total: totalUsers,
        students,
        companies,
        admins,
      },
      companies: {
        total: totalCompanies,
        active: activeCompanies,
        inactive: inactiveCompanies,
      },
      requests: {
        total: totalApplications,
        pending: pendingApplications,
        approved: acceptedApplications,
        rejected: rejectedApplications,
        inProgress: acceptedApplications, // Aplicaciones aceptadas están en proceso
      },
      careers: {
        total: totalCareers,
        active: activeCareers,
        inactive: inactiveCareers,
      },
      careerCategories: {
        total: totalCategories,
        active: activeCategories,
        inactive: inactiveCategories,
      },
    };
  }

  private async getCompanyStats(userId: string) {
    // Obtener el companyId del usuario
    const user = await this.userModel.findById(userId).exec();
    if (!user || !user.companyId) {
      throw new NotFoundException(
        'Usuario no encontrado o no tiene una empresa asociada',
      );
    }

    const companyId = new Types.ObjectId(user.companyId);

    // Obtener los IDs de todas las oportunidades de la empresa
    const opportunityIds = await this.opportunityModel
      .find({ companyId })
      .distinct('_id')
      .exec();

    // Obtener estadísticas de oportunidades
    const [
      totalOpportunities,
      activeOpportunities,
      closedOpportunities,
      draftOpportunities,
      inactiveOpportunities,
      totalApplications,
      pendingApplications,
      acceptedApplications,
      rejectedApplications,
      totalPositions,
    ] = await Promise.all([
      this.opportunityModel.countDocuments({ companyId }),
      this.opportunityModel.countDocuments({
        companyId,
        status: OpportunityStatus.ACTIVE,
        isActive: true,
      }),
      this.opportunityModel.countDocuments({
        companyId,
        status: OpportunityStatus.CLOSED,
      }),
      this.opportunityModel.countDocuments({
        companyId,
        status: OpportunityStatus.DRAFT,
      }),
      this.opportunityModel.countDocuments({
        companyId,
        isActive: false,
      }),
      this.applicationModel.countDocuments({
        opportunityId: { $in: opportunityIds },
      }),
      this.applicationModel.countDocuments({
        opportunityId: { $in: opportunityIds },
        status: ApplicationStatus.PENDING,
      }),
      this.applicationModel.countDocuments({
        opportunityId: { $in: opportunityIds },
        status: ApplicationStatus.ACCEPTED,
      }),
      this.applicationModel.countDocuments({
        opportunityId: { $in: opportunityIds },
        status: ApplicationStatus.REJECTED,
      }),
      this.opportunityModel.aggregate<{ total: number }>([
        { $match: { companyId } },
        { $group: { _id: null, total: { $sum: '$availablePositions' } } },
      ]),
    ]);

    const totalPositionsValue =
      totalPositions.length > 0 && totalPositions[0]?.total
        ? totalPositions[0].total
        : 0;

    return {
      opportunities: {
        total: totalOpportunities,
        active: activeOpportunities,
        closed: closedOpportunities,
        draft: draftOpportunities,
        inactive: inactiveOpportunities,
      },
      applications: {
        total: totalApplications,
        pending: pendingApplications,
        accepted: acceptedApplications,
        rejected: rejectedApplications,
      },
      positions: {
        total: totalPositionsValue,
        occupied: acceptedApplications,
        available: totalPositionsValue - acceptedApplications,
      },
    };
  }

  private async getStudentStats(userId: string) {
    const studentId = new Types.ObjectId(userId);

    // Obtener IDs de oportunidades a las que el estudiante ya ha aplicado
    const appliedOpportunityIds = await this.applicationModel
      .find({ studentId })
      .distinct('opportunityId')
      .exec();

    // Obtener TODAS las aplicaciones aceptadas para calcular estadísticas de práctica
    const acceptedApplicationsList = await this.applicationModel
      .find({
        studentId,
        status: ApplicationStatus.ACCEPTED,
      })
      .populate({
        path: 'opportunityId',
        select: 'totalHours',
      })
      .lean()
      .exec();

    // Obtener estadísticas de aplicaciones del estudiante
    const [
      totalApplications,
      pendingApplications,
      acceptedApplications,
      rejectedApplications,
      availableOpportunities,
    ] = await Promise.all([
      this.applicationModel.countDocuments({ studentId }),
      this.applicationModel.countDocuments({
        studentId,
        status: ApplicationStatus.PENDING,
      }),
      this.applicationModel.countDocuments({
        studentId,
        status: ApplicationStatus.ACCEPTED,
      }),
      this.applicationModel.countDocuments({
        studentId,
        status: ApplicationStatus.REJECTED,
      }),
      this.opportunityModel.countDocuments({
        status: OpportunityStatus.ACTIVE,
        isActive: true,
        _id: { $nin: appliedOpportunityIds },
        $or: [
          { expirationDate: { $exists: false } },
          { expirationDate: { $gte: new Date() } },
        ],
      }),
    ]);

    // Calcular estadísticas de práctica profesional de TODAS las aplicaciones aceptadas
    let practiceProfessional: {
      totalHours: number;
      approvedHours: number;
      remainingHours: number;
      requiredHours: number;
      isFinalized: boolean;
    } | null = null;

    if (acceptedApplicationsList && acceptedApplicationsList.length > 0) {
      const applicationIds = acceptedApplicationsList.map(
        (app) => app._id as Types.ObjectId,
      );

      const allActivities = await this.practiceActivityModel
        .find({
          applicationId: { $in: applicationIds },
        })
        .lean()
        .exec();

      let totalHours = 0;
      let approvedHours = 0;
      let totalRequiredHours = 0;
      let allFinalized = true;
      let hasAnyInProgress = false;

      for (const acceptedApplication of acceptedApplicationsList) {
        const applicationObj = acceptedApplication as unknown as {
          _id: Types.ObjectId;
          finalizedAt?: Date;
        };

        const opportunity = acceptedApplication.opportunityId as unknown as {
          totalHours?: number;
        };
        const requiredHours = opportunity?.totalHours || 0;
        totalRequiredHours += requiredHours;

        if (!applicationObj.finalizedAt) {
          allFinalized = false;
          hasAnyInProgress = true;
        }

        const applicationActivities = allActivities.filter(
          (activity) =>
            activity.applicationId &&
            activity.applicationId.toString() ===
              applicationObj._id.toString(),
        );

        const appTotalHours = applicationActivities.reduce(
          (sum, activity) => sum + (activity.hours || 0),
          0,
        );

        const appApprovedHours = applicationActivities
          .filter((activity) => activity.status === ActivityStatus.APPROVED)
          .reduce((sum, activity) => sum + (activity.hours || 0), 0);

        totalHours += appTotalHours;
        approvedHours += appApprovedHours;
      }

      const remainingHours = Math.max(0, totalRequiredHours - approvedHours);

      practiceProfessional = {
        totalHours,
        approvedHours,
        remainingHours,
        requiredHours: totalRequiredHours,
        isFinalized: allFinalized && !hasAnyInProgress,
      };
    }

    return {
      applications: {
        total: totalApplications,
        pending: pendingApplications,
        accepted: acceptedApplications,
        rejected: rejectedApplications,
      },
      opportunities: {
        available: availableOpportunities,
      },
      practiceProfessional,
    };
  }
}
