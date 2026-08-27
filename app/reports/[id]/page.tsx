import { ReportDetail } from "@/components/reports/report-detail";

export default async function ReportDetailPage({ params }: PageProps<"/reports/[id]">) {
  const { id } = await params;
  return <ReportDetail reportId={id} />;
}
