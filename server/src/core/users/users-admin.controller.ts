import { Body, Controller, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { RequireCapabilities } from '../access/access.decorators.js';
import type { AuthUser } from '../access/auth-user.js';
import { Capability } from '../access/capability.enum.js';
import { CurrentUser } from '../access/current-user.decorator.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import type { UserResponseDto } from './dto/user-response.dto.js';
import { UsersAdminService } from './users-admin.service.js';

/** Registrovan u AuthModule (izmena korisnika poništava njegove sesije). */
@Controller('users')
export class UsersAdminController {
  constructor(private readonly usersAdmin: UsersAdminService) {}

  @Patch(':id')
  @RequireCapabilities(Capability.UsersUpdate)
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersAdmin.updateUser(actor, id, dto);
  }
}
