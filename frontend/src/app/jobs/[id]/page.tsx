import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JobDetail } from "@/components/job-detail";
import type { Job } from "@/lib/types";

type PageProps = { params: Promise<{ id: string }> };
type JobResponse = { data: Job };

async function fetchJob(id: string): Promise<Job | null> {
  const baseUrl = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";
  try {
    const response = await fetch(`${baseUrl}/jobs/${id}`, { next: { revalidate: 60 } });
    if (!response.ok) return null;
    return (await response.json() as JobResponse).data;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const job = await fetchJob(id);
  if (!job) return { title: "Role unavailable", robots: { index: false, follow: false } };
  const description = `${job.title} at ${job.company.name} in ${[job.locationCity, job.locationCountry].filter(Boolean).join(", ")}. Explore this opportunity on TalentSpring.`;
  return { title: `${job.title} at ${job.company.name}`, description, openGraph: { title: `${job.title} at ${job.company.name}`, description, type: "website" } };
}

export default async function JobPage({ params }: PageProps) {
  const { id } = await params;
  const job = await fetchJob(id);
  if (!job) notFound();
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description,
    datePosted: job.createdAt,
    ...(job.expiresAt ? { validThrough: job.expiresAt } : {}),
    employmentType: job.employmentType,
    hiringOrganization: { "@type": "Organization", name: job.company.name, ...(job.company.websiteUrl ? { sameAs: job.company.websiteUrl } : {}), ...(job.company.logoUrl ? { logo: job.company.logoUrl } : {}) },
    ...(job.workplaceType === "REMOTE" ? {
      jobLocationType: "TELECOMMUTE",
      ...(job.locationCountry ? { applicantLocationRequirements: { "@type": "Country", name: job.locationCountry } } : {}),
    } : job.locationCity || job.locationCountry ? {
      jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", ...(job.locationCity ? { addressLocality: job.locationCity } : {}), ...(job.locationCountry ? { addressCountry: job.locationCountry } : {}) } },
    } : {}),
    ...(job.minSalary != null && job.maxSalary != null ? { baseSalary: { "@type": "MonetaryAmount", currency: job.currency, value: { "@type": "QuantitativeValue", minValue: Number(job.minSalary), maxValue: Number(job.maxSalary), unitText: "YEAR" } } } : {}),
  };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    <JobDetail jobId={id} initialJob={job} />
  </>;
}
