import { PageLayout } from "@/components/layout/PageLayout";
import { ServiceStore } from "@/components/store/ServiceStore";

export default function ConsultantStorePage() {
  return (
    <PageLayout role="consultant">
      <ServiceStore role="consultant" />
    </PageLayout>
  );
}
