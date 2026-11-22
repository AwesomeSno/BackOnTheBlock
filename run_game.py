"""Run this file with Python 3, then open the printed address in your browser."""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial

project = Path(__file__).resolve().parent
handler = partial(SimpleHTTPRequestHandler, directory=str(project))
server = ThreadingHTTPServer(('127.0.0.1', 8771), handler)
print('Back on the Block is at http://127.0.0.1:8771')
print('Keep this terminal open while playing. Ctrl+C stops the server.')
try:
    server.serve_forever()
except KeyboardInterrupt:
    server.server_close()
