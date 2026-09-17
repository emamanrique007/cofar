import { redirect } from "next/navigation";

import { Dashboard } from "@/components/dashboard/Dashboard/Dashboard";
import { createServerClient } from "@/utils/supabase/supabase.server";

const DashboardPage = async () => {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/login");
  }

  return <Dashboard email={data.user.email ?? ""} />;
};

export default DashboardPage;
