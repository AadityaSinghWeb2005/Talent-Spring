import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/config/database";
import { redis } from "../../src/config/redis";

describe("HTTP API integration", () => {
  it("reports liveness without requiring application credentials", async () => {
    const response = await request(app).get("/health/liveness");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });

  it("serves public job search with cursor metadata", async () => {
    const response = await request(app).get("/api/v1/jobs?limit=5");
    expect(response.status).toBe(200);
    expect(response.body.data).toBeInstanceOf(Array);
    expect(response.body.page).toMatchObject({ limit: 5, hasMore: expect.any(Boolean) });
  });

  it("orders text matches by relevance and keeps ranked cursor pages disjoint", async () => {
    const firstPage = await request(app).get("/api/v1/jobs?q=engineer&limit=2");
    expect(firstPage.status).toBe(200);
    expect(firstPage.body.data).toHaveLength(2);
    expect(firstPage.body.page.hasMore).toBe(true);
    expect(firstPage.body.page.nextCursor).toEqual(expect.any(String));

    const secondPage = await request(app).get(`/api/v1/jobs?q=engineer&limit=2&cursor=${encodeURIComponent(firstPage.body.page.nextCursor)}`);
    expect(secondPage.status).toBe(200);
    const firstIds = firstPage.body.data.map((job: { id: string }) => job.id);
    const secondIds = secondPage.body.data.map((job: { id: string }) => job.id);
    expect(secondIds.length).toBeGreaterThan(0);
    expect(secondIds.some((id: string) => firstIds.includes(id))).toBe(false);
  });

  it("denies a guest access to candidate applications", async () => {
    const response = await request(app).get("/api/v1/applications/me");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });
});

afterAll(async () => {
  await Promise.all([prisma.$disconnect(), redis.quit()]);
});
