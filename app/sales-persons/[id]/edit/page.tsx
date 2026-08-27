import { SalesPersonForm } from "@/components/sales-persons/sales-person-form";

export default async function EditSalesPersonPage({
  params,
}: PageProps<"/sales-persons/[id]/edit">) {
  const { id } = await params;
  return <SalesPersonForm mode="edit" salesPersonId={id} />;
}
