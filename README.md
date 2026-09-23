# RT64 Texture packer

A static, browser-only tool that takes a texture-pack folder and downloads an `.rtz` archive.
The interface matches RT64 Texture converter. No uploads, accounts, or runtime CDN dependencies.

Select a folder with `rt64.json` at its root and the images referenced by that database.
The packer validates mappings, includes the selected textures and extra files, rebuilds
`rt64-low-mip-cache.bin` from streamed DDS textures, then downloads the archive automatically.
Errors prevent a partial pack download. Unmatched automatic mappings are shown as notes.

## Compatibility

- Produces standard ZIP/Deflate `.rtz` files, equivalent to the native packer's `--deflate` mode.
  This does not use RT64's default Zstandard compression.
- Resolves explicit paths, RT64 hash filenames, and Rice filenames; prefers DDS over PNG.
- Preserves the original `rt64.json` bytes and image contents.
- Honors per-texture operations, operation filters in order, and `extraFiles`.
- Rebuilds the version-3 low-mipmap cache with 256-byte row and 512-byte placement alignment.
- Supports single 2D DDS textures: BC1–BC7 and common uncompressed DXGI color formats,
  including legacy DXT1/DXT3/DXT5, RGBA8, and BGRA8 headers.
- Extracts existing mipmaps; it does not generate missing mipmaps or convert PNG to DDS.
- PNGs are accepted for development packs; DDS with mipmaps is recommended for releases.
- Unsupported DDS formats, arrays, cubemaps, volumes, malformed files, case mismatches,
  ambiguous automatic mappings, and duplicate texture hashes fail explicitly.
- Limits: 512 MB selected file data / archive / cache, and 60,000 archive entries.
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

```sh
npm test
```

Synthetic fixtures cover DDS headers, mip extraction and alignment, database resolution, archive
contents, and invalid input. No game assets are included. Native cache parity can be checked with
`tests/check-native.py /path/to/rt64`; it compiles the upstream extraction routine into a temporary
command-line helper and compares its output with the browser implementation.

## References

- [RT64 texture-pack documentation](https://github.com/rt64/rt64/blob/main/TEXTURE-PACKS.md).
- [RT64 texture packer source](https://github.com/rt64/rt64/blob/main/src/tools/texture_packer/texture_packer.cpp).
- RT64-derived database and cache logic retains the RT64 MIT license in `docs/vendor/rt64-LICENSE.txt`.
- DDS header interpretation follows ddspp; its MIT license is in `docs/vendor/ddspp-LICENSE.txt`.
- fflate 0.8.2 is vendored under its MIT license in `docs/vendor`.
