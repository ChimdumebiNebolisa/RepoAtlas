import Link from "next/link";

type GuideComparisonLinksProps = {
  lead: string;
};

export function GuideComparisonLinks({ lead }: GuideComparisonLinksProps) {
  return (
    <nav className="guide-comparison-links" aria-label="Compare repository preparation methods">
      <p>
        {lead}{" "}
        <Link href="/codebase-interview-preparation">
          Compare structured preparation with ad hoc browsing
        </Link>
        {" or "}
        <Link href="/ai-codebase-summary">
          compare an AI codebase summary with an evidence-linked brief
        </Link>
        {", or "}
        <Link href="/take-home-coding-interview">
          review a take-home coding assignment
        </Link>
        {", or "}
        <Link href="/code-review-interview">
          practice an evidence-first code review interview
        </Link>
        .
      </p>
    </nav>
  );
}
