import { PageLayout } from "@/components/layout/PageLayout";
import { ServiceStore } from "@/components/store/ServiceStore";

export default function ClientStorePage() {
  return (
    <PageLayout role="client">
      <ServiceStore role="client" />
    </PageLayout>
  );
}
