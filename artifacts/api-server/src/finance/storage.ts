import { mkdir, readFile, rename, writeFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { GetFinanceSnapshotResponse, type FinanceSnapshot } from "@workspace/api-zod";

export class FinanceError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const privateDir = () =>
  resolve(process.env.FINANCE_DATA_DIR || ".private/auria");

export async function readPrivateJson(path: string): Promise<unknown> {
  const info = await stat(path);
  if ((info.mode & 0o077) !== 0) {
    throw new FinanceError(503, "Arquivo privado com permissões inseguras. Use chmod 600.");
  }
  return JSON.parse(await readFile(path, "utf8"));
}

export async function writePrivateJson(path: string, data: unknown) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temp = `${path}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(data), { mode: 0o600, flag: "wx" });
  await rename(temp, path);
}

export const emptySnapshot = (): FinanceSnapshot => ({
  accounts: [], transactions: [], investments: [], lastSyncAt: null, warnings: [],
});

// Bind the stored snapshot to the configured owner, never to the first visitor.
export async function readSnapshot(): Promise<FinanceSnapshot> {
  try {
    const file = await readPrivateJson(resolve(privateDir(), "snapshot.json")) as {
      owner: string; snapshot: unknown;
    };
    if (!file.owner || file.owner !== process.env.OWNER_CLERK_USER_ID) {
      throw new FinanceError(503, "O arquivo financeiro pertence a outra configuração de proprietário.");
    }
    return GetFinanceSnapshotResponse.parse(file.snapshot);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptySnapshot();
    throw error;
  }
}

export async function saveSnapshot(snapshot: FinanceSnapshot) {
  if (!process.env.OWNER_CLERK_USER_ID) throw new FinanceError(503, "Configure o proprietário.");
  await writePrivateJson(resolve(privateDir(), "snapshot.json"), {
    owner: process.env.OWNER_CLERK_USER_ID,
    snapshot: GetFinanceSnapshotResponse.parse(snapshot),
  });
}
