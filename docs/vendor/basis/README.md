# Basis Universal encoder

From https://github.com/BinomialLLC/basis_universal at tag `v1_50_0_2`,
commit `b76a431c6a39c07fe8bb2edf1cbf44781150ed6b`.
Copyright Binomial LLC. Licensed under Apache-2.0; see LICENSE.
Upstream dependency notices and licenses are included alongside it.

`basis_encoder.wasm` is the upstream binary from `webgl/encoder/build`.
The matching JavaScript glue has two adaptations: an ES module default export,
and disabled Node filesystem detection. Our wrapper supplies the WASM bytes
explicitly in both browsers and tests, avoiding CommonJS globals in ES modules.

The packer uses the PNG decoder, UASTC LDR encoder and BC7 transcoder.
UASTC uses the default quality level with BC7 error preference and no RDO.
Mipmaps use the encoder's default filter, sRGB-aware filtering, clamped edges,
and a smallest dimension of one. DDS is BC7_UNORM, matching RT64's PNG sampling.
BC7 compression is lossy; PNG files are never modified on disk.
