-- AlterTable
ALTER TABLE "sales_person" ADD COLUMN     "auth_user_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "sales_person_auth_user_id_key" ON "sales_person"("auth_user_id");
