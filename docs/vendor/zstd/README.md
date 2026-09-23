Vendored `dist/web/zstd.js`, its source map, and `zstd.wasm` from
@bokuweb/zstd-wasm 0.0.27, downloaded from:
https://registry.npmjs.org/@bokuweb/zstd-wasm/-/zstd-wasm-0.0.27.tgz

The package declares the JavaScript glue MIT-licensed (author bokuweb) and the
embedded Zstandard implementation BSD-3-Clause (Meta/Facebook). See the adjacent
license files. These vendor files are unchanged. The small application adapter
in ../../zstd.js owns loading, failure handling, and allocation checks.
