import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const Role = (...role: UserRole[]) => SetMetadata('role', role);
