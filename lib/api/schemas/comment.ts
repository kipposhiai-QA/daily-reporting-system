// コメントAPIのZodスキーマ・レスポンス変換
// 参照: docs/api-specification.md 6. コメント API
import { z } from "zod";
import { formatDateTimeJst } from "@/lib/api/datetime";
import { registry } from "@/lib/api/openapi";

/** POST /api/reports/:id/comments のリクエストボディ。 */
export const commentBodySchema = registry.register(
  "CommentBody",
  z.object({
    comment: z
      .string()
      .min(1, "コメントは必須です")
      .openapi({ example: "見積もりの件、私からも確認します" }),
  }),
);

export type CommentBody = z.infer<typeof commentBodySchema>;

export const commentResponseSchema = registry.register(
  "CommentCreateResponse",
  z.object({
    comment_id: z.number().int().openapi({ example: 201 }),
    report_id: z.number().int().openapi({ example: 10 }),
    manager_id: z.number().int().openapi({ example: 5 }),
    manager_name: z.string().openapi({ example: "鈴木一郎" }),
    comment: z.string().openapi({ example: "見積もりの件、私からも確認します" }),
    created_at: z.string().openapi({ example: "2026-08-25T19:10:00+09:00" }),
  }),
);

export type CommentResponse = z.infer<typeof commentResponseSchema>;

type CommentInput = {
  comment_id: number;
  report_id: number;
  manager_id: number;
  manager: { name: string };
  comment: string;
  created_at: Date;
};

export function toCommentResponse(comment: CommentInput): CommentResponse {
  return {
    comment_id: comment.comment_id,
    report_id: comment.report_id,
    manager_id: comment.manager_id,
    manager_name: comment.manager.name,
    comment: comment.comment,
    created_at: formatDateTimeJst(comment.created_at),
  };
}
