/*
  Warnings:

  - You are about to drop the column `workspace_id` on the `Comments` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Workspace"."Comments" DROP CONSTRAINT "Comments_workspace_id_fkey";

-- AlterTable
ALTER TABLE "Workspace"."Comments" DROP COLUMN "workspace_id";
