import { expect, test } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";

const password = process.env.SEED_PASSWORD ?? "JobPortal123!";

async function signIn(page: import("@playwright/test").Page, email: string): Promise<{ accessToken: string; name: string }> {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  const responsePromise = page.waitForResponse((response) => response.url().endsWith("/auth/login") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Sign in" }).click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  const { data } = await response.json() as { data: { accessToken: string; user: { firstName: string; lastName: string } } };
  await expect(page).toHaveURL(email.startsWith("candidate") ? /\/candidate\/dashboard$/ : /\/recruiter\/jobs$/);
  return { accessToken: data.accessToken, name: `${data.user.firstName} ${data.user.lastName}` };
}

async function chooseAvailableApplication(api: APIRequestContext, accessToken: string): Promise<{ jobId: string; jobTitle: string }> {
  const apiBase = process.env.API_BASE_URL ?? "http://127.0.0.1:5000/api/v1";
  const jobsResponse = await api.get(`${apiBase}/jobs?limit=50`);
  expect(jobsResponse.ok()).toBeTruthy();
  const jobs = (await jobsResponse.json() as { data: Array<{ id: string; title: string; company: { name: string } }> }).data
    .filter((job) => job.company.name === "TechCorp");
  const applicationsResponse = await api.get(`${apiBase}/applications/me`, { headers: { authorization: `Bearer ${accessToken}` } });
  expect(applicationsResponse.ok()).toBeTruthy();
  const applications = (await applicationsResponse.json() as { data: Array<{ jobId: string }> }).data;
  const job = jobs.find(({ id }) => !applications.some((application) => application.jobId === id));
  if (!job) throw new Error("Candidate 1 has applied to every TechCorp demo job. Reset and reseed the local test database.");
  return { jobId: job.id, jobTitle: job.title };
}

test("candidate applies and recruiter moves the application through ATS stages", async ({ browser, page, request }) => {
  const candidateEmail = process.env.E2E_CANDIDATE_EMAIL ?? "candidate1@jobportal.com";
  const candidate = await signIn(page, candidateEmail);
  const selected = await chooseAvailableApplication(request, candidate.accessToken);
  const webBase = process.env.E2E_BASE_URL ?? "http://localhost:3000";
  const serverRendered = await request.get(`${webBase}/jobs/${selected.jobId}`);
  expect(serverRendered.ok()).toBeTruthy();
  const serverHtml = await serverRendered.text();
  expect(serverHtml).toContain(selected.jobTitle);
  expect(serverHtml).toContain('"@type":"JobPosting"');
  await page.goto(`/jobs/${selected.jobId}`);
  await page.getByRole("button", { name: "Apply for this role" }).click();
  await page.getByLabel("Choose a resume").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Submit application" }).click();
  await expect(page.getByRole("status")).toContainText("Application sent");
  await page.getByRole("button", { name: candidate.name.split(" ")[0] }).click();
  await page.getByRole("link", { name: "Workspace" }).click();
  await expect(page).toHaveURL(/\/candidate\/profile$/);
  const institution = `E2E University ${Date.now()}`;
  await page.getByLabel("Institution").fill(institution);
  await page.getByRole("button", { name: "Add education" }).click();
  await expect(page.getByText(institution)).toBeVisible();
  await page.getByRole("button", { name: `Remove ${institution}` }).click();
  await expect(page.getByText(institution)).toHaveCount(0);
  const resumeName = `e2e-resume-${Date.now()}.pdf`;
  await page.locator('input[type="file"]').setInputFiles({
    name: resumeName,
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7\nEnd-to-end upload verification"),
  });
  await expect(page.getByRole("status")).toContainText("Your resume is ready to use in applications.");
  await expect(page.getByText(resumeName)).toBeVisible();

  const recruiterContext = await browser.newContext();
  const recruiter = await recruiterContext.newPage();
  const recruiterAuth = await signIn(recruiter, "recruiter1@jobportal.com");
  const jobRow = recruiter.locator("article").filter({ hasText: selected.jobTitle });
  await jobRow.getByRole("link", { name: "Review" }).click();
  const applicantCard = recruiter.locator("article").filter({ hasText: candidate.name });
  await expect(applicantCard).toBeVisible();
  const stageSection = applicantCard.locator("xpath=../..");
  await expect(stageSection.getByRole("heading", { name: "APPLIED" })).toBeVisible();
  await applicantCard.getByRole("button", { name: "Move to under review" }).click();
  await expect(stageSection.getByRole("heading", { name: "UNDER REVIEW" })).toBeVisible();
  await applicantCard.getByRole("button", { name: "Move to shortlisted" }).click();
  await expect(stageSection.getByRole("heading", { name: "SHORTLISTED" })).toBeVisible();

  const apiBase = process.env.API_BASE_URL ?? "http://127.0.0.1:5000/api/v1";
  const temporaryCompanyName = `E2E Archived Company ${Date.now()}`;
  const createdCompany = await request.post(`${apiBase}/companies`, {
    headers: { authorization: `Bearer ${recruiterAuth.accessToken}` },
    data: { name: temporaryCompanyName },
  });
  expect(createdCompany.status()).toBe(201);
  const company = (await createdCompany.json() as { data: { id: string; slug: string } }).data;
  const deletedCompany = await request.delete(`${apiBase}/companies/${company.id}`, {
    headers: { authorization: `Bearer ${recruiterAuth.accessToken}` },
  });
  expect(deletedCompany.status()).toBe(204);
  const publicCompany = await request.get(`${apiBase}/companies/directory/${company.slug}`);
  expect(publicCompany.status()).toBe(404);

  await recruiter.getByRole("link", { name: "All roles" }).click();
  await recruiter.getByRole("link", { name: "Create a role" }).click();
  const draftTitle = `Lifecycle E2E ${Date.now()}`;
  await recruiter.getByLabel("Company").selectOption({ index: 1 });
  await recruiter.getByLabel("Job title").fill(draftTitle);
  await recruiter.getByLabel("About the role").fill("Help a small product team build accessible, useful tools for its customers.");
  await recruiter.getByLabel("What you’ll bring").fill("Clear communication, thoughtful collaboration, and a willingness to learn.");
  await recruiter.getByRole("button", { name: "Save as draft" }).click();
  await expect(recruiter).toHaveURL(/\/recruiter\/applicants\//);
  await recruiter.getByRole("link", { name: "All roles" }).click();
  const draft = recruiter.locator("article").filter({ hasText: draftTitle });
  await expect(draft.getByText("DRAFT", { exact: true })).toBeVisible();
  await draft.getByRole("button", { name: "Publish" }).click();
  await expect(draft.getByText("ACTIVE", { exact: true })).toBeVisible();
  await draft.getByRole("button", { name: "Pause" }).click();
  await expect(draft.getByText("PAUSED", { exact: true })).toBeVisible();
  await draft.getByRole("button", { name: "Reopen" }).click();
  await expect(draft.getByText("ACTIVE", { exact: true })).toBeVisible();
  recruiter.on("dialog", (dialog) => dialog.accept());
  await draft.getByRole("button", { name: "Close" }).click();
  await expect(draft.getByText("CLOSED", { exact: true })).toBeVisible();
  await recruiterContext.close();
});
