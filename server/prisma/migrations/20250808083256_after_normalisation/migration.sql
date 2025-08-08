/*
  Warnings:

  - You are about to drop the column `updated_at` on the `Users` table. All the data in the column will be lost.
  - You are about to drop the column `updated_by` on the `Users` table. All the data in the column will be lost.
  - You are about to drop the column `usersId` on the `Comments` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Tickets` table. All the data in the column will be lost.
  - You are about to drop the column `usersId` on the `Tickets` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Core"."Users" DROP CONSTRAINT "Users_updated_by_fkey";

-- DropForeignKey
ALTER TABLE "Workspace"."Comments" DROP CONSTRAINT "Comments_usersId_fkey";

-- DropForeignKey
ALTER TABLE "Workspace"."Tickets" DROP CONSTRAINT "Tickets_usersId_fkey";

-- DropIndex
DROP INDEX "Core"."RolePermission_role_id_permission_id_key";

-- AlterTable
ALTER TABLE "Core"."Users" DROP COLUMN "updated_at",
DROP COLUMN "updated_by";

-- AlterTable
ALTER TABLE "Workspace"."Comments" DROP COLUMN "usersId";

-- AlterTable
ALTER TABLE "Workspace"."Tickets" DROP COLUMN "type",
DROP COLUMN "usersId";
