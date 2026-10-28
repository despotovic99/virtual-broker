import type { UserResponseDto } from './dto/user-response.dto.js';
import type { User } from './entities/user.entity.js';

export function toUserResponse(user: User): UserResponseDto {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    roles: user.roles.map((userRole) => userRole.role).sort(),
    markets: (user.markets ?? []).map((userMarket) => userMarket.market).sort(),
    language: user.language,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
  };
}
