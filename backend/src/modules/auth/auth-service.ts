import { randomUUID, createHash } from "node:crypto";
import argon2 from "argon2";
import { SignJWT, jwtVerify } from "jose";
import { Prisma, RoleName, UserStatus } from "@prisma/client";
import { prisma } from "../../config/database";
import { redis } from "../../config/redis";
import type { LoginInput, RegisterInput } from "./auth-schemas";

const refreshLifetimeSeconds = 7 * 24 * 60 * 60;
const accessLifetimeSeconds = 15 * 60;
const accessSecret = getSecret("JWT_ACCESS_SECRET");
const refreshSecret = getSecret("JWT_REFRESH_SECRET");

type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  roles: Array<{ role: { name: RoleName } }>;
  memberships: Array<{ companyId: string }>;
};

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export type AuthContext = { userId: string; roles: RoleName[]; companyId?: string };

function getSecret(name: string): Uint8Array {
  const secret = process.env[name];
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error(`${name} must be configured with at least 32 bytes`);
  }
  return new TextEncoder().encode(secret);
}

export async function verifyAccessToken(token: string): Promise<AuthContext> {
  const { payload } = await jwtVerify(token, accessSecret, { algorithms: ["HS256"] });
  if (
    typeof payload.userId !== "string" ||
    !Array.isArray(payload.roles) ||
    !payload.roles.every((role): role is RoleName => Object.values(RoleName).includes(role as RoleName))
  ) {
    throw new AuthError("Access token is invalid or expired", 401, "INVALID_ACCESS_TOKEN");
  }
  return {
    userId: payload.userId,
    roles: payload.roles,
    ...(typeof payload.companyId === "string" ? { companyId: payload.companyId } : {}),
  };
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function issueTokens(user: AuthUser): Promise<{ accessToken: string; refreshToken: string }> {
  const roles = user.roles.map(({ role }) => role.name);
  const companyId = user.memberships[0]?.companyId;
  const accessToken = await new SignJWT({ userId: user.id, roles, ...(companyId ? { companyId } : {}) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${accessLifetimeSeconds}s`)
    .sign(accessSecret);

  const refreshToken = await new SignJWT({ tokenId: randomUUID() })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${refreshLifetimeSeconds}s`)
    .sign(refreshSecret);

  await redis.set(`auth:refresh:${hashToken(refreshToken)}`, user.id, "EX", refreshLifetimeSeconds);
  return { accessToken, refreshToken };
}

function publicUser(user: AuthUser) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    roles: user.roles.map(({ role }) => role.name),
    companyId: user.memberships[0]?.companyId ?? null,
  };
}

export async function register(input: RegisterInput) {
  const passwordHash = await argon2.hash(input.password, {
    type: argon2.argon2id,
    memoryCost: 65_536,
    parallelism: 2,
    timeCost: 3,
  });

  try {
    const user = await prisma.$transaction(async (transaction) => {
      const role = await transaction.role.findUnique({ where: { name: input.role } });
      if (!role) throw new Error(`Role ${input.role} is missing; run the database seed first`);

      const created = await transaction.user.create({
        data: {
          email: input.email,
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          roles: { create: { roleId: role.id } },
          ...(input.role === "CANDIDATE" ? { profile: { create: {} } } : {}),
        },
        include: { roles: { include: { role: true } }, memberships: true },
      });

      await transaction.auditLog.create({
        data: { actorId: created.id, action: "USER_REGISTERED", entityName: "users", entityId: created.id },
      });
      return created;
    });
    return { user: publicUser(user), ...(await issueTokens(user)) };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AuthError("An account with this email already exists", 409, "EMAIL_ALREADY_EXISTS");
    }
    throw error;
  }
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { roles: { include: { role: true } }, memberships: true },
  });
  const passwordMatches = user ? await argon2.verify(user.passwordHash, input.password) : false;
  if (!user || !passwordMatches || user.status !== UserStatus.ACTIVE) {
    throw new AuthError("Email or password is incorrect", 401, "INVALID_CREDENTIALS");
  }
  return { user: publicUser(user), ...(await issueTokens(user)) };
}

export async function refresh(token: string) {
  let userId: string;
  try {
    const verified = await jwtVerify(token, refreshSecret, { algorithms: ["HS256"] });
    if (typeof verified.payload.sub !== "string") throw new Error("Missing subject");
    userId = verified.payload.sub;
  } catch {
    throw new AuthError("Refresh token is invalid or expired", 401, "INVALID_REFRESH_TOKEN");
  }

  const tokenOwner = await redis.getdel(`auth:refresh:${hashToken(token)}`);
  if (tokenOwner !== userId) {
    throw new AuthError("Refresh token is invalid or expired", 401, "INVALID_REFRESH_TOKEN");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: { include: { role: true } }, memberships: true },
  });
  if (!user || user.status !== UserStatus.ACTIVE) {
    throw new AuthError("Account is not active", 401, "ACCOUNT_INACTIVE");
  }
  return { user: publicUser(user), ...(await issueTokens(user)) };
}

export async function logout(token: string | undefined): Promise<void> {
  if (!token) return;
  try {
    await jwtVerify(token, refreshSecret, { algorithms: ["HS256"] });
  } catch {
    // Always allow logout to clear the browser cookie, including for expired tokens.
    return;
  }
  await redis.del(`auth:refresh:${hashToken(token)}`);
}
