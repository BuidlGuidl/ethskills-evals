import { ImageResponse } from "next/og";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/constants";

export const alt = `${APP_NAME} — Send USDC on Ethereum`;
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
          padding: 80,
          background: "linear-gradient(135deg, #0b1120 0%, #1b3a66 100%)",
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 24,
              background: "#2775ca",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 64,
              fontWeight: 700,
            }}
          >
            →
          </div>
          <div style={{ fontSize: 72, fontWeight: 700 }}>{APP_NAME}</div>
        </div>
        <div style={{ marginTop: 40, fontSize: 48, fontWeight: 600 }}>Send USDC on Ethereum</div>
        <div style={{ marginTop: 16, fontSize: 30, color: "#b6c6e3", maxWidth: 900 }}>{APP_DESCRIPTION}</div>
      </div>
    ),
    size,
  );
}
