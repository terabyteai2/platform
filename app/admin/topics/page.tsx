import { AdminTopicsListPage } from "@/components/AdminTopicsListPage";
import { isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminTopicsListRoute() {
  if (!(await isAdmin())) redirect("/");
  return <AdminTopicsListPage />;
}
