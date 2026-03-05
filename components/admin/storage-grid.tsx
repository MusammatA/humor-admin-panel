"use client";

import { useEffect, useMemo, useState } from "react";
import { ImageIcon } from "lucide-react";
import { createSupabaseBrowserClient } from "../../lib/supabase-browser";

type StorageFile = {
  id: string;
  name: string;
  created_at?: string | null;
  publicUrl: string;
};

type StorageGridProps = {
  bucketName: string;
};

export function StorageGrid({ bucketName }: StorageGridProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function listBucketFiles() {
    setLoading(true);
    setError(null);

    const { data, error: listError } = await supabase.storage
      .from(bucketName)
      .list("", { limit: 200, sortBy: { column: "name", order: "asc" } });

    if (listError) {
      setError(listError.message);
      setLoading(false);
      return;
    }

    const rows = (data ?? []).map((file) => {
      const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(file.name);
      return {
        id: `${file.id ?? file.name}`,
        name: file.name,
        created_at: file.created_at,
        publicUrl: publicUrlData.publicUrl,
      };
    });

    setFiles(rows);
    setLoading(false);
  }

  useEffect(() => {
    listBucketFiles();
  }, [bucketName]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Image Storage Review</h2>
          <p className="text-sm text-slate-600">
            Files from Supabase bucket: <span className="font-mono">{bucketName}</span>
          </p>
        </div>
        <button
          onClick={listBucketFiles}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          type="button"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading files...</p>
      ) : files.length === 0 ? (
        <p className="text-sm text-slate-500">No files found in this bucket.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {files.map((file) => (
            <article
              key={file.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
            >
              <div className="aspect-square bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={file.publicUrl}
                  alt={file.name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="space-y-1 p-2">
                <p className="truncate text-xs font-medium text-slate-800">{file.name}</p>
                <p className="text-[11px] text-slate-500">
                  {file.created_at ? new Date(file.created_at).toLocaleString() : "Unknown date"}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="mt-3 inline-flex items-center gap-1 text-xs text-slate-500">
        <ImageIcon className="h-3.5 w-3.5" />
        Bucket must be public for direct image preview with public URLs.
      </p>
    </section>
  );
}
