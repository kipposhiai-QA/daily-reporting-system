"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrentUser } from "@/lib/current-user-context";

function roleLabel(isManager: boolean): string {
  return isManager ? "上長" : "営業";
}

export function SalesPersonList() {
  const router = useRouter();
  const { salesPersons, isLoading, error, isManager } = useCurrentUser();

  function goToEdit(salesPersonId: number) {
    router.push(`/sales-persons/${salesPersonId}/edit`);
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">営業マスタ</h1>
        <div className="flex gap-2">
          {isManager ? (
            <Button asChild variant="outline">
              <Link href="/sales-persons/invite">招待する</Link>
            </Button>
          ) : null}
          <Button asChild>
            <Link href="/sales-persons/new">＋新規登録</Link>
          </Button>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>氏名</TableHead>
              <TableHead>メールアドレス</TableHead>
              <TableHead>部署</TableHead>
              <TableHead>区分</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground text-center">
                  読み込み中...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={4} className="text-destructive text-center">
                  {error}
                </TableCell>
              </TableRow>
            ) : salesPersons.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground text-center">
                  データがありません
                </TableCell>
              </TableRow>
            ) : (
              salesPersons.map((salesPerson) => (
                <TableRow
                  key={salesPerson.sales_person_id}
                  tabIndex={0}
                  onClick={() => goToEdit(salesPerson.sales_person_id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") goToEdit(salesPerson.sales_person_id);
                  }}
                  className="cursor-pointer"
                >
                  <TableCell>{salesPerson.name}</TableCell>
                  <TableCell>{salesPerson.email}</TableCell>
                  <TableCell>{salesPerson.department ?? ""}</TableCell>
                  <TableCell>{roleLabel(salesPerson.is_manager)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
