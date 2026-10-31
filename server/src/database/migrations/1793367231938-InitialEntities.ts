import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialEntities1793367231938 implements MigrationInterface {
    name = 'InitialEntities1793367231938'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "audit_events" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "market" character varying(2),
                "actor_id" uuid,
                "action" character varying(64) NOT NULL,
                "entity_type" character varying(64) NOT NULL,
                "entity_id" uuid,
                "data" jsonb,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "CHK_d61c7c667f55f65e51be72e5e7" CHECK ("market" IN ('CY', 'RS')),
                CONSTRAINT "PK_910f64d901a5c3e9878f0d4a407" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "ix_audit_events_created_at" ON "audit_events" ("created_at")
        `);
        await queryRunner.query(`
            CREATE INDEX "ix_audit_events_entity" ON "audit_events" ("entity_type", "entity_id")
        `);
        await queryRunner.query(`
            CREATE TABLE "user_markets" (
                "user_id" uuid NOT NULL,
                "market" character varying(2) NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "CHK_ef1803f483e05c4b1f51791abd" CHECK ("market" IN ('CY', 'RS')),
                CONSTRAINT "PK_e5aa0e5751315456e38a2dc3fa1" PRIMARY KEY ("user_id", "market")
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "users" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "email" character varying(254) NOT NULL,
                "password_hash" character varying(255) NOT NULL,
                "first_name" character varying(100) NOT NULL,
                "last_name" character varying(100) NOT NULL,
                "language" character varying(8) NOT NULL DEFAULT 'sr',
                "is_active" boolean NOT NULL DEFAULT true,
                "last_login_at" TIMESTAMP WITH TIME ZONE,
                "created_by_id" uuid,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "uq_users_email" ON "users" ("email")
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."role" AS ENUM(
                'SUPER_ADMIN',
                'ADMIN',
                'ANALYST',
                'COORDINATOR',
                'LAWYER',
                'ENGINEER',
                'ESCROW_AGENT',
                'BUYER',
                'INVESTOR'
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "user_roles" (
                "user_id" uuid NOT NULL,
                "role" "public"."role" NOT NULL,
                "assigned_by_id" uuid,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_09d115a69b6014d324d592f9c42" PRIMARY KEY ("user_id", "role")
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "refresh_tokens" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_id" uuid NOT NULL,
                "family_id" uuid NOT NULL,
                "token_hash" character(64) NOT NULL,
                "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "revoked_at" TIMESTAMP WITH TIME ZONE,
                "replaced_by_id" uuid,
                "created_ip" character varying(45),
                "user_agent" character varying(255),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "ix_refresh_tokens_user_id" ON "refresh_tokens" ("user_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "ix_refresh_tokens_family_id" ON "refresh_tokens" ("family_id")
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "uq_refresh_tokens_token_hash" ON "refresh_tokens" ("token_hash")
        `);
        await queryRunner.query(`
            CREATE TABLE "developers" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "market" character varying(2) NOT NULL,
                "name" character varying(200) NOT NULL,
                "registration_number" character varying(32) NOT NULL,
                "tax_number" character varying(32),
                "address" character varying(300),
                "website" character varying(300),
                "created_by_id" uuid,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "CHK_06d2cd6bcfbf149a37c22f1dd3" CHECK ("market" IN ('CY', 'RS')),
                CONSTRAINT "PK_247719240b950bd26dec14bdd21" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "uq_developers_market_registration" ON "developers" ("market", "registration_number")
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."project_status" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED')
        `);
        await queryRunner.query(`
            CREATE TABLE "projects" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "market" character varying(2) NOT NULL,
                "developer_id" uuid NOT NULL,
                "name" character varying(200) NOT NULL,
                "city" character varying(120) NOT NULL,
                "address" character varying(300) NOT NULL,
                "parcel_reference" character varying(120),
                "description" text,
                "status" "public"."project_status" NOT NULL DEFAULT 'DRAFT',
                "expected_completion" date,
                "created_by_id" uuid,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "CHK_6bbc40d28cbcf034ffafe5c207" CHECK ("market" IN ('CY', 'RS')),
                CONSTRAINT "PK_6271df0a7aed1d6c0691ce6ac50" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "ix_projects_developer_id" ON "projects" ("developer_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "ix_projects_city" ON "projects" ("city")
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."unit_status" AS ENUM('AVAILABLE', 'RESERVED', 'SOLD')
        `);
        await queryRunner.query(`
            CREATE TABLE "units" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "market" character varying(2) NOT NULL,
                "project_id" uuid NOT NULL,
                "label" character varying(40) NOT NULL,
                "floor" integer,
                "rooms" numeric(3, 1),
                "area" numeric(8, 2) NOT NULL,
                "price" integer NOT NULL,
                "status" "public"."unit_status" NOT NULL DEFAULT 'AVAILABLE',
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "CHK_ac209fe8108e2bae2535dece40" CHECK ("market" IN ('CY', 'RS')),
                CONSTRAINT "PK_5a8f2f064919b587d93936cb223" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "uq_units_project_label" ON "units" ("project_id", "label")
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."step_status" AS ENUM('PENDING', 'DONE', 'SKIPPED')
        `);
        await queryRunner.query(`
            CREATE TABLE "purchase_steps" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "purchase_id" uuid NOT NULL,
                "step_code" character varying(8) NOT NULL,
                "phase" character varying(32) NOT NULL,
                "position" integer NOT NULL,
                "status" "public"."step_status" NOT NULL DEFAULT 'PENDING',
                "completed_at" TIMESTAMP WITH TIME ZONE,
                "completed_by_id" uuid,
                "note" character varying(500),
                CONSTRAINT "PK_b94fd0402178fce4fca72482a82" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "uq_purchase_steps_purchase_code" ON "purchase_steps" ("purchase_id", "step_code")
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."purchase_status" AS ENUM('ACTIVE', 'BLOCKED', 'CANCELLED', 'COMPLETED')
        `);
        await queryRunner.query(`
            CREATE TABLE "purchases" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "market" character varying(2) NOT NULL,
                "pack_version" character varying(32) NOT NULL,
                "buyer_id" uuid NOT NULL,
                "unit_id" uuid NOT NULL,
                "project_id" uuid NOT NULL,
                "developer_id" uuid NOT NULL,
                "status" "public"."purchase_status" NOT NULL DEFAULT 'ACTIVE',
                "block_reason" character varying(500),
                "coordinator_id" uuid,
                "legal_team_id" uuid,
                "lawyer_id" uuid,
                "engineer_id" uuid,
                "escrow_agent_id" uuid,
                "request_id" uuid,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "closed_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "CHK_15bb7aafd0b4472025eb5221da" CHECK ("market" IN ('CY', 'RS')),
                CONSTRAINT "PK_1d55032f37a34c6eceacbbca6b8" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "ix_purchases_buyer_id" ON "purchases" ("buyer_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "ix_purchases_project_id" ON "purchases" ("project_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "ix_purchases_coordinator_id" ON "purchases" ("coordinator_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "ix_purchases_legal_team_id" ON "purchases" ("legal_team_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "ix_purchases_engineer_id" ON "purchases" ("engineer_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "ix_purchases_escrow_agent_id" ON "purchases" ("escrow_agent_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "ix_purchases_market_status" ON "purchases" ("market", "status")
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."defect_severity" AS ENUM('MINOR', 'MAJOR', 'CRITICAL')
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."defect_status" AS ENUM('OPEN', 'FIXED', 'CONFIRMED')
        `);
        await queryRunner.query(`
            CREATE TABLE "defects" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "market" character varying(2) NOT NULL,
                "purchase_id" uuid NOT NULL,
                "description" character varying(1000) NOT NULL,
                "severity" "public"."defect_severity" NOT NULL,
                "due_date" date,
                "status" "public"."defect_status" NOT NULL DEFAULT 'OPEN',
                "reported_by_id" uuid NOT NULL,
                "fixed_at" TIMESTAMP WITH TIME ZONE,
                "confirmed_by_id" uuid,
                "confirmed_at" TIMESTAMP WITH TIME ZONE,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "CHK_78507f4ada7ad146142ccfc008" CHECK ("market" IN ('CY', 'RS')),
                CONSTRAINT "PK_b4bca3e4d032e3b50d1889ad296" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "ix_defects_purchase_status" ON "defects" ("purchase_id", "status")
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."check_subject" AS ENUM('DEVELOPER', 'PROJECT')
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."semaphore" AS ENUM('GREEN', 'YELLOW', 'RED', 'GRAY')
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."check_method" AS ENUM('AUTOMATIC', 'DOCUMENT', 'LAWYER', 'MANUAL')
        `);
        await queryRunner.query(`
            CREATE TABLE "checks" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "market" character varying(2) NOT NULL,
                "subject_type" "public"."check_subject" NOT NULL,
                "developer_id" uuid,
                "project_id" uuid,
                "definition_code" character varying(64) NOT NULL,
                "status" "public"."semaphore" NOT NULL,
                "summary" character varying(500) NOT NULL,
                "source" character varying(300) NOT NULL,
                "method" "public"."check_method" NOT NULL,
                "dummy" boolean NOT NULL DEFAULT false,
                "checked_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "valid_until" TIMESTAMP WITH TIME ZONE NOT NULL,
                "checked_by_id" uuid,
                "document_id" uuid,
                "data" jsonb,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "CHK_ab4f2d44c5abbde0fc7fd86389" CHECK ("market" IN ('CY', 'RS')),
                CONSTRAINT "PK_5b78bc7432d3654a701ca5f35e5" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "ix_checks_project_code" ON "checks" ("project_id", "definition_code", "checked_at")
        `);
        await queryRunner.query(`
            CREATE INDEX "ix_checks_developer_code" ON "checks" ("developer_id", "definition_code", "checked_at")
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."report_verdict" AS ENUM(
                'PROGRESS',
                'PHASE_CONFIRMED',
                'PHASE_REJECTED',
                'ISSUE'
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "engineer_reports" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "market" character varying(2) NOT NULL,
                "project_id" uuid NOT NULL,
                "phase_code" character varying(64),
                "engineer_id" uuid NOT NULL,
                "visit_date" date NOT NULL,
                "summary" text NOT NULL,
                "verdict" "public"."report_verdict" NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "CHK_b5d106da369f8cea276910e8d1" CHECK ("market" IN ('CY', 'RS')),
                CONSTRAINT "PK_dbf30a605d9f8a91378b36f3351" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "ix_engineer_reports_project_visit" ON "engineer_reports" ("project_id", "visit_date")
        `);
        await queryRunner.query(`
            CREATE TABLE "handovers" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "market" character varying(2) NOT NULL,
                "purchase_id" uuid NOT NULL,
                "engineer_id" uuid NOT NULL,
                "inspected_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "contract_area" numeric(8, 2) NOT NULL,
                "measured_area" numeric(8, 2) NOT NULL,
                "notes" text,
                "keys_handed_at" TIMESTAMP WITH TIME ZONE,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "CHK_b8603564a959e7e80ce48410be" CHECK ("market" IN ('CY', 'RS')),
                CONSTRAINT "PK_88432ab36f1a01be3bb86a16c28" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "uq_handovers_purchase_id" ON "handovers" ("purchase_id")
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."opinion_conclusion" AS ENUM('SIGN', 'SIGN_WITH_CONDITIONS', 'DO_NOT_SIGN')
        `);
        await queryRunner.query(`
            CREATE TABLE "legal_opinions" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "market" character varying(2) NOT NULL,
                "purchase_id" uuid NOT NULL,
                "conclusion" "public"."opinion_conclusion" NOT NULL,
                "reasoning" text NOT NULL,
                "conditions" text,
                "document_id" uuid,
                "author_id" uuid NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "CHK_05a91b4a0c9f749285ec1b6ab2" CHECK ("market" IN ('CY', 'RS')),
                CONSTRAINT "PK_f5e69f6ed3c3181727c53a522bc" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "ix_legal_opinions_purchase_id" ON "legal_opinions" ("purchase_id")
        `);
        await queryRunner.query(`
            CREATE TABLE "notifications" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_id" uuid NOT NULL,
                "type" character varying(64) NOT NULL,
                "title" character varying(200) NOT NULL,
                "body" character varying(1000) NOT NULL,
                "link" character varying(300),
                "read_at" TIMESTAMP WITH TIME ZONE,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "ix_notifications_user_created" ON "notifications" ("user_id", "created_at")
        `);
        await queryRunner.query(`
            CREATE TABLE "developer_bank_accounts" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "market" character varying(2) NOT NULL,
                "developer_id" uuid NOT NULL,
                "iban" character varying(34) NOT NULL,
                "bank_name" character varying(120) NOT NULL,
                "holder_name" character varying(200) NOT NULL,
                "verified_at" TIMESTAMP WITH TIME ZONE,
                "verified_by_id" uuid,
                "verification_note" character varying(500),
                "created_by_id" uuid,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "CHK_438d56a4529c4ba6517a3fdaef" CHECK ("market" IN ('CY', 'RS')),
                CONSTRAINT "PK_7c5f4a9512d9a3b84c6a29cb973" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "ix_developer_bank_accounts_developer_id" ON "developer_bank_accounts" ("developer_id")
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."condition_status" AS ENUM('PENDING', 'MET')
        `);
        await queryRunner.query(`
            CREATE TABLE "installment_conditions" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "installment_id" uuid NOT NULL,
                "condition_code" character varying(64) NOT NULL,
                "status" "public"."condition_status" NOT NULL DEFAULT 'PENDING',
                "confirmed_by_id" uuid,
                "confirmed_at" TIMESTAMP WITH TIME ZONE,
                "evidence_document_id" uuid,
                "note" character varying(500),
                CONSTRAINT "PK_e043f3c502ac7930fe84934d6ef" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "uq_installment_conditions_code" ON "installment_conditions" ("installment_id", "condition_code")
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."installment_status" AS ENUM('LOCKED', 'READY', 'PAID', 'RELEASED')
        `);
        await queryRunner.query(`
            CREATE TABLE "installments" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "market" character varying(2) NOT NULL,
                "purchase_id" uuid NOT NULL,
                "sequence" integer NOT NULL,
                "label" character varying(200) NOT NULL,
                "amount" integer NOT NULL,
                "phase_code" character varying(64),
                "is_final" boolean NOT NULL DEFAULT false,
                "status" "public"."installment_status" NOT NULL DEFAULT 'LOCKED',
                "due_date" date,
                "paid_at" TIMESTAMP WITH TIME ZONE,
                "paid_confirmed_by_id" uuid,
                "proof_document_id" uuid,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "CHK_94130c8e98c3410b1acc321590" CHECK ("market" IN ('CY', 'RS')),
                CONSTRAINT "PK_c74e44aa06bdebef2af0a93da1b" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "uq_installments_purchase_sequence" ON "installments" ("purchase_id", "sequence")
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."escrow_instruction_status" AS ENUM(
                'PENDING_APPROVAL',
                'APPROVED',
                'EXECUTED',
                'RETURNED'
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "escrow_instructions" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "market" character varying(2) NOT NULL,
                "installment_id" uuid NOT NULL,
                "purchase_id" uuid NOT NULL,
                "amount" integer NOT NULL,
                "bank_account_id" uuid NOT NULL,
                "status" "public"."escrow_instruction_status" NOT NULL DEFAULT 'PENDING_APPROVAL',
                "first_approver_id" uuid,
                "first_approved_at" TIMESTAMP WITH TIME ZONE,
                "second_approver_id" uuid,
                "second_approved_at" TIMESTAMP WITH TIME ZONE,
                "executed_by_id" uuid,
                "executed_at" TIMESTAMP WITH TIME ZONE,
                "return_reason" character varying(500),
                "created_by_id" uuid NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "CHK_f2d369e5453ef7ed25b4014343" CHECK ("market" IN ('CY', 'RS')),
                CONSTRAINT "PK_cb16575d010acb5355bedba5f56" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "uq_escrow_instructions_installment" ON "escrow_instructions" ("installment_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "ix_escrow_instructions_purchase_id" ON "escrow_instructions" ("purchase_id")
        `);
        await queryRunner.query(`
            CREATE TABLE "legal_teams" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "market" character varying(2) NOT NULL,
                "name" character varying(200) NOT NULL,
                "languages" text array NOT NULL DEFAULT '{}',
                "conflict_developer_ids" uuid array NOT NULL DEFAULT '{}',
                "active" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "CHK_e0b151ad5c1c7a93ea417a613f" CHECK ("market" IN ('CY', 'RS')),
                CONSTRAINT "PK_24d3f599097b90689ba3ea0e823" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."legal_team_role" AS ENUM('LEAD', 'LAWYER', 'ASSOCIATE')
        `);
        await queryRunner.query(`
            CREATE TABLE "legal_team_members" (
                "team_id" uuid NOT NULL,
                "user_id" uuid NOT NULL,
                "team_role" "public"."legal_team_role" NOT NULL,
                "license_number" character varying(64),
                "license_verified_at" TIMESTAMP WITH TIME ZONE,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_ca3b2b49b07a5e58cc86069a02c" PRIMARY KEY ("team_id", "user_id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "ix_legal_team_members_user_id" ON "legal_team_members" ("user_id")
        `);
        await queryRunner.query(`
            CREATE TABLE "purchase_messages" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "purchase_id" uuid NOT NULL,
                "author_id" uuid NOT NULL,
                "body" text NOT NULL,
                "internal" boolean NOT NULL DEFAULT false,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_721cfa17394bad879588f9d5cef" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "ix_purchase_messages_purchase_created" ON "purchase_messages" ("purchase_id", "created_at")
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."request_kind" AS ENUM('CHECK', 'QUESTION', 'GUIDED_PURCHASE')
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."request_status" AS ENUM(
                'NEW',
                'IN_TRIAGE',
                'WITH_LEGAL_TEAM',
                'ANSWERED',
                'CONVERTED',
                'CLOSED'
            )
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."answer_scope" AS ENUM('INFORMATION', 'ENGAGED_ADVICE')
        `);
        await queryRunner.query(`
            CREATE TABLE "buyer_requests" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "market" character varying(2) NOT NULL,
                "buyer_id" uuid NOT NULL,
                "kind" "public"."request_kind" NOT NULL,
                "status" "public"."request_status" NOT NULL DEFAULT 'NEW',
                "listing_url" character varying(500),
                "developer_name" character varying(200),
                "registration_number" character varying(32),
                "parcel_reference" character varying(120),
                "address" character varying(300),
                "question" text,
                "free_semaphore" jsonb,
                "developer_id" uuid,
                "project_id" uuid,
                "unit_id" uuid,
                "owner_user_id" uuid,
                "legal_team_id" uuid,
                "answer" text,
                "answer_scope" "public"."answer_scope",
                "answered_by_id" uuid,
                "answered_at" TIMESTAMP WITH TIME ZONE,
                "purchase_id" uuid,
                "first_response_due_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "CHK_4988dfcf270f1e9fd6098711b2" CHECK ("market" IN ('CY', 'RS')),
                CONSTRAINT "PK_2ce35a627504947914880113889" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "ix_buyer_requests_buyer_id" ON "buyer_requests" ("buyer_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "ix_buyer_requests_market_status" ON "buyer_requests" ("market", "status")
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."task_status" AS ENUM(
                'NEW',
                'IN_PROGRESS',
                'WAITING',
                'DONE',
                'REJECTED'
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "purchase_tasks" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "market" character varying(2) NOT NULL,
                "purchase_id" uuid NOT NULL,
                "type" character varying(64) NOT NULL,
                "title" character varying(300) NOT NULL,
                "assignee_user_id" uuid,
                "legal_team_id" uuid,
                "due_at" TIMESTAMP WITH TIME ZONE,
                "status" "public"."task_status" NOT NULL DEFAULT 'NEW',
                "waiting_reason" character varying(300),
                "result" text,
                "document_id" uuid,
                "created_by_id" uuid,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "completed_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "CHK_c42cc41df269cc67577a34835a" CHECK ("market" IN ('CY', 'RS')),
                CONSTRAINT "PK_25bcaf925bfe48ed25ba9c8ff1e" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "ix_purchase_tasks_purchase_id" ON "purchase_tasks" ("purchase_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "ix_purchase_tasks_assignee_status" ON "purchase_tasks" ("assignee_user_id", "status")
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."financing_type" AS ENUM('CASH', 'MORTGAGE')
        `);
        await queryRunner.query(`
            CREATE TABLE "buyer_profiles" (
                "user_id" uuid NOT NULL,
                "is_first_home" boolean NOT NULL DEFAULT false,
                "is_eu_citizen" boolean NOT NULL DEFAULT false,
                "primary_residence" boolean NOT NULL DEFAULT false,
                "financing" "public"."financing_type" NOT NULL DEFAULT 'CASH',
                "age" integer,
                "household_members" integer NOT NULL DEFAULT '1',
                "budget" integer,
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_8ef06dd95facdc3db875b449baf" PRIMARY KEY ("user_id")
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "powers_of_attorney" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "market" character varying(2) NOT NULL,
                "purchase_id" uuid NOT NULL,
                "document_id" uuid NOT NULL,
                "scope" text array NOT NULL,
                "valid_until" date,
                "revoked_at" TIMESTAMP WITH TIME ZONE,
                "created_by_id" uuid NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "CHK_c9d280988a2850a9a2736dc786" CHECK ("market" IN ('CY', 'RS')),
                CONSTRAINT "PK_f6091d2d1c8233b46b663a7de95" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "ix_powers_of_attorney_purchase_id" ON "powers_of_attorney" ("purchase_id")
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."phase_status" AS ENUM(
                'PLANNED',
                'IN_PROGRESS',
                'CONFIRMED',
                'REJECTED'
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "construction_phases" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "market" character varying(2) NOT NULL,
                "project_id" uuid NOT NULL,
                "phase_code" character varying(64) NOT NULL,
                "position" integer NOT NULL,
                "planned_date" date,
                "actual_date" date,
                "status" "public"."phase_status" NOT NULL DEFAULT 'PLANNED',
                "confirmed_by_id" uuid,
                "confirmed_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "CHK_78981cd3de705bf2fa0198f838" CHECK ("market" IN ('CY', 'RS')),
                CONSTRAINT "PK_64ac76b0901593e87f6f9bdd49e" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "uq_construction_phases_project_code" ON "construction_phases" ("project_id", "phase_code")
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."document_scope" AS ENUM('PURCHASE', 'PROJECT', 'DEVELOPER', 'REPORT')
        `);
        await queryRunner.query(`
            CREATE TABLE "documents" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "market" character varying(2) NOT NULL,
                "scope" "public"."document_scope" NOT NULL,
                "purchase_id" uuid,
                "project_id" uuid,
                "developer_id" uuid,
                "report_id" uuid,
                "type_code" character varying(64) NOT NULL,
                "file_name" character varying(255) NOT NULL,
                "mime_type" character varying(100) NOT NULL,
                "size_bytes" integer NOT NULL,
                "sha256" character(64) NOT NULL,
                "storage_key" character varying(300) NOT NULL,
                "uploaded_by_id" uuid NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "CHK_63ec32b2d829f95d40532a55d7" CHECK ("market" IN ('CY', 'RS')),
                CONSTRAINT "PK_ac51aa5181ee2036f5ca482857c" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "ix_documents_report_id" ON "documents" ("report_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "ix_documents_developer_id" ON "documents" ("developer_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "ix_documents_project_id" ON "documents" ("project_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "ix_documents_purchase_id" ON "documents" ("purchase_id")
        `);
        await queryRunner.query(`
            ALTER TABLE "user_markets"
            ADD CONSTRAINT "FK_ba09c358fbdaeb1e4721e8ac1a9" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "users"
            ADD CONSTRAINT "FK_1bbd34899b8e74ef2a7f3212806" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "user_roles"
            ADD CONSTRAINT "FK_87b8888186ca9769c960e926870" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "user_roles"
            ADD CONSTRAINT "FK_9e5850a29fcce99b277859f3dba" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "refresh_tokens"
            ADD CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "projects"
            ADD CONSTRAINT "FK_7bc486132eac301a4abc39a532d" FOREIGN KEY ("developer_id") REFERENCES "developers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "units"
            ADD CONSTRAINT "FK_e1d1963ddfadd3542dd5c52ee4f" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "purchase_steps"
            ADD CONSTRAINT "FK_e65e1d9fa30868572b3cf2f25b8" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "purchases"
            ADD CONSTRAINT "FK_a3886ad6e415bce0b2f25c136bc" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "purchases"
            ADD CONSTRAINT "FK_231a8b7413e01c45ebed038f1c3" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "defects"
            ADD CONSTRAINT "FK_bfc6135363d239a866de011c3be" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "engineer_reports"
            ADD CONSTRAINT "FK_800254fbaa5a7ddb690a809e082" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "handovers"
            ADD CONSTRAINT "FK_87c416dbf28017d1cb67c887de3" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "legal_opinions"
            ADD CONSTRAINT "FK_2e06f5facddf69bdd8feac7b670" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "notifications"
            ADD CONSTRAINT "FK_9a8a82462cab47c73d25f49261f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "developer_bank_accounts"
            ADD CONSTRAINT "FK_fe8babf5ef5590b74793aaf212c" FOREIGN KEY ("developer_id") REFERENCES "developers"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "installment_conditions"
            ADD CONSTRAINT "FK_030f44e6082b211a167c6fbe684" FOREIGN KEY ("installment_id") REFERENCES "installments"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "installments"
            ADD CONSTRAINT "FK_6955da417d01ccff8a3786a7858" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "escrow_instructions"
            ADD CONSTRAINT "FK_de04c51cf09b248e41086d923a2" FOREIGN KEY ("installment_id") REFERENCES "installments"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "escrow_instructions"
            ADD CONSTRAINT "FK_5df38abfee0eb8d915faceecf02" FOREIGN KEY ("bank_account_id") REFERENCES "developer_bank_accounts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "legal_team_members"
            ADD CONSTRAINT "FK_b14770d5278c581683284fffe2a" FOREIGN KEY ("team_id") REFERENCES "legal_teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "legal_team_members"
            ADD CONSTRAINT "FK_227201e93ef863c73471471c3e3" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "purchase_messages"
            ADD CONSTRAINT "FK_f83e1a23078483b9ff2752c9928" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "buyer_requests"
            ADD CONSTRAINT "FK_7188469ec2b8b82d9b652b56fbf" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "purchase_tasks"
            ADD CONSTRAINT "FK_89564c98c36fc93f3077896302b" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "buyer_profiles"
            ADD CONSTRAINT "FK_8ef06dd95facdc3db875b449baf" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "powers_of_attorney"
            ADD CONSTRAINT "FK_439a2aa4f2addfb829969a9ac26" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "construction_phases"
            ADD CONSTRAINT "FK_feca60a98e1db3f4969f726111c" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "construction_phases" DROP CONSTRAINT "FK_feca60a98e1db3f4969f726111c"
        `);
        await queryRunner.query(`
            ALTER TABLE "powers_of_attorney" DROP CONSTRAINT "FK_439a2aa4f2addfb829969a9ac26"
        `);
        await queryRunner.query(`
            ALTER TABLE "buyer_profiles" DROP CONSTRAINT "FK_8ef06dd95facdc3db875b449baf"
        `);
        await queryRunner.query(`
            ALTER TABLE "purchase_tasks" DROP CONSTRAINT "FK_89564c98c36fc93f3077896302b"
        `);
        await queryRunner.query(`
            ALTER TABLE "buyer_requests" DROP CONSTRAINT "FK_7188469ec2b8b82d9b652b56fbf"
        `);
        await queryRunner.query(`
            ALTER TABLE "purchase_messages" DROP CONSTRAINT "FK_f83e1a23078483b9ff2752c9928"
        `);
        await queryRunner.query(`
            ALTER TABLE "legal_team_members" DROP CONSTRAINT "FK_227201e93ef863c73471471c3e3"
        `);
        await queryRunner.query(`
            ALTER TABLE "legal_team_members" DROP CONSTRAINT "FK_b14770d5278c581683284fffe2a"
        `);
        await queryRunner.query(`
            ALTER TABLE "escrow_instructions" DROP CONSTRAINT "FK_5df38abfee0eb8d915faceecf02"
        `);
        await queryRunner.query(`
            ALTER TABLE "escrow_instructions" DROP CONSTRAINT "FK_de04c51cf09b248e41086d923a2"
        `);
        await queryRunner.query(`
            ALTER TABLE "installments" DROP CONSTRAINT "FK_6955da417d01ccff8a3786a7858"
        `);
        await queryRunner.query(`
            ALTER TABLE "installment_conditions" DROP CONSTRAINT "FK_030f44e6082b211a167c6fbe684"
        `);
        await queryRunner.query(`
            ALTER TABLE "developer_bank_accounts" DROP CONSTRAINT "FK_fe8babf5ef5590b74793aaf212c"
        `);
        await queryRunner.query(`
            ALTER TABLE "notifications" DROP CONSTRAINT "FK_9a8a82462cab47c73d25f49261f"
        `);
        await queryRunner.query(`
            ALTER TABLE "legal_opinions" DROP CONSTRAINT "FK_2e06f5facddf69bdd8feac7b670"
        `);
        await queryRunner.query(`
            ALTER TABLE "handovers" DROP CONSTRAINT "FK_87c416dbf28017d1cb67c887de3"
        `);
        await queryRunner.query(`
            ALTER TABLE "engineer_reports" DROP CONSTRAINT "FK_800254fbaa5a7ddb690a809e082"
        `);
        await queryRunner.query(`
            ALTER TABLE "defects" DROP CONSTRAINT "FK_bfc6135363d239a866de011c3be"
        `);
        await queryRunner.query(`
            ALTER TABLE "purchases" DROP CONSTRAINT "FK_231a8b7413e01c45ebed038f1c3"
        `);
        await queryRunner.query(`
            ALTER TABLE "purchases" DROP CONSTRAINT "FK_a3886ad6e415bce0b2f25c136bc"
        `);
        await queryRunner.query(`
            ALTER TABLE "purchase_steps" DROP CONSTRAINT "FK_e65e1d9fa30868572b3cf2f25b8"
        `);
        await queryRunner.query(`
            ALTER TABLE "units" DROP CONSTRAINT "FK_e1d1963ddfadd3542dd5c52ee4f"
        `);
        await queryRunner.query(`
            ALTER TABLE "projects" DROP CONSTRAINT "FK_7bc486132eac301a4abc39a532d"
        `);
        await queryRunner.query(`
            ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4"
        `);
        await queryRunner.query(`
            ALTER TABLE "user_roles" DROP CONSTRAINT "FK_9e5850a29fcce99b277859f3dba"
        `);
        await queryRunner.query(`
            ALTER TABLE "user_roles" DROP CONSTRAINT "FK_87b8888186ca9769c960e926870"
        `);
        await queryRunner.query(`
            ALTER TABLE "users" DROP CONSTRAINT "FK_1bbd34899b8e74ef2a7f3212806"
        `);
        await queryRunner.query(`
            ALTER TABLE "user_markets" DROP CONSTRAINT "FK_ba09c358fbdaeb1e4721e8ac1a9"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."ix_documents_purchase_id"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."ix_documents_project_id"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."ix_documents_developer_id"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."ix_documents_report_id"
        `);
        await queryRunner.query(`
            DROP TABLE "documents"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."document_scope"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."uq_construction_phases_project_code"
        `);
        await queryRunner.query(`
            DROP TABLE "construction_phases"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."phase_status"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."ix_powers_of_attorney_purchase_id"
        `);
        await queryRunner.query(`
            DROP TABLE "powers_of_attorney"
        `);
        await queryRunner.query(`
            DROP TABLE "buyer_profiles"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."financing_type"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."ix_purchase_tasks_assignee_status"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."ix_purchase_tasks_purchase_id"
        `);
        await queryRunner.query(`
            DROP TABLE "purchase_tasks"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."task_status"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."ix_buyer_requests_market_status"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."ix_buyer_requests_buyer_id"
        `);
        await queryRunner.query(`
            DROP TABLE "buyer_requests"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."answer_scope"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."request_status"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."request_kind"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."ix_purchase_messages_purchase_created"
        `);
        await queryRunner.query(`
            DROP TABLE "purchase_messages"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."ix_legal_team_members_user_id"
        `);
        await queryRunner.query(`
            DROP TABLE "legal_team_members"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."legal_team_role"
        `);
        await queryRunner.query(`
            DROP TABLE "legal_teams"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."ix_escrow_instructions_purchase_id"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."uq_escrow_instructions_installment"
        `);
        await queryRunner.query(`
            DROP TABLE "escrow_instructions"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."escrow_instruction_status"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."uq_installments_purchase_sequence"
        `);
        await queryRunner.query(`
            DROP TABLE "installments"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."installment_status"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."uq_installment_conditions_code"
        `);
        await queryRunner.query(`
            DROP TABLE "installment_conditions"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."condition_status"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."ix_developer_bank_accounts_developer_id"
        `);
        await queryRunner.query(`
            DROP TABLE "developer_bank_accounts"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."ix_notifications_user_created"
        `);
        await queryRunner.query(`
            DROP TABLE "notifications"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."ix_legal_opinions_purchase_id"
        `);
        await queryRunner.query(`
            DROP TABLE "legal_opinions"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."opinion_conclusion"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."uq_handovers_purchase_id"
        `);
        await queryRunner.query(`
            DROP TABLE "handovers"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."ix_engineer_reports_project_visit"
        `);
        await queryRunner.query(`
            DROP TABLE "engineer_reports"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."report_verdict"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."ix_checks_developer_code"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."ix_checks_project_code"
        `);
        await queryRunner.query(`
            DROP TABLE "checks"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."check_method"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."semaphore"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."check_subject"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."ix_defects_purchase_status"
        `);
        await queryRunner.query(`
            DROP TABLE "defects"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."defect_status"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."defect_severity"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."ix_purchases_market_status"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."ix_purchases_escrow_agent_id"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."ix_purchases_engineer_id"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."ix_purchases_legal_team_id"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."ix_purchases_coordinator_id"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."ix_purchases_project_id"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."ix_purchases_buyer_id"
        `);
        await queryRunner.query(`
            DROP TABLE "purchases"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."purchase_status"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."uq_purchase_steps_purchase_code"
        `);
        await queryRunner.query(`
            DROP TABLE "purchase_steps"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."step_status"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."uq_units_project_label"
        `);
        await queryRunner.query(`
            DROP TABLE "units"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."unit_status"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."ix_projects_city"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."ix_projects_developer_id"
        `);
        await queryRunner.query(`
            DROP TABLE "projects"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."project_status"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."uq_developers_market_registration"
        `);
        await queryRunner.query(`
            DROP TABLE "developers"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."uq_refresh_tokens_token_hash"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."ix_refresh_tokens_family_id"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."ix_refresh_tokens_user_id"
        `);
        await queryRunner.query(`
            DROP TABLE "refresh_tokens"
        `);
        await queryRunner.query(`
            DROP TABLE "user_roles"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."role"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."uq_users_email"
        `);
        await queryRunner.query(`
            DROP TABLE "users"
        `);
        await queryRunner.query(`
            DROP TABLE "user_markets"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."ix_audit_events_entity"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."ix_audit_events_created_at"
        `);
        await queryRunner.query(`
            DROP TABLE "audit_events"
        `);
    }

}
