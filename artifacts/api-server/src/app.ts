import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { CLERK_PROXY_PATH, clerkProxyMiddleware, getClerkProxyHost } from "./middlewares/clerkProxyMiddleware";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
const allowedOrigins = (process.env.CORS_ORIGINS || "").split(",").filter(Boolean);
if (process.env.NODE_ENV !== "production") {
  for (const host of [process.env.REPLIT_EXPO_DEV_DOMAIN, process.env.REPLIT_DEV_DOMAIN]) {
    if (host) allowedOrigins.push(`https://${host}`);
  }
}
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    // Native requests have no Origin. Empty allowlist never enables arbitrary browser origins.
    callback(null, !origin || allowedOrigins.includes(origin));
  },
}));
app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(clerkMiddleware((req) => ({
  publishableKey: publishableKeyFromHost(
    getClerkProxyHost(req) ?? "",
    process.env.CLERK_PUBLISHABLE_KEY,
  ),
})));

app.use("/api", router);

export default app;
