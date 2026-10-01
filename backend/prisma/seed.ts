import "dotenv/config";
import argon2 from "argon2";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { ApplicationStatus, CompanyMemberRole, JobStatus, PrismaClient, RoleName, WorkplaceType, EmploymentType, ExperienceLevel } from "@prisma/client";
import { s3, uploadBucket } from "../src/config/storage";

const prisma = new PrismaClient();
const demoPassword = process.env.SEED_PASSWORD ?? "JobPortal123!";
const skills = ["Node.js", "React", "PostgreSQL", "TypeScript", "Python", "AWS", "Docker", "Redis", "Next.js", "GraphQL"];

function createDemoPdf(): Buffer {
  const content = "BT /F1 18 Tf 72 720 Td (TalentSpring Demo Resume) Tj /F1 11 Tf 0 -28 Td (Sample document for local development and testing.) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let document = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(document));
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(document);
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) document += `${String(offset).padStart(10, "0")} 00000 n \n`;
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(document);
}

async function main(): Promise<void> {
  const roleIds = new Map<RoleName, string>();
  for (const name of Object.values(RoleName)) {
    const role = await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
    roleIds.set(name, role.id);
  }

  const passwordHash = await argon2.hash(demoPassword, { type: argon2.argon2id, memoryCost: 65_536, parallelism: 2, timeCost: 3 });
  async function seedUser(email: string, firstName: string, lastName: string, role: RoleName) {
    const user = await prisma.user.upsert({
      where: { email },
      create: { email, firstName, lastName, passwordHash, roles: { create: { roleId: roleIds.get(role)! } } },
      update: { firstName, lastName, passwordHash, status: "ACTIVE" },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: roleIds.get(role)! } },
      create: { userId: user.id, roleId: roleIds.get(role)! },
      update: {},
    });
    return user;
  }

  const admin = await seedUser("admin@jobportal.com", "Portal", "Admin", RoleName.ADMIN);
  const companyData = [
    { name: "TechCorp", slug: "techcorp", industry: "Software", companySize: "201-500", description: "Technology company building tools for modern teams." },
    { name: "DesignStudio", slug: "designstudio", industry: "Design", companySize: "51-200", description: "Independent product design and digital experiences studio." },
  ];
  const companies = [];
  for (const data of companyData) {
    companies.push(await prisma.company.upsert({ where: { slug: data.slug }, create: data, update: data }));
  }

  const recruiters = [];
  for (let index = 0; index < 4; index += 1) {
    const recruiter = await seedUser(`recruiter${index + 1}@jobportal.com`, ["Alex", "Jordan", "Morgan", "Sam"][index]!, "Recruiter", RoleName.RECRUITER);
    const company = companies[index % companies.length]!;
    await prisma.companyMember.upsert({
      where: { companyId_userId: { companyId: company.id, userId: recruiter.id } },
      create: { companyId: company.id, userId: recruiter.id, roleInCompany: index % 2 === 0 ? CompanyMemberRole.ADMIN : CompanyMemberRole.RECRUITER },
      update: {},
    });
    recruiters.push({ user: recruiter, company });
  }

  const skillRecords = new Map<string, string>();
  for (const name of skills) {
    const skill = await prisma.skill.upsert({ where: { name }, create: { name }, update: {} });
    skillRecords.set(name, skill.id);
  }

  const jobData = [
    { title: "Senior Full Stack Engineer", slug: "senior-full-stack-engineer", companyIndex: 0, city: "Bengaluru", workplace: WorkplaceType.HYBRID, employment: EmploymentType.FULL_TIME, level: ExperienceLevel.SENIOR, skills: ["Node.js", "React", "PostgreSQL", "TypeScript"], description: "Build reliable product experiences and APIs for a growing engineering team.", requirements: "Strong TypeScript, React, Node.js and PostgreSQL experience. Comfortable owning features end to end." },
    { title: "Frontend Engineer", slug: "frontend-engineer", companyIndex: 1, city: "Mumbai", workplace: WorkplaceType.REMOTE, employment: EmploymentType.FULL_TIME, level: ExperienceLevel.MID, skills: ["React", "Next.js", "TypeScript"], description: "Create thoughtful, accessible interfaces for high impact customer workflows.", requirements: "Production React experience, a strong CSS foundation, and attention to accessibility." },
    { title: "Backend Platform Engineer", slug: "backend-platform-engineer", companyIndex: 0, city: "Pune", workplace: WorkplaceType.HYBRID, employment: EmploymentType.FULL_TIME, level: ExperienceLevel.MID, skills: ["Node.js", "PostgreSQL", "Redis", "Docker"], description: "Improve the services and developer tools that power a multi-tenant SaaS platform.", requirements: "Experience designing APIs, operating PostgreSQL services, and working with containers." },
    { title: "Cloud Infrastructure Engineer", slug: "cloud-infrastructure-engineer", companyIndex: 0, city: "Hyderabad", workplace: WorkplaceType.REMOTE, employment: EmploymentType.CONTRACT, level: ExperienceLevel.SENIOR, skills: ["AWS", "Docker", "Python", "Redis"], description: "Make cloud infrastructure observable, secure, and straightforward to deploy.", requirements: "Hands-on AWS, infrastructure automation, containerization, and production on-call experience." },
    { title: "Product Designer", slug: "product-designer", companyIndex: 1, city: "Delhi", workplace: WorkplaceType.ON_SITE, employment: EmploymentType.FULL_TIME, level: ExperienceLevel.MID, skills: ["React", "GraphQL"], description: "Partner with product and engineering to shape clear, inclusive digital products.", requirements: "A portfolio showing research-informed product design and close engineering collaboration." },
  ];
  const jobs = [];
  for (let index = 0; index < jobData.length; index += 1) {
    const data = jobData[index]!;
    const company = companies[data.companyIndex]!;
    const recruiter = recruiters.find((entry) => entry.company.id === company.id)!.user;
    const job = await prisma.job.upsert({
      where: { companyId_slug: { companyId: company.id, slug: data.slug } },
      create: {
        companyId: company.id,
        postedByUserId: recruiter.id,
        title: data.title,
        slug: data.slug,
        description: data.description,
        requirements: data.requirements,
        locationCity: data.city,
        locationCountry: "India",
        workplaceType: data.workplace,
        employmentType: data.employment,
        experienceLevel: data.level,
        minSalary: 800_000 + index * 200_000,
        maxSalary: 1_500_000 + index * 300_000,
        currency: "INR",
        status: JobStatus.ACTIVE,
        skills: { create: data.skills.map((name) => ({ skillId: skillRecords.get(name)! })) },
      },
      update: { status: JobStatus.ACTIVE, description: data.description, requirements: data.requirements },
    });
    for (const name of data.skills) {
      await prisma.jobSkill.upsert({
        where: { jobId_skillId: { jobId: job.id, skillId: skillRecords.get(name)! } },
        create: { jobId: job.id, skillId: skillRecords.get(name)! },
        update: {},
      });
    }
    jobs.push(job);
  }

  const candidates = [];
  for (let index = 0; index < 5; index += 1) {
    const candidate = await seedUser(`candidate${index + 1}@jobportal.com`, ["Taylor", "Casey", "Riley", "Avery", "Cameron"][index]!, "Candidate", RoleName.CANDIDATE);
    await prisma.profile.upsert({
      where: { userId: candidate.id },
      create: { userId: candidate.id, headline: "Software professional exploring new opportunities", bio: "I enjoy solving thoughtful product problems, working with kind teams, and shipping work that makes everyday tasks feel simpler.", locationCity: "Bengaluru", locationCountry: "India", yearsOfExperience: index + 2, expectedSalary: 1_200_000 },
      update: { headline: "Software professional exploring new opportunities", bio: "I enjoy solving thoughtful product problems, working with kind teams, and shipping work that makes everyday tasks feel simpler.", locationCity: "Bengaluru", locationCountry: "India", yearsOfExperience: index + 2, expectedSalary: 1_200_000 },
    });
    for (const name of skills.slice(index, index + 4)) {
      const skillId = skillRecords.get(name)!;
      await prisma.candidateSkill.upsert({ where: { userId_skillId: { userId: candidate.id, skillId } }, create: { userId: candidate.id, skillId }, update: {} });
    }
    const education = await prisma.education.findFirst({ where: { userId: candidate.id, institution: "National Institute of Technology" } });
    if (!education) await prisma.education.create({ data: { userId: candidate.id, institution: "National Institute of Technology", degree: "Bachelor of Technology", fieldOfStudy: "Computer Science", startedAt: new Date("2017-07-01"), endedAt: new Date("2021-05-31") } });
    const experience = await prisma.experience.findFirst({ where: { userId: candidate.id, companyName: "Northstar Digital" } });
    if (!experience) await prisma.experience.create({ data: { userId: candidate.id, companyName: "Northstar Digital", title: "Software Engineer", location: "Bengaluru, India", startedAt: new Date("2022-01-01"), description: "Built reliable customer-facing product features with design and platform teams." } });
    let resume = await prisma.resume.findFirst({ where: { userId: candidate.id, fileName: "sample-resume.pdf" } });
    const demoResume = createDemoPdf();
    const demoResumeKey = `demo/${candidate.id}/sample-resume.pdf`;
    await s3.send(new PutObjectCommand({ Bucket: uploadBucket, Key: demoResumeKey, Body: demoResume, ContentLength: demoResume.length, ContentType: "application/pdf" }));
    const resumeData = { fileUrl: `s3://${uploadBucket}/${demoResumeKey}`, fileSizeBytes: demoResume.length, mimeType: "application/pdf", isPrimary: true };
    resume = resume
      ? await prisma.resume.update({ where: { id: resume.id }, data: resumeData })
      : await prisma.resume.create({ data: { userId: candidate.id, fileName: "sample-resume.pdf", ...resumeData } });
    const chosenJob = jobs[index % jobs.length]!;
    await prisma.application.upsert({
      where: { jobId_candidateId: { jobId: chosenJob.id, candidateId: candidate.id } },
      create: {
        jobId: chosenJob.id, candidateId: candidate.id, resumeId: resume.id,
        coverLetter: "I am excited to bring my experience to this team.", currentStatus: ApplicationStatus.APPLIED,
        history: { create: { changedByUserId: candidate.id, fromStatus: null, toStatus: ApplicationStatus.APPLIED } },
      },
      update: {},
    });
    candidates.push(candidate);
  }

  await prisma.auditLog.create({
    data: { actorId: admin.id, action: "DEMO_DATA_SEEDED", entityName: "platform", metadata: { companies: companies.length, jobs: jobs.length, candidates: candidates.length } },
  });
  process.stdout.write(`Seeded ${companies.length} companies, ${recruiters.length} recruiters, ${jobs.length} jobs, ${candidates.length} candidates. Demo password: ${demoPassword}\n`);
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
