// 日報APIのZodスキーマ・レスポンス変換
// 参照: docs/api-specification.md 5. 日報 API
import { z } from "zod";
import { Prisma, type ReportStatus } from "@/generated/prisma/client";
import {
  dateOnlySchema,
  formatDateOnly,
  formatDateTimeJst,
  formatTimeOnly,
  timeOnlySchema,
} from "@/lib/api/datetime";
import { ApiError } from "@/lib/api/errors";
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

/** GET /api/reports/:id・POST・PUTで共通して使う include 形状。toReportDetailResponse の入力と対応する。 */
export const reportDetailInclude = {
  sales_person: { select: { name: true } },
  visit_records: {
    include: { customer: { select: { company_name: true } } },
    orderBy: { visit_time: "asc" },
  },
  comments: {
    include: { manager: { select: { name: true } } },
    orderBy: { created_at: "asc" },
  },
} as const;

const visitRecordBodySchema = z.object({
  customer_id: z.number().int().openapi({ example: 1 }),
  visit_content: z.string().min(1, "訪問内容は必須です").openapi({ example: "新商品の提案を実施" }),
  visit_time: timeOnlySchema.optional().openapi({ example: "10:00" }),
});

/**
 * POST/PUT 共通のリクエストボディ。docs/api-specification.md 5.3 のバリデーション表に対応する。
 * status=SUBMITTEDの場合はvisit_recordsが1件以上必須（superRefineで検証）。
 */
export const reportBodySchema = registry.register(
  "ReportBody",
  z
    .object({
      report_date: dateOnlySchema.openapi({ example: "2026-08-25" }),
      status: reportStatusSchema,
      problem: z
        .string()
        .nullable()
        .optional()
        .openapi({ example: "A社の見積もり承認が遅れている" }),
      plan: z.string().nullable().optional().openapi({ example: "C社へ初回訪問予定" }),
      visit_records: z.array(visitRecordBodySchema),
    })
    .superRefine((data, ctx) => {
      if (data.status === "SUBMITTED" && data.visit_records.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["visit_records"],
          message: "提出する場合は訪問記録を1件以上入力してください",
        });
      }
    }),
);

export type ReportBody = z.infer<typeof reportBodySchema>;

/**
 * 日報作成・更新で発生しうるPrismaの制約違反エラーを共通エラー形式に変換して投げ直す。
 * P2002: (sales_person_id, report_date) の一意制約違反 / P2025: 対象レコード無し /
 * P2003: visit_records.customer_id が存在しない顧客を指すことによる外部キー制約違反（Issue #92）。
 */
export function mapReportPrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new ApiError("CONFLICT", "同じ営業担当者・対象日の日報が既に存在します");
    }
    if (error.code === "P2025") {
      throw new ApiError("NOT_FOUND", "指定された日報が見つかりません");
    }
    if (error.code === "P2003") {
      throw new ApiError("VALIDATION_ERROR", "指定された顧客が見つかりません", [
        { field: "visit_records", message: "存在しない顧客が指定されています" },
      ]);
    }
  }
  throw error;
}

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
