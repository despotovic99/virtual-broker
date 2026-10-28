import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { RequireCapabilities } from '../access/access.decorators.js';
import type { AuthUser } from '../access/auth-user.js';
import { Capability } from '../access/capability.enum.js';
import { CurrentUser } from '../access/current-user.decorator.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { ListUsersQueryDto, StaffQueryDto } from './dto/list-users-query.dto.js';
import type { StaffMemberDto } from './dto/staff-member.dto.js';
import type { UserListResponseDto, UserResponseDto } from './dto/user-response.dto.js';
import { UsersService } from './users.service.js';

/** Izmena korisnika (PATCH /users/:id) je u UsersAdminController, jer poništava sesije (AuthModule). */
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequireCapabilities(Capability.UsersRead)
  list(@CurrentUser() actor: AuthUser, @Query() query: ListUsersQueryDto): Promise<UserListResponseDto> {
    return this.users.listUsers(actor, query);
  }

  /** Spisak koordinatora, inženjera, escrow partnera… na tržištu, za dodelu na kupovini. */
  @Get('staff')
  @RequireCapabilities(Capability.PurchasesManage)
  staff(@CurrentUser() actor: AuthUser, @Query() query: StaffQueryDto): Promise<StaffMemberDto[]> {
    return this.users.listStaff(actor, query);
  }

  @Post()
  @RequireCapabilities(Capability.UsersCreate)
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.users.createUser(actor, dto);
  }
}
