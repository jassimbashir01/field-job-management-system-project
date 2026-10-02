export interface StoredObject {
  data: ReadableStream<Uint8Array> | Buffer;
  contentType: string;
}

export interface StorageDriver {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
}
