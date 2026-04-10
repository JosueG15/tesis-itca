import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import {
  User,
  UserDocument,
  UserRole,
} from '@/modules/auth/schemas/user.schema';
import { CreateUserDto } from '@/modules/users/dto/create-user.dto';
import { UpdateUserDto } from '@/modules/users/dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  private generateRandomPassword(): string {
    const length = 12;
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*';
    const allChars = uppercase + lowercase + numbers + symbols;

    let password = '';
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  }

  async create(createUserDto: CreateUserDto) {
    const existingUser = await this.userModel.findOne({
      email: createUserDto.email,
    });

    if (existingUser) {
      throw new ConflictException(
        'Ya existe un usuario con este correo electrónico',
      );
    }

    const generatedPassword = this.generateRandomPassword();
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(generatedPassword, saltRounds);

    const user = new this.userModel({
      name: createUserDto.name,
      email: createUserDto.email,
      password: hashedPassword,
      role: UserRole.ADMIN,
      isActive: true,
      isTemporaryPassword: true,
    });

    const saved = await user.save();
    const userObj = saved.toObject();

    return {
      ...userObj,
      generatedPassword,
    };
  }

  async findAll(
    page = 1,
    limit = 10,
    search?: string,
    isActive?: boolean,
    sortBy?: string,
    sortOrder?: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const skip = (page - 1) * limit;
    const query: {
      role: UserRole;
      $or?: Array<{
        name?: { $regex: string; $options: string };
        email?: { $regex: string; $options: string };
      }>;
      isActive?: boolean;
      createdAt?: { $gte?: Date; $lte?: Date };
    } = {
      role: UserRole.ADMIN,
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    if (isActive !== undefined) {
      query.isActive = isActive;
    }

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        query.createdAt.$gte = fromDate;
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = toDate;
      }
    }

    const sortField = sortBy || 'createdAt';
    const sortDirection: 1 | -1 = sortOrder === 'asc' ? 1 : -1;
    const sortObj: Record<string, 1 | -1> = { [sortField]: sortDirection };

    const [data, total] = await Promise.all([
      this.userModel
        .find(query)
        .select('-password')
        .skip(skip)
        .limit(limit)
        .sort(sortObj)
        .lean()
        .exec(),
      this.userModel.countDocuments(query).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const user = await this.userModel
      .findById(id)
      .select('-password')
      .lean()
      .exec();

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (user.role !== UserRole.ADMIN) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.userModel.findById(id).exec();

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (user.role !== UserRole.ADMIN) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.userModel.findOne({
        email: updateUserDto.email,
        _id: { $ne: id },
      });

      if (existingUser) {
        throw new ConflictException(
          'Ya existe un usuario con este correo electrónico',
        );
      }
    }

    const updateData: {
      name?: string;
      email?: string;
      isActive?: boolean;
    } = {};

    if (updateUserDto.name !== undefined) {
      updateData.name = updateUserDto.name;
    }

    if (updateUserDto.email !== undefined) {
      updateData.email = updateUserDto.email;
    }

    if (updateUserDto.isActive !== undefined) {
      updateData.isActive = updateUserDto.isActive;
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      })
      .select('-password')
      .lean()
      .exec();

    return updatedUser;
  }

  async remove(id: string) {
    const user = await this.userModel.findById(id).exec();

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (user.role !== UserRole.ADMIN) {
      throw new NotFoundException('Usuario no encontrado');
    }

    await this.userModel.findByIdAndDelete(id).exec();
    return { message: 'Usuario eliminado exitosamente' };
  }

  async toggleStatus(id: string) {
    const user = await this.userModel.findById(id).exec();

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (user.role !== UserRole.ADMIN) {
      throw new NotFoundException('Usuario no encontrado');
    }

    user.isActive = !user.isActive;
    const saved = await user.save();
    const userObj = saved.toObject();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = userObj;

    return userWithoutPassword;
  }
}
