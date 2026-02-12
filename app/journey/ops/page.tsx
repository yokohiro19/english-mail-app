export const dynamic = "force-dynamic";

async function fetchRuns() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_BASE_URL}/api/admin/ops-cron-runs?limit=80`, {
    headers: {
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Failed: ${res.status} ${t}`);
  }
  return res.json() as Promise<{ ok: true; items: any[] }>;
}

export default async function OpsCronRunsPage() {
  const data = await fetchRuns();

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Ops: Cron Runs</h1>

      <div style={{ overflowX: "auto", border: "1px solid #ddd", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#fafafa" }}>
              <th style={th}>ranAt</th>
              <th style={th}>date</th>
              <th style={th}>HH:MM</th>
              <th style={th}>attempted</th>
              <th style={th}>sent</th>
              <th style={th}>skipped</th>
              <th style={th}>errors</th>
              <th style={th}>ms</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((r) => (
              <tr key={r.id}>
                <td style={td}>{r.ranAt ?? "-"}</td>
                <td style={td}>{r.dateKey}</td>
                <td style={td}>{r.targetHHMM}</td>
                <td style={td}>{r.attempted}</td>
                <td style={td}>{r.sent}</td>
                <td style={td}>
                  noEmail:{r.skipped?.noEmail ?? 0} / already:{r.skipped?.alreadySent ?? 0} / billing:
                  {r.skipped?.billing ?? 0} / disabled:{r.skipped?.disabled ?? 0}
                </td>
                <td style={td}>{r.errorsCount}</td>
                <td style={td}>{r.durationMs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 12, color: "#666", fontSize: 12 }}>
        ※ 今は最短版のため、表示APIは CRON_SECRET で保護しています（後で管理者ログイン方式に強化OK）。
      </p>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #eee" };
const td: React.CSSProperties = { padding: "10px 12px", borderBottom: "1px solid #f1f1f1", whiteSpace: "nowrap" };