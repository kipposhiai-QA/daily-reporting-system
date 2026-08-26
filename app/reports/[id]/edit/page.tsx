import { ReportForm } from "@/components/reports/report-form";

export default async function EditReportPage({ params }: PageProps<"/reports/[id]/edit">) {
  const { id } = await params;
  return <ReportForm mode="edit" reportId={id} />;
}
