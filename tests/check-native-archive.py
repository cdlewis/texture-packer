"""Verify a generated RTZ using RT64's actual FileSystemZip. Requires clang and libzstd."""
import pathlib, subprocess, sys, tempfile
root=pathlib.Path(sys.argv[1]).resolve()
zstd=pathlib.Path(sys.argv[2] if len(sys.argv)>2 else '/opt/homebrew')
with tempfile.TemporaryDirectory(prefix='rt64-zstd-archive-') as tmp:
    work=pathlib.Path(tmp)
    (work/'check.cpp').write_text('''#include <filesystem>
#include <fstream>
#include <iostream>
#include <iterator>
#include "rt64_filesystem_zip.h"
int main(int argc,char**argv){
  auto fs=RT64::FileSystemZip::create(argv[1],"");
  if(!fs)return 1;
  unsigned count=0;
  for(const auto&path:*fs){
    std::ifstream input(std::filesystem::path(argv[2])/path,std::ios::binary);
    if(!input)return 2;
    std::vector<uint8_t> expected((std::istreambuf_iterator<char>(input)),{});
    std::vector<uint8_t> data(std::max<size_t>(fs->getSize(path),1));
    if(!fs->load(path,data.data(),data.size()))return 3;
    data.resize(fs->getSize(path));
    if(data!=expected)return 4;
    count++;
  }
  if(count!=5)return 5;
  std::cout<<"PASS: RT64 FileSystemZip extracted all "<<count<<" files byte-for-byte\\n";
}
''')
    contrib=root/'src/contrib'
    subprocess.run(['clang','-O2','-c',str(contrib/'miniz/miniz.c'),'-o',str(work/'miniz.o')],check=True)
    subprocess.run(['clang++','-std=c++17','-O2','-include','cassert','-include','cstring','-I'+str(root/'src/common'),'-I'+str(contrib),'-I'+str(contrib/'hlslpp/include'),'-I'+str(zstd/'include'),str(work/'check.cpp'),str(root/'src/common/rt64_filesystem_zip.cpp'),str(root/'src/common/rt64_mapped_file.cpp'),str(work/'miniz.o'),'-L'+str(zstd/'lib'),'-lzstd','-o',str(work/'check')],check=True)
    subprocess.run(['node','tests/archive-fixtures.js',str(work)],check=True)
    subprocess.run([str(work/'check'),str(work/'test.rtz'),str(work/'expected')],check=True)
