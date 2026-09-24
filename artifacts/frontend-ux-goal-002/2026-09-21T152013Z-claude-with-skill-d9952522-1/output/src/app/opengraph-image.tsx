import { ImageResponse } from "next/og";

export const alt = "Settle — Send USDC on Ethereum";
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
          background: "linear-gradient(135deg, #0b0f17 0%, #16345c 100%)",
          color: "white",
        }}
      >
        <div style={{ fontSize: 44, color: "#8cc1f7", fontWeight: 700 }}>Settle</div>
        <div style={{ fontSize: 88, fontWeight: 800, marginTop: 16 }}>Send USDC in seconds.</div>
        <div style={{ fontSize: 36, marginTop: 24, color: "#c7d2e3" }}>
          To any Ethereum address or ENS name. Straight from your wallet.
        </div>
      </div>
    ),
    size,
  );
}
