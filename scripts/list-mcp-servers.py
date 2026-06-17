#!/usr/bin/env python3
import json, sys
sys.path.insert(0, "/app")
from core.database import McpServer, SessionLocal
db = SessionLocal()
try:
    servers = db.query(McpServer).all()
    for s in servers:
        env = {}
        try:
            env = json.loads(s.env or "{}")
        except Exception:
            pass
        print(json.dumps({
            "id": s.id,
            "name": s.name,
            "command": s.command,
            "args": s.args,
            "transport": getattr(s, "transport", None),
            "url": getattr(s, "url", None),
            "env_keys": list(env.keys()),
        }, indent=2))
finally:
    db.close()
