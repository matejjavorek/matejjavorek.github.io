"""Zašifruje kucharka.json do kucharka.bin (AES-GCM, kľúč z hesla cez PBKDF2-SHA256)."""
import sys, os, json
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
src, dst, password = sys.argv[1], sys.argv[2], sys.argv[3]
data = json.load(open(src))
data['version'] = int(sys.argv[4]) if len(sys.argv) > 4 else data.get('version', 1)
plain = json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode()
salt, iv = os.urandom(16), os.urandom(12)
key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=200_000).derive(password.encode())
open(dst, 'wb').write(salt + iv + AESGCM(key).encrypt(iv, plain, None))
print(len(plain), '->', os.path.getsize(dst))
