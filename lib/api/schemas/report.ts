// 日報APIのZodスキーマ・レスポンス変換
// 参照: docs/api-specification.md 5. 日報 API
import { z } from "zod";
import type { ReportStatus } from "@/generated/prisma/client";
import {
  dateOnlySchema,
  formatDateOnly,
  formatDateTimeJst,
  formatTimeOnly,
} from "@/lib/api/datetime";
import { registry } from "@/lib/api/openapi";

const reportStatusSchema = z.enum(["DRAFT", "SUBMITTED"]).openapi("ReportStatus");

export const visitRecordResponseSchema = registry.register(
  "VisitRecord",
  z.object({
    visit_id: z.number().int().openapi({ example: 101 }),
    customer_id: z.number().int().openapi({ example: 1 }),
    customer_name: z.string().openapi({ example: "株式会社A社" }),
    visit_content: z.string().openapi({ example: "新商品の提案を実施" }),
    visit_time: z.string().nullable().openapi({ example: "10:00" }),
    created_at: z.string().openapi({ example: "2026-08-25T18:00:00+09:00" }),
  }),
);

export const managerCommentResponseSchema = registry.register(
  "ManagerComment",
  z.object({
    comment_id: z.number().int().openapi({ example: 201 }),
    manager_id: z.number().int().openapi({ example: 5 }),
    manager_name: z.string().openapi({ example: "鈴木一郎" }),
    comment: z.string().openapi({ example: "見積もりの件、私からも確認します" }),
    created_at: z.string().openapi({ example: "2026-08-25T19:10:00+09:00" }),
  }),
);

export const reportListItemResponseSchema = registry.register(
  "ReportListItem",
  z.object({
    report_id: z.number().int().openapi({ example: 10 }),
    sales_person_id: z.number().int().openapi({ example: 1 }),
    sales_person_name: z.string().openapi({ example: "山田太郎" }),
    report_date: z.string().openapi({ example: "2026-08-25" }),
    status: reportStatusSchema,
    visit_count: z.number().int().openapi({ example: 2 }),
  }),
);

export type ReportListItemResponse = z.infer<typeof reportListItemResponseSchema>;

export const reportDetailResponseSchema = registry.register(
  "ReportDetail",
  z.object({
    report_id: z.number().int().openapi({ example: 10 }),
    sales_person_id: z.number().int().openapi({ example: 1 }),
    sales_person_name: z.string().openapi({ example: "山田太郎" }),
    report_date: z.string().openapi({ example: "2026-08-25" }),
    status: reportStatusSchema,
    problem: z.string().nullable().openapi({ example: "A社の見積もり承認が遅れている" }),
    plan: z.string().nullable().openapi({ example: "C社へ初回訪問予定" }),
    created_at: z.string().openapi({ example: "2026-08-25T18:00:00+09:00" }),
    updated_at: z.string().openapi({ example: "2026-08-25T18:00:00+09:00" }),
    visit_records: z.array(visitRecordResponseSchema),
    comments: z.array(managerCommentResponseSchema),
  }),
);

export type ReportDetailResponse = z.infer<typeof reportDetailResponseSchema>;

/** GET /api/reports のクエリパラメータ。 */
export const reportListQuerySchema = registry.register(
  "ReportListQuery",
  z.object({
    date_from: dateOnlySchema.optional().openapi({ example: "2026-08-01" }),
    date_to: dateOnlySchema.optional().openapi({ example: "2026-08-31" }),
    sales_person_id: z
      .string()
      .regex(/^\d+$/, "sales_person_idは数値で指定してください")
      .transform(Number)
      .optional()
      .openapi({ example: "1" }),
  }),
);

type ReportListItemInput = {
  report_id: number;
  sales_person_id: number;
  sales_person: { name: string };
  report_date: Date;
  status: ReportStatus;
  _count: { visit_records: number };
};

export function toReportListItemResponse(report: ReportListItemInput): ReportListItemResponse {
  return {
    report_id: report.report_id,
    sales_person_id: report.sales_person_id,
    sales_person_name: report.sales_person.name,
    report_date: formatDateOnly(report.report_date),
    status: report.status,
    visit_count: report._count.visit_records,
  };
}

type ReportDetailInput = {
  report_id: number;
  sales_person_id: number;
  sales_person: { name: string };
  report_date: Date;
  status: ReportStatus;
  problem: string | null;
  plan: string | null;
  created_at: Date;
  updated_at: Date;
  visit_records: {
    visit_id: number;
    customer_id: number;
    customer: { company_name: string };
    visit_content: string;
    visit_time: Date | null;
    created_at: Date;
  }[];
  comments: {
    comment_id: number;
    manager_id: number;
    manager: { name: string };
    comment: string;
    created_at: Date;
  }[];
};

export function toReportDetailResponse(report: ReportDetailInput): ReportDetailResponse {
  return {
    report_id: report.report_id,
    sales_person_id: report.sales_person_id,
    sales_person_name: report.sales_person.name,
    report_date: formatDateOnly(report.report_date),
    status: report.status,
    problem: report.problem,
    plan: report.plan,
    created_at: formatDateTimeJst(report.created_at),
    updated_at: formatDateTimeJst(report.updated_at),
    visit_records: report.visit_records.map((visit) => ({
      visit_id: visit.visit_id,
      customer_id: visit.customer_id,
      customer_name: visit.customer.company_name,
      visit_content: visit.visit_content,
      visit_time: visit.visit_time ? formatTimeOnly(visit.visit_time) : null,
      created_at: formatDateTimeJst(visit.created_at),
    })),
    comments: report.comments.map((comment) => ({
      comment_id: comment.comment_id,
      manager_id: comment.manager_id,
      manager_name: comment.manager.name,
      comment: comment.comment,
      created_at: formatDateTimeJst(comment.created_at),
    })),
  };
}
