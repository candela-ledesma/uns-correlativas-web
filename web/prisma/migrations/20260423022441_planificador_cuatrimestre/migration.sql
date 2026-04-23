/*
  Warnings:

  - The primary key for the `Session` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "public"."Session" DROP CONSTRAINT "Session_pkey";
