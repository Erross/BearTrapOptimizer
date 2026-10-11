#!/usr/bin/env python3
"""Local, dependency-free dashboard and JSON API."""
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import traceback
from beartrap.analysis import compare, search, calibrate
from beartrap.model import synthetic_roster
from beartrap.combat import formation_plan
from dataclasses import asdict

ROOT = Path(__file__).resolve().parent


class Handler(BaseHTTPRequestHandler):
    def send(self,status,body,content_type="application/json"):
        if not isinstance(body,bytes):
            body = json.dumps(body,allow_nan=False).encode()
        self.send_response(status)
        self.send_header("Content-Type",content_type)
        self.send_header("Content-Length",str(len(body)))
        self.send_header("Cache-Control","no-store")
        self.send_header("X-Content-Type-Options","nosniff")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path=self.path.split("?",1)[0]
        if path in ("/","/index.html","/responsive-check.html"):
            page="index.html" if path=="/" else path[1:]
            self.send(200,(ROOT/"web"/page).read_bytes(),"text/html; charset=utf-8")
        elif path in ("/engine.js","/worker.js","/combat.js","/formations-ui.js","/app.js","/ux.js"):
            self.send(200,(ROOT/"web"/path[1:]).read_bytes(),"text/javascript; charset=utf-8")
        elif path in ("/styles.css","/ux.css"):
            self.send(200,(ROOT/"web"/path[1:]).read_bytes(),"text/css; charset=utf-8")
        elif path == "/api/defaults":
            self.send(200,{"roster":[asdict(m) for m in synthetic_roster()]})
        elif path == "/health":
            self.send(200,{"status":"ok"})
        else:
            self.send(404,{"error":"Not found"})

    def do_POST(self):
        # Reject cross-site writes to the local service; allow same-origin browser and CLI requests.
        origin = self.headers.get("Origin")
        host = self.headers.get("Host")
        if origin and origin != f"http://{host}":
            self.send(403,{"error":"Cross-origin requests are not allowed"})
            return
        actions = {"/api/compare":compare,"/api/search":search,"/api/calibrate":calibrate,
                   "/api/formation_plan":formation_plan,
                   "/api/roster":lambda p: {"roster":[asdict(m) for m in synthetic_roster(**p)]}}
        if self.path not in actions:
            self.send(404,{"error":"Not found"})
            return
        try:
            length = int(self.headers.get("Content-Length",0))
            if not 0 < length <= 2000000:
                raise ValueError("Request must be 1 byte–2MB")
            payload = json.loads(self.rfile.read(length))
            self.send(200,actions[self.path](payload))
        except (ValueError, TypeError, KeyError, OverflowError) as e:
            self.send(400,{"error":str(e)})
        except Exception:
            traceback.print_exc()
            self.send(500,{"error":"Unexpected server error; see the terminal"})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host",default="127.0.0.1")
    parser.add_argument("--port",type=int,default=8765)
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host,args.port),Handler)
    print(f"Bear Trap Lab: http://{args.host}:{args.port}",flush=True)
    print("Press Ctrl+C to stop. No game connection; all inputs remain in this local session.",flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
