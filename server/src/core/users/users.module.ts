import { Module } from '@nestjs/common';
import { BuyerProfileRepository } from './buyer-profile.repository.js';
import { PasswordService } from './password.service.js';
import { UsersController } from './users.controller.js';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, PasswordService, BuyerProfileRepository],
  exports: [UsersService, PasswordService, BuyerProfileRepository],
})
export class UsersModule {}
