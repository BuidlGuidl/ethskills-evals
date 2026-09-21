import { ImageResponse } from "next/og";

export const alt = "USDC Pay — send USDC on Ethereum";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 96,
          background: "linear-gradient(135deg, #0b0f17 0%, #1b3a66 100%)",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div
            style={{
              width: 112,
              height: 112,
              borderRadius: 56,
              background: "#2775ca",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 64,
              fontWeight: 700,
            }}
          >
            $
          </div>
          <div style={{ fontSize: 88, fontWeight: 700 }}>USDC Pay</div>
        </div>
        <div style={{ marginTop: 40, fontSize: 40, color: "#b8c4d8" }}>
          Send USDC on Ethereum to any address or ENS name.
        </div>
      </div>
    ),
    size,
  );
}
