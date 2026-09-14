import { CustomerForm } from "@/components/customers/customer-form";

export default async function EditCustomerPage({ params }: PageProps<"/customers/[id]/edit">) {
  const { id } = await params;
  return <CustomerForm mode="edit" customerId={id} />;
}
