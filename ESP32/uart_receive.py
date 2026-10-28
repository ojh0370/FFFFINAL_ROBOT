# uart_receive.py

from machine import UART


UART_ID = 2
UART_BAUDRATE = 115200


# ESP32 UART2 기본 핀
#
# TX = GPIO17
# RX = GPIO16


# =========================================================
# 명령 타입
# =========================================================

COMMAND_MOTOR = "MOTOR"

COMMAND_SENSOR_START = (
    "SENSOR_START"
)

COMMAND_SENSOR_STOP = (
    "SENSOR_STOP"
)


class UARTReceiver:

    def __init__(self):

        self.uart = UART(
            UART_ID,
            baudrate=UART_BAUDRATE
        )

        self.receive_buffer = ""

    # =====================================================
    # UART 명령 수신
    # =====================================================

    def read_command(self):
        """
        Raspberry Pi -> ESP32

        지원 명령:

            left,right\\n

        예:
            100,100
            -50,50

        센서:
            START\\n
            STOP\\n


        반환:

            ("MOTOR", left, right)

            ("SENSOR_START",)

            ("SENSOR_STOP",)

            None
        """

        # ---------------------------------------------
        # UART RX 데이터 버퍼 저장
        # ---------------------------------------------

        if self.uart.any():

            raw = self.uart.read()

            if raw is not None:

                self.receive_buffer += (
                    raw.decode(
                        "utf-8",
                        "ignore"
                    )
                )

        # 완전한 한 줄이 없으면 아직 파싱 안 함
        if "\n" not in self.receive_buffer:
            return None

        try:

            line, self.receive_buffer = (
                self.receive_buffer.split(
                    "\n",
                    1
                )
            )

            line = line.strip()

            if not line:
                return None

            # -----------------------------------------
            # START / STOP 명령
            # -----------------------------------------

            upper_line = line.upper()

            if upper_line == "START":

                return (
                    COMMAND_SENSOR_START,
                )

            if upper_line == "STOP":

                return (
                    COMMAND_SENSOR_STOP,
                )

            # -----------------------------------------
            # 모터 명령
            #
            # left,right
            # -----------------------------------------

            parts = line.split(",")

            if len(parts) != 2:

                self.send_error()

                return None

            left = int(
                float(
                    parts[0].strip()
                )
            )

            right = int(
                float(
                    parts[1].strip()
                )
            )

            return (
                COMMAND_MOTOR,
                left,
                right
            )

        except Exception:

            self.send_error()

            return None

    # =====================================================
    # 모터 상태 전송
    # =====================================================

    def send_status(
        self,
        command_left,
        command_right,
        speed_left,
        speed_right
    ):
        """
        ESP32 -> Raspberry Pi

        OK,left,right,m1_pps,m2_pps
        """

        message = (
            "OK,{},{},{:.1f},{:.1f}\n"
            .format(
                command_left,
                command_right,
                speed_left,
                speed_right
            )
        )

        self.uart.write(
            message
        )

    # =====================================================
    # 센서 시작 ACK
    # =====================================================

    def send_sensor_started(self):
        """
        ESP32 -> Raspberry Pi

        SENSOR_STARTED
        """

        self.uart.write(
            "SENSOR_STARTED\n"
        )

    # =====================================================
    # 센서 정지 ACK
    # =====================================================

    def send_sensor_stopped(self):
        """
        ESP32 -> Raspberry Pi

        SENSOR_STOPPED
        """

        self.uart.write(
            "SENSOR_STOPPED\n"
        )

    # =====================================================
    # 초음파 센서 데이터 전송
    # =====================================================

    def send_sensor_data(
        self,
        distance_cm
    ):
        """
        정상:

            SENSOR,45.20

        초음파 측정 실패:

            SENSOR,NA
        """

        if distance_cm is None:

            message = (
                "SENSOR,NA\n"
            )

        else:

            message = (
                "SENSOR,{:.2f}\n"
                .format(
                    distance_cm
                )
            )

        self.uart.write(
            message
        )

    # =====================================================
    # 오류
    # =====================================================

    def send_error(self):

        self.uart.write(
            "ERR\n"
        )
