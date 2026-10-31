import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAuditIp1793466708572 implements MigrationInterface {
    name = 'AddAuditIp1793466708572'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "audit_events"
            ADD "ip" character varying(45)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "audit_events" DROP COLUMN "ip"
        `);
    }

}
