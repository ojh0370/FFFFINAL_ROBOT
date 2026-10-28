#!/usr/bin/env python3
"""
먹똑 - 로봇 PC ROS2 브리지 노드
앱(rosbridge WebSocket) <-> Nav2(goto_pose.py) 중간다리

실행 (로봇 PC에서):
    cd ~/turtlebot_test
    python3 app_nav_bridge.py
    # 또는 ros2 run (setup.py 등록 시)

토픽:
    구독:  /app/book_request  (std_msgs/String, data = "0001")
    발행:  /app/nav_status    (std_msgs/String, data = "navigating:0001")

상태 코드 (앱과 일치):
    idle | navigating | succeeded | failed | canceled | busy | not_found | invalid_request

참고:
    - rosbridge_server 가 9090 포트에서 실행 중이어야 앱과 연결됩니다.
      ros2 launch rosbridge_server rosbridge_websocket_launch.xml
    - 도서 좌표는 goto_pose.py 내부의 book_locations.json 에서 book_id 키로 조회합니다.
"""
import os
import subprocess
import threading

import rclpy
from rclpy.node import Node
from std_msgs.msg import String


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GOTO_SCRIPT = os.path.join(SCRIPT_DIR, "goto_pose.py")

# 앱이 인식하는 상태 코드 (useRosbridge.js VALID_STATUSES 와 일치)
STATE_IDLE = "idle"
STATE_NAVIGATING = "navigating"
STATE_SUCCEEDED = "succeeded"
STATE_FAILED = "failed"
STATE_CANCELED = "canceled"
STATE_BUSY = "busy"
STATE_NOT_FOUND = "not_found"
STATE_INVALID = "invalid_request"


class AppNavBridge(Node):
    def __init__(self):
        super().__init__("app_nav_bridge")
        self._lock = threading.Lock()
        self._busy = False
        self._proc = None

        self._status_pub = self.create_publisher(String, "/app/nav_status", 10)
        self._req_sub = self.create_subscription(
            String,
            "/app/book_request",
            self._on_request,
            10,
        )
        self._publish_status(STATE_IDLE, "")
        self.get_logger().info(
            "app_nav_bridge ready: /app/book_request -> /app/nav_status"
        )

    def _publish_status(self, state, book_id):
        msg = String()
        msg.data = f"{state}:{book_id}" if book_id else state
        self._status_pub.publish(msg)
        self.get_logger().info(f"status -> {msg.data}")

    def _on_request(self, msg):
        book_id = (msg.data or "").strip()
        if not book_id:
            self._publish_status(STATE_INVALID, "")
            return

        with self._lock:
            if self._busy:
                self._publish_status(STATE_BUSY, book_id)
                return
            self._busy = True

        threading.Thread(
            target=self._run_navigation, args=(book_id,), daemon=True
        ).start()

    def _run_navigation(self, book_id):
        try:
            if not os.path.exists(GOTO_SCRIPT):
                self.get_logger().error(f"goto_pose.py not found: {GOTO_SCRIPT}")
                self._publish_status(STATE_NOT_FOUND, book_id)
                return

            self._publish_status(STATE_NAVIGATING, book_id)
            self.get_logger().info(f"start goto_pose.py {book_id}")

            proc = subprocess.Popen(
                ["python3", GOTO_SCRIPT, str(book_id)],
                cwd=SCRIPT_DIR,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
            )
            with self._lock:
                self._proc = proc
            output, _ = proc.communicate()
            self.get_logger().info(f"[goto_pose.py output]\n{output}")

            if "도착 완료" in output:
                self._publish_status(STATE_SUCCEEDED, book_id)
            elif "취소" in output:
                self._publish_status(STATE_CANCELED, book_id)
            elif "실패" in output or proc.returncode != 0:
                self._publish_status(STATE_FAILED, book_id)
            else:
                self._publish_status(STATE_FAILED, book_id)
        except Exception as e:
            self.get_logger().error(f"navigation error: {e}")
            self._publish_status(STATE_FAILED, book_id)
        finally:
            with self._lock:
                self._proc = None
                self._busy = False


def main():
    rclpy.init()
    node = AppNavBridge()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == "__main__":
    main()