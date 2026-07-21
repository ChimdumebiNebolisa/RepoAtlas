import { HomePage } from "@/components/HomePage";
import { analyzeBundledSample } from "@/lib/bundledSample";

export default async function Page() {
  const { report } = await analyzeBundledSample();
  return <HomePage sampleReport={report} />;
}
