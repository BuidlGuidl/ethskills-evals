/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WC_PROJECT_ID?: string;
  readonly VITE_TIP_JAR_ADDRESS?: string;
  readonly VITE_USDC_ADDRESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
