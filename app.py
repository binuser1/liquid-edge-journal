import os
import sqlite3
from datetime import datetime
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from werkzeug.utils import secure_filename


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "trades.db"
UPLOADS_DIR = BASE_DIR / "uploads"

ALLOWED_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}

app = Flask(__name__, static_folder=str(BASE_DIR), static_url_path="")
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024  # 20MB


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_storage() -> None:
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

    with get_db_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS trades (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              created_at TEXT NOT NULL,
              market TEXT NOT NULL,
              category TEXT NOT NULL,
              chk1 INTEGER NOT NULL,
              chk2 INTEGER NOT NULL,
              chk3 INTEGER NOT NULL,
              chk4 INTEGER NOT NULL,
              notes TEXT,
              image_path TEXT
            );
            """
        )

        cols = {row["name"] for row in conn.execute("PRAGMA table_info(trades)").fetchall()}

        if "entry_price" not in cols:
            conn.execute("ALTER TABLE trades ADD COLUMN entry_price REAL")
        if "exit_price" not in cols:
            conn.execute("ALTER TABLE trades ADD COLUMN exit_price REAL")
        if "stop_loss" not in cols:
            conn.execute("ALTER TABLE trades ADD COLUMN stop_loss REAL")
        if "take_profit" not in cols:
            conn.execute("ALTER TABLE trades ADD COLUMN take_profit REAL")

        if "outcome" not in cols:
            conn.execute("ALTER TABLE trades ADD COLUMN outcome TEXT")

        conn.commit()


def allowed_image(filename: str) -> bool:
    if not filename or "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[-1].lower()
    return ext in ALLOWED_IMAGE_EXTENSIONS


@app.get("/")
def serve_index():
    return app.send_static_file("index.html")


@app.get("/uploads/<path:filename>")
def serve_upload(filename: str):
    return send_from_directory(UPLOADS_DIR, filename)


@app.get("/api/trades")
def list_trades():
    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, created_at, market, category, chk1, chk2, chk3, chk4, notes, image_path,
                   entry_price, exit_price, stop_loss, take_profit, outcome
            FROM trades
            ORDER BY datetime(created_at) DESC
            """
        ).fetchall()

    trades = []
    for r in rows:
        trades.append(
            {
                "id": r["id"],
                "created_at": r["created_at"],
                "market": r["market"],
                "category": r["category"],
                "chk1": bool(r["chk1"]),
                "chk2": bool(r["chk2"]),
                "chk3": bool(r["chk3"]),
                "chk4": bool(r["chk4"]),
                "notes": r["notes"] or "",
                "image_url": f"/uploads/{r['image_path']}" if r["image_path"] else None,
                "entry_price": r["entry_price"],
                "exit_price": r["exit_price"],
                "stop_loss": r["stop_loss"],
                "take_profit": r["take_profit"],
                "outcome": r["outcome"],
            }
        )

    return jsonify({"trades": trades})


@app.post("/api/trades")
def create_trade():
    market = (request.form.get("market") or "").strip()
    category = (request.form.get("category") or "").strip()
    notes = request.form.get("notes") or ""

    def to_float_or_none(name: str):
        raw = (request.form.get(name) or "").strip()
        if raw == "":
            return None
        try:
            return float(raw)
        except ValueError:
            return None

    def to_int_checkbox(name: str) -> int:
        v = (request.form.get(name) or "").strip().lower()
        return 1 if v in {"1", "true", "yes", "on"} else 0

    chk1 = to_int_checkbox("chk1")
    chk2 = to_int_checkbox("chk2")
    chk3 = to_int_checkbox("chk3")
    chk4 = to_int_checkbox("chk4")

    entry_price = to_float_or_none("entry_price")
    exit_price = to_float_or_none("exit_price")
    stop_loss = to_float_or_none("stop_loss")
    take_profit = to_float_or_none("take_profit")

    outcome = (request.form.get("outcome") or "").strip().lower() or None
    if outcome not in {None, "win", "loss"}:
        return jsonify({"error": "outcome must be win or loss"}), 400

    if not market:
        return jsonify({"error": "market is required"}), 400
    if category not in {"backtest", "demo", "real"}:
        return jsonify({"error": "category must be one of: backtest, demo, real"}), 400

    image_path = None
    file = request.files.get("image")
    if file and file.filename:
        if not allowed_image(file.filename):
            return jsonify({"error": "unsupported image type"}), 400

        filename = secure_filename(file.filename)
        stamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
        stored_name = f"{stamp}_{filename}"
        file.save(UPLOADS_DIR / stored_name)
        image_path = stored_name

    created_at = datetime.utcnow().isoformat()

    with get_db_connection() as conn:
        cur = conn.execute(
            """
            INSERT INTO trades (
              created_at, market, category, chk1, chk2, chk3, chk4, notes, image_path,
              entry_price, exit_price, stop_loss, take_profit, outcome
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                created_at,
                market,
                category,
                chk1,
                chk2,
                chk3,
                chk4,
                notes,
                image_path,
                entry_price,
                exit_price,
                stop_loss,
                take_profit,
                outcome,
            ),
        )
        conn.commit()
        trade_id = cur.lastrowid

    return jsonify(
        {
            "id": trade_id,
            "created_at": created_at,
            "market": market,
            "category": category,
            "chk1": bool(chk1),
            "chk2": bool(chk2),
            "chk3": bool(chk3),
            "chk4": bool(chk4),
            "notes": notes,
            "image_url": f"/uploads/{image_path}" if image_path else None,
            "entry_price": entry_price,
            "exit_price": exit_price,
            "stop_loss": stop_loss,
            "take_profit": take_profit,
            "outcome": outcome,
        }
    )


@app.delete("/api/trades/<int:trade_id>")
def delete_trade(trade_id: int):
    with get_db_connection() as conn:
        row = conn.execute(
            "SELECT id, image_path FROM trades WHERE id = ?",
            (trade_id,),
        ).fetchone()

        if row is None:
            return jsonify({"error": "not found"}), 404

        conn.execute("DELETE FROM trades WHERE id = ?", (trade_id,))
        conn.commit()

    image_path = row["image_path"]
    if image_path:
        try:
            (UPLOADS_DIR / image_path).unlink(missing_ok=True)
        except Exception:
            pass

    return jsonify({"ok": True})


if __name__ == "__main__":
    init_storage()
    app.run(host="127.0.0.1", port=5000, debug=True)
