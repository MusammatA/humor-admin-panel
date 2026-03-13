type StorageCapableClient = {
  storage: {
    from(bucketName: string): {
      remove(paths: string[]): Promise<{ error: { message: string } | null }>;
    };
  };
};

export type StorageObjectRef = {
  bucketName: string;
  path: string;
};

function parseStorageObjectRef(pathname: string, fallbackBucketName: string): StorageObjectRef | null {
  const marker = "/storage/v1/object/public/";
  const markerIndex = pathname.indexOf(marker);
  if (markerIndex === -1) return null;

  const suffix = pathname.slice(markerIndex + marker.length);
  const [bucketName, ...pathParts] = suffix.split("/").filter(Boolean);
  const resolvedBucket = bucketName || fallbackBucketName;
  const resolvedPath = pathParts.join("/");

  if (!resolvedBucket || !resolvedPath) return null;

  return {
    bucketName: decodeURIComponent(resolvedBucket),
    path: decodeURIComponent(resolvedPath),
  };
}

export function getStorageObjectRefFromPublicUrl(publicUrl: string, fallbackBucketName = ""): StorageObjectRef | null {
  const raw = String(publicUrl || "").trim();
  if (!raw) return null;

  try {
    return parseStorageObjectRef(new URL(raw).pathname, fallbackBucketName);
  } catch {
    return parseStorageObjectRef(raw, fallbackBucketName);
  }
}

export async function deleteStorageObjectByPublicUrl(
  client: StorageCapableClient,
  publicUrl: string,
  fallbackBucketName = "",
) {
  const ref = getStorageObjectRefFromPublicUrl(publicUrl, fallbackBucketName);
  if (!ref) {
    return { error: null, ref: null as StorageObjectRef | null };
  }

  const { error } = await client.storage.from(ref.bucketName).remove([ref.path]);
  return { error, ref };
}
