"""Zašifruje kuchárku a fotky (AES-GCM, kľúč z hesla cez PBKDF2-SHA256, 200 000 iterácií).
python3 encrypt.py kucharka.json foto_dir out_dir heslo verzia
-> out_dir/kucharka.bin (salt|iv|data) a out_dir/kucharka-foto/<id>.bin (iv|data)"""
import sys, os, json, glob
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
src, photos, out, password, version = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], int(sys.argv[5])
salt = os.urandom(16)
key = AESGCM(PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=200_000).derive(password.encode()))
data = json.load(open(src))
data['version'] = version
data['salt'] = salt.hex()
have = {os.path.basename(p)[:-5] for p in glob.glob(os.path.join(photos, '*.webp'))}
for r in data['recipes']: r['photo'] = str(r['id']) in have
iv = os.urandom(12)
open(os.path.join(out, 'kucharka.bin'), 'wb').write(salt + iv + key.encrypt(iv, json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode(), None))
fdir = os.path.join(out, 'kucharka-foto')
os.makedirs(fdir, exist_ok=True)
for f in glob.glob(os.path.join(fdir, '*.bin')): os.remove(f)
for rid in have:
    iv = os.urandom(12)
    open(os.path.join(fdir, rid + '.bin'), 'wb').write(iv + key.encrypt(iv, open(os.path.join(photos, rid + '.webp'), 'rb').read(), None))
print('receptov', len(data['recipes']), 'fotiek', len(have))
