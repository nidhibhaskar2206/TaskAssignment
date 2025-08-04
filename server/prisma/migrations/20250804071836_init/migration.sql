/*
  Warnings:

  - Added the required column `owner_id` to the `Task` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."PermissionEnum" AS ENUM ('READ', 'WRITE', 'DELETE', 'ASSIGN');

-- AlterTable
ALTER TABLE "public"."Task" ADD COLUMN     "owner_id" INTEGER NOT NULL,
ADD COLUMN     "parent_task_id" INTEGER;

-- AddForeignKey
ALTER TABLE "public"."Task" ADD CONSTRAINT "Task_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Task" ADD CONSTRAINT "Task_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "public"."Task"("task_id") ON DELETE SET NULL ON UPDATE CASCADE;
