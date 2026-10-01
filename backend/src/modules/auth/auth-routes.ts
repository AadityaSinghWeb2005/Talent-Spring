import { Router, type ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import { AuthError, login, logout, refresh, register } from "./auth-service";
import { loginSchema, registerSchema } from "./auth-schemas";
import { authRateLimit } from "./auth-rate-limit";

const router = Router();
const refreshCookieName = "jobportal_refresh";
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/api/v1/auth",
};

router.use(cookieParser());
router.use(authRateLimit);

router.post("/register", async (request, response, next) => {
  const parsed = registerSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid registration data", details: parsed.error.flatten() } });
    return;
  }
  try {
    const result = await register(parsed.data);
    response.cookie(refreshCookieName, result.refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
    response.status(201).json({ data: { user: result.user, accessToken: result.accessToken } });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (request, response, next) => {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid login data", details: parsed.error.flatten() } });
    return;
  }
  try {
    const result = await login(parsed.data);
    response.cookie(refreshCookieName, result.refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
    response.status(200).json({ data: { user: result.user, accessToken: result.accessToken } });
  } catch (error) {
    next(error);
  }
});

router.post("/refresh", async (request, response, next) => {
  const token = request.cookies?.[refreshCookieName] as string | undefined;
  if (!token) {
    response.status(401).json({ error: { code: "INVALID_REFRESH_TOKEN", message: "Refresh token is missing" } });
    return;
  }
  try {
    const result = await refresh(token);
    response.cookie(refreshCookieName, result.refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
    response.status(200).json({ data: { user: result.user, accessToken: result.accessToken } });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", async (request, response, next) => {
  response.clearCookie(refreshCookieName, cookieOptions);
  try {
    await logout(request.cookies?.[refreshCookieName] as string | undefined);
    response.status(200).json({ data: { message: "Logged out" } });
  } catch (error) {
    next(error);
  }
});

export const authErrorHandler: ErrorRequestHandler = (error, request, response, next) => {
  if (error instanceof AuthError) {
    response.status(error.statusCode).json({ success: false, error: { code: error.code, message: error.message, details: [], timestamp: new Date().toISOString(), requestId: request.id } });
    return;
  }
  next(error);
};

export { router as authRouter };
