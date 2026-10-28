import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { UserMarket } from './user-market.entity.js';
import { UserRole } from './user-role.entity.js';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Uvek se čuva malim slovima (UsersService normalizuje). */
  @Index('uq_users_email', { unique: true })
  @Column({ type: 'varchar', length: 254 })
  email: string;

  /** scrypt heš (PasswordService). Nikad ne ide u odgovor API-ja. */
  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ name: 'first_name', type: 'varchar', length: 100 })
  firstName: string;

  @Column({ name: 'last_name', type: 'varchar', length: 100 })
  lastName: string;

  /** Jezik interfejsa i obaveštenja (MVP: sr, en). */
  @Column({ type: 'varchar', length: 8, default: 'sr' })
  language: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy?: Relation<User> | null;

  @OneToMany(() => UserRole, (userRole) => userRole.user)
  roles: Relation<UserRole[]>;

  @OneToMany(() => UserMarket, (userMarket) => userMarket.user)
  markets: Relation<UserMarket[]>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
