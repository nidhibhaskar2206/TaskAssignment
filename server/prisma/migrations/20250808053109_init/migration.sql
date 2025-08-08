-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "Core";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "Workspace";

-- CreateEnum
CREATE TYPE "Core"."UserType" AS ENUM ('SUPER_ADMIN', 'OTHER');

-- CreateEnum
CREATE TYPE "Core"."Operation" AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'COMMENT', 'MANAGE');

-- CreateEnum
CREATE TYPE "Workspace"."TicketType" AS ENUM ('TASK', 'RAID');

-- CreateEnum
CREATE TYPE "Workspace"."TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "Workspace"."TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "Core"."Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "admin_id" TEXT NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Core"."Users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "user_type" "Core"."UserType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "mfa_enabled" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "updated_by" TEXT,

    CONSTRAINT "Users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Core"."Role" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "desc" TEXT,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Core"."Permission" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "operation" "Core"."Operation" NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Core"."RolePermission" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Core"."UserRole" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Core"."MFACodes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MFACodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace"."Tickets" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "ticket_type" "Workspace"."TicketType" NOT NULL,
    "title" TEXT NOT NULL,
    "desc" TEXT NOT NULL,
    "status" "Workspace"."TicketStatus" NOT NULL,
    "priority" "Workspace"."TicketPriority" NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "type" TEXT NOT NULL,
    "assigned_to" TEXT NOT NULL,
    "parent_id" TEXT,
    "usersId" TEXT,

    CONSTRAINT "Tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace"."Comments" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parent_id" TEXT,
    "usersId" TEXT,

    CONSTRAINT "Comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace"."History" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "field_changed" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "changed_by" TEXT NOT NULL,

    CONSTRAINT "History_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Users_email_key" ON "Core"."Users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_workspace_id_name_key" ON "Core"."Role"("workspace_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_entity_operation_key" ON "Core"."Permission"("entity", "operation");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_role_id_permission_id_key" ON "Core"."RolePermission"("role_id", "permission_id");

-- AddForeignKey
ALTER TABLE "Core"."Workspace" ADD CONSTRAINT "Workspace_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "Core"."Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Core"."Users" ADD CONSTRAINT "Users_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "Core"."Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Core"."Role" ADD CONSTRAINT "Role_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Core"."Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Core"."RolePermission" ADD CONSTRAINT "RolePermission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Core"."Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Core"."RolePermission" ADD CONSTRAINT "RolePermission_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "Core"."Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Core"."UserRole" ADD CONSTRAINT "UserRole_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Core"."Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Core"."UserRole" ADD CONSTRAINT "UserRole_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Core"."Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Core"."UserRole" ADD CONSTRAINT "UserRole_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Core"."Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Core"."MFACodes" ADD CONSTRAINT "MFACodes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Core"."Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace"."Tickets" ADD CONSTRAINT "Tickets_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Core"."Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace"."Tickets" ADD CONSTRAINT "Tickets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "Core"."Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace"."Tickets" ADD CONSTRAINT "Tickets_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "Core"."Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace"."Tickets" ADD CONSTRAINT "Tickets_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "Core"."Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace"."Tickets" ADD CONSTRAINT "Tickets_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "Workspace"."Tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace"."Tickets" ADD CONSTRAINT "Tickets_usersId_fkey" FOREIGN KEY ("usersId") REFERENCES "Core"."Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace"."Comments" ADD CONSTRAINT "Comments_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Core"."Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace"."Comments" ADD CONSTRAINT "Comments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "Workspace"."Tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace"."Comments" ADD CONSTRAINT "Comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Core"."Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace"."Comments" ADD CONSTRAINT "Comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "Workspace"."Comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace"."Comments" ADD CONSTRAINT "Comments_usersId_fkey" FOREIGN KEY ("usersId") REFERENCES "Core"."Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace"."History" ADD CONSTRAINT "History_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Core"."Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace"."History" ADD CONSTRAINT "History_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "Workspace"."Tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace"."History" ADD CONSTRAINT "History_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "Core"."Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
