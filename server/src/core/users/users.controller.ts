import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import type { Page } from '../../common/pagination/pagination.js';
import { RequireCapabilities } from '../access/access.decorators.js';
import type { AuthUser } from '../access/auth-user.js';
import { Capability } from '../access/capability.enum.js';
import { CurrentUser } from '../access/current-user.decorator.js';
import { CreateBuyerDto } from './dto/create-buyer.dto.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { BuyerSearchQueryDto, ListUsersQueryDto, StaffQueryDto } from './dto/list-users-query.dto.js';
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

  /** Aktivni kupci za otvaranje kupovine bez zahteva (pretraga po imenu ili email-u), po stranama. */
  @Get('buyers')
  @RequireCapabilities(Capability.PurchasesManage)
  buyers(@Query() query: BuyerSearchQueryDto): Promise<Page<StaffMemberDto>> {
    return this.users.searchBuyers(query);
  }

  /** Nov nalog kupca iz ekrana nove kupovine (uloga uvek samo BUYER). */
  @Post('buyers')
  @RequireCapabilities(Capability.PurchasesManage)
  createBuyer(@CurrentUser() actor: AuthUser, @Body() dto: CreateBuyerDto): Promise<StaffMemberDto> {
    return this.users.createBuyerByStaff(actor, dto);
  }

  /** Jedan korisnik (ekran izmene). Mora ostati posle ruta 'staff' i 'buyers'. */
  @Get(':id')
  @RequireCapabilities(Capability.UsersRead)
  get(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    return this.users.getUser(actor, id);
  }

  @Post()
  @RequireCapabilities(Capability.UsersCreate)
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.users.createUser(actor, dto);
  }
}
