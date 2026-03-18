import path from "path";
import { promises as fs } from "fs";

const STORAGE_ROOT = process.env.STORAGE_ROOT_PATH?.trim()
  ? path.resolve(process.env.STORAGE_ROOT_PATH)
  : path.resolve(process.cwd(), "storage");
const STORAGE_SUBDIRECTORIES = {
  orders: "orders",
  "saved-drafts": "saved drafts",
} as const;

export type StorageKind = keyof typeof STORAGE_SUBDIRECTORIES;

type SaveBufferInput = {
  kind: StorageKind;
  buffer: Buffer;
  filename: string;
  subdirectory?: string;
};

type SaveBufferResult = {
  absolutePath: string;
  relativePath: string;
  publicUrl: string;
};

function toPosixPath(value: string) {
  return value.replace(/\\/g, "/");
}

function sanitizePathSegment(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "." || trimmed === "..") {
    throw new Error("Invalid storage path segment.");
  }

  return trimmed.replace(/[<>:"|?*\u0000-\u001F]/g, "_");
}

function splitPathSegments(value?: string) {
  if (!value) {
    return [];
  }

  return value
    .split(/[\\/]+/)
    .filter(Boolean)
    .map((segment) => sanitizePathSegment(segment));
}

function ensurePathInsideBase(baseDir: string, targetPath: string) {
  const relative = path.relative(baseDir, targetPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Invalid storage path.");
  }
}

function storageDirectoryForKind(kind: StorageKind) {
  return path.join(STORAGE_ROOT, STORAGE_SUBDIRECTORIES[kind]);
}

function sanitizeFilename(value: string) {
  const basename = path.basename(value || "").trim() || "file.bin";
  return basename.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_");
}

function encodeRelativePathForUrl(relativePath: string) {
  return splitPathSegments(relativePath).map((segment) => encodeURIComponent(segment)).join("/");
}

export function isStorageKind(value: string): value is StorageKind {
  return value === "orders" || value === "saved-drafts";
}

export function buildStoragePublicUrl(kind: StorageKind, relativePath: string) {
  const base = (process.env.PUBLIC_STORAGE_BASE_URL ?? "/api/storage").replace(/\/+$/, "");
  return `${base}/${kind}/${encodeRelativePathForUrl(relativePath)}`;
}

export async function ensureStorageDirs() {
  await fs.mkdir(STORAGE_ROOT, { recursive: true });
  await Promise.all(
    (Object.keys(STORAGE_SUBDIRECTORIES) as StorageKind[]).map((kind) =>
      fs.mkdir(storageDirectoryForKind(kind), { recursive: true })),
  );
}

export async function saveBufferToStorage(input: SaveBufferInput): Promise<SaveBufferResult> {
  const storageDir = storageDirectoryForKind(input.kind);
  const subdirectorySegments = splitPathSegments(input.subdirectory);
  const filename = sanitizeFilename(input.filename);
  const targetDirectory = path.resolve(storageDir, ...subdirectorySegments);
  ensurePathInsideBase(storageDir, targetDirectory);

  await ensureStorageDirs();
  await fs.mkdir(targetDirectory, { recursive: true });

  const absolutePath = path.resolve(targetDirectory, filename);
  ensurePathInsideBase(storageDir, absolutePath);
  await fs.writeFile(absolutePath, input.buffer);

  const relativePath = toPosixPath(path.relative(storageDir, absolutePath));
  return {
    absolutePath,
    relativePath,
    publicUrl: buildStoragePublicUrl(input.kind, relativePath),
  };
}

export async function readStoredFile(kind: StorageKind, relativePath: string) {
  const storageDir = storageDirectoryForKind(kind);
  const segments = splitPathSegments(relativePath);
  const absolutePath = path.resolve(storageDir, ...segments);
  ensurePathInsideBase(storageDir, absolutePath);
  return fs.readFile(absolutePath);
}

export async function deleteStoredFile(kind: StorageKind, relativePath: string) {
  const storageDir = storageDirectoryForKind(kind);
  const segments = splitPathSegments(relativePath);
  const absolutePath = path.resolve(storageDir, ...segments);
  ensurePathInsideBase(storageDir, absolutePath);
  await fs.unlink(absolutePath);
}

export async function deleteStoredDirectory(kind: StorageKind, relativeDirectory: string) {
  const storageDir = storageDirectoryForKind(kind);
  const segments = splitPathSegments(relativeDirectory);
  if (segments.length === 0) {
    throw new Error("Storage directory path is required.");
  }

  const absolutePath = path.resolve(storageDir, ...segments);
  ensurePathInsideBase(storageDir, absolutePath);
  await fs.rm(absolutePath, { recursive: true, force: true });
}
