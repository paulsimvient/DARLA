import { useCallback, useEffect, useState } from "react";

type ApiState = {
  data: Record<string, any>;
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

const API_CANDIDATES = [
  "/api/dashboard",
  "/api/export",
  "/api/run",
  "/api/playback",
  "/dashboard.json",
];

async function fetchFirstWorkingJson(): Promise<Record<string, any>> {
  const errors: string[] = [];

  for (const url of API_CANDIDATES) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        errors.push(`${url}: HTTP ${res.status}`);
        continue;
      }
      const text = await res.text();
      if (!text.trim()) {
        errors.push(`${url}: empty response`);
        continue;
      }
      return JSON.parse(text);
    } catch (err) {
      errors.push(`${url}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  throw new Error(errors.join(" | "));
}

export function useDashboardData(): ApiState {
  const [data, setData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);

    fetchFirstWorkingJson()
      .then((json) => {
        setData(json);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
        setData({});
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 5000);
    return () => window.clearInterval(id);
  }, [refresh]);

  return { data, loading, error, refresh };
}
