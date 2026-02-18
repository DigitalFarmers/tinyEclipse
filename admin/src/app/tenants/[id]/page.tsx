import { redirect } from "next/navigation";
export default function TenantDetailRedirect({ params }: { params: { id: string } }) { redirect(`/admin/tenants/${params.id}`); }
