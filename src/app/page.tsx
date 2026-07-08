import { buildSampleReport } from "@/lib/buildSampleReport";
import { HomePage } from "@/components/HomePage";

export default function Page() {
  const sampleReport = buildSampleReport();
  return <HomePage sampleReport={sampleReport} />;
}
