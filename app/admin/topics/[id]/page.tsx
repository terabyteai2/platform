import { AdminTopicEditor } from "@/components/AdminTopicEditor";
import { isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminTopicDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdmin())) redirect("/");
  const { id } = await params;
  return <AdminTopicEditor topicId={id} />;
}
