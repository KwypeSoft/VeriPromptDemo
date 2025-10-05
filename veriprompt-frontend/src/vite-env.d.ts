/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONTRACT_ADDRESS: string
  readonly VITE_BACKEND_URL: string
  readonly VITE_OPENSEA_BASE_URL?: string
  readonly VITE_BLOCK_EXPLORER_TOKEN_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
