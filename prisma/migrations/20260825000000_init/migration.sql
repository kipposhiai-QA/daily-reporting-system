-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "report_status" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateTable
CREATE TABLE "sales_person" (
    "sales_person_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "department" TEXT,
    "is_manager" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_person_pkey" PRIMARY KEY ("sales_person_id")
);

-- CreateTable
CREATE TABLE "customer" (
    "customer_id" SERIAL NOT NULL,
    "company_name" TEXT NOT NULL,
    "contact_person" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_pkey" PRIMARY KEY ("customer_id")
);

-- CreateTable
CREATE TABLE "daily_report" (
    "report_id" SERIAL NOT NULL,
    "sales_person_id" INTEGER NOT NULL,
    "report_date" DATE NOT NULL,
    "status" "report_status" NOT NULL DEFAULT 'DRAFT',
    "problem" TEXT,
    "plan" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_report_pkey" PRIMARY KEY ("report_id")
);

-- CreateTable
CREATE TABLE "visit_record" (
    "visit_id" SERIAL NOT NULL,
    "report_id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "visit_content" TEXT NOT NULL,
    "visit_time" TIME,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visit_record_pkey" PRIMARY KEY ("visit_id")
);

-- CreateTable
CREATE TABLE "manager_comment" (
    "comment_id" SERIAL NOT NULL,
    "report_id" INTEGER NOT NULL,
    "manager_id" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manager_comment_pkey" PRIMARY KEY ("comment_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_person_email_key" ON "sales_person"("email");

-- CreateIndex
CREATE UNIQUE INDEX "daily_report_sales_person_id_report_date_key" ON "daily_report"("sales_person_id", "report_date");

-- AddForeignKey
ALTER TABLE "daily_report" ADD CONSTRAINT "daily_report_sales_person_id_fkey" FOREIGN KEY ("sales_person_id") REFERENCES "sales_person"("sales_person_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_record" ADD CONSTRAINT "visit_record_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "daily_report"("report_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_record" ADD CONSTRAINT "visit_record_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("customer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_comment" ADD CONSTRAINT "manager_comment_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "daily_report"("report_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_comment" ADD CONSTRAINT "manager_comment_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "sales_person"("sales_person_id") ON DELETE RESTRICT ON UPDATE CASCADE;

