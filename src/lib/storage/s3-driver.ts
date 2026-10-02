import { AwsClient } from "aws4fetch";
import { env } from "@/lib/env";
import type { StorageDriver } from "./types";

function client(): AwsClient {
  return new AwsClient({
    service: "s3",
    region: env.S3_REGION ?? "auto",
    accessKeyId: env.S3_ACCESS_KEY_ID!,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
  });
}

function objectUrl(key: string): string {
  const endpoint = env.S3_ENDPOINT!.replace(/\/+$/, "");
  return `${endpoint}/${env.S3_BUCKET}/${key}`;
}

export const s3Driver: StorageDriver = {
  async put(key, data, contentType) {
    const response = await client().fetch(objectUrl(key), {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: new Uint8Array(data),
    });
    if (!response.ok) {
      throw new Error(
        `Storage upload failed: ${response.status} ${await response.text()}`,
      );
    }
  },

  async get(key) {
    const response = await client().fetch(objectUrl(key), { method: "GET" });
    if (response.status === 404) return null;
    if (!response.ok || !response.body) {
      throw new Error(
        `Storage download failed: ${response.status} ${await response.text()}`,
      );
    }
    return {
      data: response.body,
      contentType:
        response.headers.get("content-type") ?? "application/octet-stream",
    };
  },

  async delete(key) {
    const response = await client().fetch(objectUrl(key), { method: "DELETE" });
    if (!response.ok && response.status !== 404) {
      throw new Error(
        `Storage delete failed: ${response.status} ${await response.text()}`,
      );
    }
  },
};
