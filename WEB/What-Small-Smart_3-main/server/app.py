#!/usr/bin/env python3
"""
먹똑 - 로봇 PC Flask 서버
앱 <-> Nav2(goto_pose.py) 중간다리

실행:
    cd ~/turtlebot_test
    python3 app.py

앱에서:
    POST /navigate  {"book_id": "0001"}   -> 이동 시작
    GET  /status                      -> {"status": "idle|moving|arrived|failed|cancelled", ...}
    POST /cancel                      -> 이동 취소
"""
from flask import Flask, request, jsonify
import subprocess, threading, os, re

app = Flask(__name__)

# --- 상태 (스레드 안전) ---
nav_lock = threading.Lock()
nav_state = {"status": "idle", "book_id": None, "message": ""}
nav_proc = None  # subprocess.Popen

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GOTO_SCRIPT = os.path.join(SCRIPT_DIR, "goto_pose.py")


def set_state(status, book_id=None, message=""):
    with nav_lock:
        nav_state["status"] = status
        if book_id is not None:
            nav_state["book_id"] = book_id
        nav_state["message"] = message


def run_navigation(book_id):
    global nav_proc
    try:
        set_state("moving", book_id, "책 위치로 이동 중입니다.")
        proc = subprocess.Popen(
            ["python3", GOTO_SCRIPT, str(book_id)],
            cwd=SCRIPT_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        with nav_lock:
            nav_proc = proc
        output, _ = proc.communicate()
        print(f"[goto_pose.py output]\n{output}")

        # goto_pose.py 출력에서 결과 판별
        if "도착 완료" in output:
            set_state("arrived", message="목표 위치에 도착했습니다.")
        elif "취소" in output:
            set_state("cancelled", message="이동이 취소되었습니다.")
        elif "실패" in output or proc.returncode != 0:
            tail = output.strip().splitlines()[-1] if output.strip() else "알 수 없는 오류"
            set_state("failed", message=f"이동 실패: {tail}")
        else:
            set_state("failed", message="이동 결과를 확인할 수 없습니다.")
    except Exception as e:
        set_state("failed", message=f"서버 오류: {e}")
    finally:
        with nav_lock:
            nav_proc = None


@app.route("/navigate", methods=["POST"])
def navigate():
    data = request.get_json(silent=True) or {}
    book_id = data.get("book_id")
    if not book_id:
        return jsonify({"status": "failed", "message": "book_id가 없습니다."}), 400
    if not os.path.exists(GOTO_SCRIPT):
        return jsonify({"status": "failed", "message": "goto_pose.py를 찾을 수 없습니다."}), 500

    with nav_lock:
        if nav_state["status"] == "moving":
            return jsonify({
                "status": "moving",
                "book_id": nav_state["book_id"],
                "message": "이미 이동 중입니다.",
            }), 409

    threading.Thread(target=run_navigation, args=(book_id,), daemon=True).start()
    return jsonify({"status": "moving", "book_id": book_id, "message": "이동을 시작합니다."})


@app.route("/status", methods=["GET"])
def status():
    with nav_lock:
        return jsonify({
            "status": nav_state["status"],
            "book_id": nav_state["book_id"],
            "message": nav_state["message"],
        })


@app.route("/cancel", methods=["POST"])
def cancel():
    global nav_proc
    with nav_lock:
        if nav_proc:
            try:
                nav_proc.terminate()
            except Exception:
                pass
            nav_state["status"] = "cancelled"
            nav_state["message"] = "이동이 취소되었습니다."
        else:
            nav_state["status"] = "idle"
            nav_state["message"] = ""
        return jsonify({"status": nav_state["status"], "message": nav_state["message"]})


if __name__ == "__main__":
    # 같은 와이파이에서 앱이 접근 가능하도록 0.0.0.0
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)