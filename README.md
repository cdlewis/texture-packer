# RT64 Texture packer

A static, browser-only tool that takes a texture-pack folder and downloads an `.rtz` archive.
The interface matches RT64 Texture converter. No uploads, accounts, or runtime CDN dependencies.

Select a folder with `rt64.json` at its root and the images referenced by that database.
The packer converts selected PNG textures to BC7 DDS with mipmaps, validates mappings,
includes the selected textures and extra files, rebuilds
`rt64-low-mip-cache.bin` from streamed DDS textures, then downloads the archive automatically.
Errors prevent a partial pack download. Unmatched automatic mappings are shown as notes.

## Compatibility

- Produces Zstandard `.rtz` archives using ZIP method 93, as supported by RT64.
  Compression runs through a bundled WebAssembly codec at level 9 to bound browser work,
  rather than the native tool's maximum level. Extra files use Deflate, matching RT64;
  entries are stored uncompressed when compression would increase their size.
- Resolves explicit paths, RT64 hash filenames, and Rice filenames; prefers DDS over PNG.
- Converts PNG textures to BC7 DDS through bundled Basis Universal WebAssembly,
  using UASTC as an intermediate. Generates a full mip chain down to 1×1 with
  sRGB-aware filtering and clamped edges. BC7 compression is lossy and retains alpha.
  Output uses BC7_UNORM to match RT64's texture sampling.
- Keeps existing DDS files unchanged. When converting PNGs, updates database paths,
  pins their resolved loading operations (so PNG-specific filters keep working),
  and updates matching `extraFiles` references. DDS-only databases remain byte-identical.
- Honors per-texture operations, operation filters in order, and `extraFiles`.
- Rebuilds the version-3 low-mipmap cache with 256-byte row and 512-byte placement alignment.
- Supports single 2D DDS textures: BC1–BC7 and common uncompressed DXGI color formats,
  including legacy DXT1/DXT3/DXT5, RGBA8, and BGRA8 headers.
- Extracts existing DDS mipmaps; does not regenerate missing mipmaps in existing DDS files.
- PNG decoding happens in WASM without canvas color conversion. Animated PNGs are rejected.
  Auxiliary files listed only in `extraFiles` are copied without conversion.
- Unsupported DDS formats, arrays, cubemaps, volumes, malformed files, case mismatches,
  ambiguous automatic mappings, and duplicate texture hashes fail explicitly.
- Limits: 512 MB selected file data / archive / cache, and 60,000 archive entries.
  PNG conversion allows up to 16,777,216 pixels per image and 16,384 pixels per side.
  Larger packs should use the native tool. Browser memory limits still vary by device.
- Compared with upstream, automatic DDS/PNG preference is deterministic and ambiguous
  hash matches are rejected rather than depending on directory iteration order.

## Run and host

```sh
python3 -m http.server 4174 --directory docs
```

Open http://localhost:4174. Do not open the HTML directly: JavaScript modules and workers need HTTP(S).
No build step is needed. For GitHub Pages, select the `main` branch and `/docs` folder.

## Tests

Requires Node.js 22.15+ with native Zstandard support in `node:zlib`.

```sh
npm test
```

Synthetic fixtures cover DDS headers, mip extraction and alignment, database resolution, archive
contents, and invalid input. No game assets are included. Native cache parity can be checked with
`tests/check-native.py /path/to/rt64`; it compiles the upstream extraction routine into a temporary
command-line helper and compares its output with the browser implementation.
`tests/check-native-archive.py /path/to/rt64 [zstd-prefix]` additionally compiles RT64's
actual ZIP reader and verifies that it extracts each Zstandard/Deflate/stored entry
byte-for-byte. It requires clang and libzstd (default prefix: `/opt/homebrew`).
`python3 tests/check-dds-pixels.py` uses an independent native BC7 decoder to verify
generated color, alpha, orientation and mipmaps; it requires clang++.

## References

- [RT64 texture-pack documentation](https://github.com/rt64/rt64/blob/main/TEXTURE-PACKS.md).
- [RT64 texture packer source](https://github.com/rt64/rt64/blob/main/src/tools/texture_packer/texture_packer.cpp).
- RT64-derived database and cache logic retains the RT64 MIT license in `docs/vendor/rt64-LICENSE.txt`.
- DDS header interpretation follows ddspp; its MIT license is in `docs/vendor/ddspp-LICENSE.txt`.
- @bokuweb/zstd-wasm 0.0.27 is vendored in `docs/vendor/zstd`, including its MIT/BSD licenses.
- fflate 0.8.2 is vendored under its MIT license in `docs/vendor`.
- Basis Universal v1_50_0_2 is vendored under Apache-2.0 in `docs/vendor/basis`.
- An independent MIT/public-domain BC7 decoder is vendored only for tests in `tests/vendor`.
