"""Compare cache bytes with RT64's own extractor; needs clang++ and a local RT64 checkout."""
import pathlib, subprocess, sys, tempfile
root=pathlib.Path(sys.argv[1]).resolve()
source=(root/'src/tools/texture_packer/texture_packer.cpp').read_text()
extract=source[source.index('bool extractLowMipsToStream('):source.index('\nint main(')]
with tempfile.TemporaryDirectory(prefix='rt64-packer-parity-') as tmp:
    work=pathlib.Path(tmp)
    cpp='''#include <algorithm>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <vector>
#include <ddspp/ddspp.h>
namespace RT64 {struct ReplacementMipmapCacheHeader {uint32_t magic=0x434D4F4C,version=3,width=0,height=0,dxgiFormat=0,mipCount=0,pathLength=0;};}
const uint32_t TextureDataPitchAlignment=256,TextureDataPlacementAlignment=512;
uint32_t nextSizeAlignedTo(uint32_t size,uint32_t alignment){return (size+alignment-1)/alignment*alignment;}
'''+extract+'''
int main(int argc,char**argv){std::ofstream out(argv[2],std::ios::binary);for(int i=3;i<argc;i++)if(!extractLowMipsToStream(argv[1],argv[i],out))return 1;}
'''
    (work/'native.cpp').write_text(cpp)
    subprocess.run(['clang++','-std=c++17','-I'+str(root/'src/contrib'),str(work/'native.cpp'),'-o',str(work/'native')],check=True)
    subprocess.run(['node','tests/native-fixtures.js',str(work)],check=True)
    paths=[f'fixture-{i}.dds' for i in range(11)]
    subprocess.run([str(work/'native'),str(work),str(work/'native.bin'),*paths],check=True)
    actual=(work/'native.bin').read_bytes();expected=(work/'javascript.bin').read_bytes()
    assert actual==expected, f'Cache mismatch: native={len(actual)}, JS={len(expected)}'
    print(f'PASS: upstream cache parity, {len(paths)} DDS fixtures, {len(actual)} identical bytes')
