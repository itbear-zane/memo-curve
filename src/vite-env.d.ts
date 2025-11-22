/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly __DEV__: boolean
  readonly __PROD__: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}