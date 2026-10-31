import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { MarketColumn } from '../../../common/db/columns.js';
import type { MarketCode } from '../../../markets/market-code.js';
import { User } from './user.entity.js';

/**
 * Tržište na kome korisnik sa ulogom vezanom za tržište (advokat, analitičar,
 * koordinator, inženjer, escrow, admin) sme da radi (F-34, P3 i P5).
 */
@Entity({ name: 'user_markets' })
export class UserMarket {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @MarketColumn({ primary: true })
  market: MarketCode;

  @ManyToOne(() => User, (user) => user.markets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
