// 日付・時刻・日時のフォーマット統一ユーティリティ
// 参照: docs/api-specification.md 1.1 ベースURL・フォーマット
//   - 日付: YYYY-MM-DD（Prisma上は @db.Date、UTC 0時のDateとして保持される）
//   - 時刻: HH:mm（Prisma上は @db.Time、1970-01-01 のUTC時刻として保持される）
//   - 日時: ISO8601 +09:00（例: 2026-08-25T10:00:00+09:00）
import { z } from "zod";
import "./zod-openapi-setup";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_ONLY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function pad(value: number, length: number): string {
  return String(value).padStart(length, "0");
}

/** "YYYY-MM-DD" 文字列を、その日のUTC0時を表す Date に変換する（Prismaの @db.Date 用）。 */
export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** Date を "YYYY-MM-DD" 文字列に変換する（UTC基準。parseDateOnly の逆変換）。 */
export function formatDateOnly(date: Date): string {
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}`;
}

/** "HH:mm" 文字列を、1970-01-01のUTC時刻を表す Date に変換する（Prismaの @db.Time 用）。 */
export function parseTimeOnly(value: string): Date {
  return new Date(`1970-01-01T${value}:00.000Z`);
}

/** Date を "HH:mm" 文字列に変換する（UTC基準。parseTimeOnly の逆変換）。 */
export function formatTimeOnly(date: Date): string {
  return `${pad(date.getUTCHours(), 2)}:${pad(date.getUTCMinutes(), 2)}`;
}

/** Date（内部的にはUTC）を JST(+09:00) 固定オフセットの ISO8601 文字列に変換する。 */
export function formatDateTimeJst(date: Date): string {
  const jst = new Date(date.getTime() + JST_OFFSET_MS);
  const datePart = `${pad(jst.getUTCFullYear(), 4)}-${pad(jst.getUTCMonth() + 1, 2)}-${pad(jst.getUTCDate(), 2)}`;
  const timePart = `${pad(jst.getUTCHours(), 2)}:${pad(jst.getUTCMinutes(), 2)}:${pad(jst.getUTCSeconds(), 2)}`;
  return `${datePart}T${timePart}+09:00`;
}

function isValidDateOnly(value: string): boolean {
  return DATE_ONLY_PATTERN.test(value) && formatDateOnly(parseDateOnly(value)) === value;
}

/** リクエストボディ・クエリパラメータの "YYYY-MM-DD" 検証用スキーマ。 */
export const dateOnlySchema = z
  .string()
  .refine(isValidDateOnly, { message: "日付はYYYY-MM-DD形式の実在する日付で入力してください" });

/** リクエストボディの "HH:mm" 検証用スキーマ。 */
export const timeOnlySchema = z
  .string()
  .regex(TIME_ONLY_PATTERN, "時刻はHH:mm形式で入力してください");
