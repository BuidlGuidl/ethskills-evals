import { ImageResponse } from "next/og";

export const ogSize = { width: 1200, height: 630 };
export const ogAlt = "USDC Pay: send USDC on Ethereum";

export function renderOgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 96, background: "#0d1117", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div style={{ width: 96, height: 96, borderRadius: 48, background: "#2775ca", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56 }}>→</div>
          <div style={{ fontSize: 80, fontWeight: 700 }}>USDC Pay</div>
        </div>
        <div style={{ fontSize: 40, marginTop: 36, color: "#9aa4b2" }}>Send USDC on Ethereum to any address or ENS name.</div>
      </div>
    ),
    ogSize,
  );
}
