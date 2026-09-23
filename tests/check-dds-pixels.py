"""Independently decode generated BC7 DDS files; requires clang++, no Python packages."""
import json, pathlib, struct, subprocess, tempfile
root=pathlib.Path(__file__).resolve().parent.parent
with tempfile.TemporaryDirectory(prefix='rt64-dds-pixels-') as tmp:
    work=pathlib.Path(tmp)
    (work/'decode.cpp').write_text('''#include <fstream>
#include <vector>
#include <iterator>
#include <iostream>
#include "bc7decomp.h"
int main(int argc,char**argv){
  std::ifstream in(argv[1],std::ios::binary);
  std::vector<unsigned char> bytes((std::istreambuf_iterator<char>(in)),{});
  for(size_t pos=148;pos+16<=bytes.size();pos+=16){
    bc7decomp::color_rgba pixels[16];
    if(!bc7decomp::unpack_bc7(bytes.data()+pos,pixels))return 1;
    std::cout.write(reinterpret_cast<char*>(pixels),64);
  }
}
''')
    vendor=root/'tests/vendor/bc7decomp'
    subprocess.run(['clang++','-std=c++11','-O2','-I'+str(vendor),str(work/'decode.cpp'),str(vendor/'bc7decomp.cpp'),'-o',str(work/'decode')],check=True)
    subprocess.run(['node','tests/dds-pixel-fixtures.js',str(work)],cwd=root,check=True)
    for case in json.loads((work/'cases.json').read_text()):
        name=case['name'];dds=(work/(name+'.dds')).read_bytes()
        blocks=subprocess.check_output([str(work/'decode'),str(work/(name+'.dds'))])
        w,h=case['w'],case['h'];offset=0
        expected=(work/(name+'.rgba')).read_bytes()
        for mip in range(struct.unpack_from('<I',dds,28)[0]):
            pixels=bytearray(w*h*4)
            for by in range(0,h,4):
                for bx in range(0,w,4):
                    block=blocks[offset:offset+64];offset+=64
                    for y in range(min(4,h-by)):
                        for x in range(min(4,w-bx)):
                            dest=((by+y)*w+bx+x)*4;src=(y*4+x)*4
                            pixels[dest:dest+4]=block[src:src+4]
            if mip==0:
                errors=[abs(a-b) for a,b in zip(pixels,expected)]
                assert max(errors)<=20 and sum(errors)/len(errors)<4, (name,max(errors))
            if name in ['solid','transparent','translucent','odd']:
                assert max(abs(v-expected[i%4]) for i,v in enumerate(pixels))<=3,(name,mip)
            if name=='orientation' and mip==1:
                # Several primary colors now share one lossy BC7 block.
                assert pixels[0]>pixels[1] and pixels[0]>pixels[2] and pixels[3]>=250,pixels[:4]
            w=max(1,w//2);h=max(1,h//2)
        assert offset==len(blocks)
    print('PASS: independent BC7 decoder verified color, alpha, orientation and mipmaps for 6 textures')
