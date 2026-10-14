# Zašifruje len kucharka.bin s pôvodnou soľou (fotky ostanú platné).
import sys, os, json
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
src, out, password, version = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
data = json.load(open(src)); data['version'] = version
salt = bytes.fromhex(data['salt'])
key = AESGCM(PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=200_000).derive(password.encode()))
iv = os.urandom(12)
open(out, 'wb').write(salt + iv + key.encrypt(iv, json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode(), None))
print('ok', len(data['recipes']), version)
