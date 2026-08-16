import type { MetadataRoute } from "next";

const baseUrl = "https://repo-atlas-phi.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: baseUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/interview-preparation`, changeFrequency: "monthly", priority: 0.8 },
    {
      url: `${baseUrl}/repository-walkthrough-interview`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/how-to-walk-through-a-project-in-an-interview`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/take-home-coding-interview`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/codebase-interview-preparation`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/ai-codebase-summary`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/examples/fastapi-candidate-brief`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/code-review-interview`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    { url: `${baseUrl}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${baseUrl}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${baseUrl}/contact`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
