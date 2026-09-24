import { ImageResponse } from "next/og";

export const alt = "USDC Pay: send USDC on Ethereum";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function TwitterImage() {
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
          background: "linear-gradient(135deg, #1e3a8a, #2563eb)",
          color: "white",
        }}
      >
        <div style={{ fontSize: 96, fontWeight: 700 }}>USDC Pay</div>
        <div style={{ fontSize: 44, marginTop: 24, opacity: 0.9 }}>Send USDC to any address or ENS name on Ethereum.</div>
      </div>
    ),
    size,
  );
}
