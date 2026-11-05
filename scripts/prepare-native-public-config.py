"""Copy only public browser configuration into the ignored Android build file."""
import base64
import json
from pathlib import Path
from urllib.parse import urlsplit

root = Path(__file__).resolve().parents[1]
allowed = {"VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "VITE_TURNSTILE_SITE_KEY"}
values = {}
for name in (".env", ".env.local", ".env.production", ".env.production.local"):
    path = root / name
    if not path.is_file():
        continue
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        key, sep, value = line.partition("=")
        if sep and key.strip() in allowed:
            values[key.strip()] = value.strip().strip("\"'")
key = values.get("VITE_SUPABASE_ANON_KEY", "")
if key and not key.startswith("sb_publishable_"):
    try:
        payload = key.split(".")[1]
        if json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))["role"] != "anon":
            raise ValueError("Unexpected backend role")
    except Exception:
        raise SystemExit("Refusing non-public backend key") from None
url = values.get("VITE_SUPABASE_URL", "")
if url:
    origin = urlsplit(url)
    if origin.scheme != "https" or not origin.netloc.endswith(".supabase.co") or origin.netloc != origin.hostname or origin.path or origin.query or origin.fragment:
        raise SystemExit("Unexpected public Supabase origin")
target = root / "native-android/backend.public.properties"
target.write_text("\n".join(k.removeprefix("VITE_") + "=" + values.get(k, "") for k in sorted(allowed)) + "\n", encoding="utf-8")
print(json.dumps({k: bool(values.get(k)) for k in sorted(allowed)}))
