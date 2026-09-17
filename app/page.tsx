import { DashboardPage } from "@/components/dashboard-page";
import { getPrimaryUser } from "@/lib/bootstrap";
import { getDashboardData } from "@/lib/dashboard";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home(props: PageProps) {
  const params = (await props.searchParams) ?? {};
  const user = await getPrimaryUser();
  const data = await getDashboardData(user.id);

  return (
    <DashboardPage
      data={data}
      status={typeof params.status === "string" ? params.status : undefined}
      detail={typeof params.detail === "string" ? params.detail : undefined}
    />
  );
}
