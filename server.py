import http.server
import socketserver
import json
import os
import sqlite3
from urllib.parse import urlparse

PORT = 8000
DATA_FILE = "data.json"
DB_FILE = "vocab.db"


def get_connection():
    return sqlite3.connect(DB_FILE)


def init_db():
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS vocab (
                id TEXT PRIMARY KEY,
                word TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                definitions TEXT NOT NULL,
                tags TEXT NOT NULL DEFAULT '[]'
            )
            """
        )

        columns = [row[1] for row in conn.execute("PRAGMA table_info(vocab)").fetchall()]
        if "tags" not in columns:
            conn.execute("ALTER TABLE vocab ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'")
        if "review_data" not in columns:
            conn.execute("ALTER TABLE vocab ADD COLUMN review_data TEXT")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS custom_tags (
                tag TEXT PRIMARY KEY
            )
            """
        )
        conn.commit()


def migrate_json_to_sqlite_if_needed():
    if not os.path.exists(DATA_FILE):
        return

    with get_connection() as conn:
        row = conn.execute("SELECT COUNT(*) FROM vocab").fetchone()
        if row and row[0] > 0:
            return

        with open(DATA_FILE, "r", encoding="utf-8") as f:
            raw = f.read().strip()
            json_data = json.loads(raw) if raw else []

        for item in json_data:
            conn.execute(
                """
                INSERT OR REPLACE INTO vocab (id, word, timestamp, definitions)
                VALUES (?, ?, ?, ?)
                """,
                (
                    str(item.get("id", "")),
                    str(item.get("word", "")),
                    int(item.get("timestamp", 0) or 0),
                    json.dumps(item.get("definitions", []), ensure_ascii=False),
                ),
            )
        conn.commit()


def load_vocab_from_db():
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, word, timestamp, definitions, tags, review_data FROM vocab"
        ).fetchall()

    result = []
    for row in rows:
        result.append(
            {
                "id": row[0],
                "word": row[1],
                "timestamp": row[2],
                "definitions": json.loads(row[3]) if row[3] else [],
                "tags": json.loads(row[4]) if len(row) > 4 and row[4] else [],
                "review_data": json.loads(row[5]) if len(row) > 5 and row[5] else None,
            }
        )
    return result


def save_vocab_to_db(vocab_items):
    with get_connection() as conn:
        conn.execute("DELETE FROM vocab")
        for item in vocab_items:
            conn.execute(
                """
                INSERT OR REPLACE INTO vocab (id, word, timestamp, definitions, tags, review_data)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    str(item.get("id", "")),
                    str(item.get("word", "")),
                    int(item.get("timestamp", 0) or 0),
                    json.dumps(item.get("definitions", []), ensure_ascii=False),
                    json.dumps(item.get("tags", []), ensure_ascii=False),
                    json.dumps(item.get("review_data", None), ensure_ascii=False) if item.get("review_data") else None,
                ),
            )
        conn.commit()


def load_custom_tags_from_db():
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT tag FROM custom_tags ORDER BY tag COLLATE NOCASE"
        ).fetchall()
        return [row[0] for row in rows]


def save_custom_tags_to_db(tags):
    with get_connection() as conn:
        conn.execute("DELETE FROM custom_tags")
        for raw in tags:
            if not isinstance(raw, str):
                continue
            tag = raw.strip()
            if tag:
                conn.execute(
                    "INSERT OR IGNORE INTO custom_tags (tag) VALUES (?)", (tag,)
                )
        conn.commit()


class RequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/api/vocab':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()

            data = load_vocab_from_db()
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))
        elif path == '/api/custom-tags':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            data = load_custom_tags_from_db()
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))
        else:
            # Fallback to serving static files
            super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if path == '/api/vocab':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                # Validate JSON
                json_data = json.loads(post_data.decode('utf-8'))

                save_vocab_to_db(json_data)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success"}).encode('utf-8'))
            except json.JSONDecodeError:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Invalid JSON"}).encode('utf-8'))
        elif path == '/api/custom-tags':
            content_length = int(self.headers.get("Content-Length", 0))
            post_data = self.rfile.read(content_length) if content_length else b""
            try:
                json_data = json.loads(post_data.decode("utf-8"))
                if not isinstance(json_data, list):
                    raise ValueError("expected JSON array")
                save_custom_tags_to_db(json_data)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success"}).encode("utf-8"))
            except (json.JSONDecodeError, ValueError):
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(
                    json.dumps({"error": "Invalid JSON; expected array of strings"}).encode(
                        "utf-8"
                    )
                )
        else:
            self.send_error(404, 'Not Found')

if __name__ == "__main__":
    init_db()
    migrate_json_to_sqlite_if_needed()
    with socketserver.TCPServer(("", PORT), RequestHandler) as httpd:
        print(f"Serving at port {PORT}")
        print(f"Please open http://localhost:{PORT} in your browser.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
        httpd.server_close()
        print("Server stopped.")
