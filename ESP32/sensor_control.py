# sensor_control.py

from machine import Pin, time_pulse_us
import time


# =========================================================
# 초음파 센서 핀 설정
# =========================================================

ULTRASONIC_TRIG_PIN = 23
ULTRASONIC_ECHO_PIN = 19


# =========================================================
# 초음파 측정 설정
# =========================================================

# 10 Hz
SENSOR_INTERVAL = 0.10

# Echo 최대 대기시간
ECHO_TIMEOUT_US = 30000

# 음속 약 343 m/s
# = 0.0343 cm/us
SOUND_SPEED_CM_PER_US = 0.0343


class SensorController:

    def __init__(self):

        # ---------------------------------------------
        # 초음파
        # ---------------------------------------------

        self.trig = Pin(
            ULTRASONIC_TRIG_PIN,
            Pin.OUT
        )

        self.echo = Pin(
            ULTRASONIC_ECHO_PIN,
            Pin.IN
        )

        # ---------------------------------------------
        # 상태
        # ---------------------------------------------

        self.enabled = False
        self.last_measurement_ms = None

        self.trig.value(0)

    # =====================================================
    # 센서 시작
    # =====================================================

    def start(self):
        """
        초음파 센서 측정/전송 활성화.

        실제 센서 VCC를 ON/OFF하는 것이 아니라
        측정 기능을 소프트웨어적으로 활성화한다.
        """

        self.enabled = True

        # START 직후 첫 측정을 바로 수행
        self.last_measurement_ms = None

    # =====================================================
    # 센서 정지
    # =====================================================

    def stop(self):
        """
        초음파 센서 측정/전송 비활성화.
        """

        self.enabled = False
        self.last_measurement_ms = None

        self.trig.value(0)

    # =====================================================
    # 상태 확인
    # =====================================================

    def is_enabled(self):
        return self.enabled

    # =====================================================
    # 초음파 거리 측정
    # =====================================================

    def read_distance_cm(self):
        """
        HC-SR04 방식 거리 측정.

        반환:
            float : 거리(cm)
            None  : timeout 또는 측정 실패
        """

        try:

            # Trigger 안정화
            self.trig.value(0)
            time.sleep_us(2)

            # 10 us Trigger pulse
            self.trig.value(1)
            time.sleep_us(10)
            self.trig.value(0)

            # Echo HIGH 시간 측정
            pulse_us = time_pulse_us(
                self.echo,
                1,
                ECHO_TIMEOUT_US
            )

            # MicroPython time_pulse_us:
            #
            # -2 : pulse 시작 대기 timeout
            # -1 : pulse 측정 timeout

            if pulse_us < 0:
                return None

            distance_cm = (
                pulse_us
                * SOUND_SPEED_CM_PER_US
                / 2.0
            )

            return distance_cm

        except Exception:
            return None

    # =====================================================
    # 주기적 초음파 측정
    # =====================================================

    def update(self):
        """
        START 상태일 때 SENSOR_INTERVAL마다 측정.

        반환:
            distance_cm

        측정 시점이 아니거나 STOP 상태:
            None
        """

        if not self.enabled:
            return None

        now_ms = time.ticks_ms()

        if self.last_measurement_ms is not None:

            elapsed_ms = time.ticks_diff(
                now_ms,
                self.last_measurement_ms
            )

            if elapsed_ms < int(
                SENSOR_INTERVAL * 1000
            ):
                return None

        self.last_measurement_ms = now_ms

        distance_cm = (
            self.read_distance_cm()
        )

        return distance_cm