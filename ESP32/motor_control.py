# motor_control.py

from machine import Pin, PWM
import time


# =========================================================
# 핀 설정
# =========================================================

M1_PWM_PIN = 25
M1_DIR_PIN = 26
M1_ENC_A_PIN = 14
M1_ENC_B_PIN = 13

M2_PWM_PIN = 21
M2_DIR_PIN = 22
M2_ENC_A_PIN = 34
M2_ENC_B_PIN = 35


# =========================================================
# PWM 설정
# =========================================================

PWM_FREQUENCY = 20000
PWM_MIN = 0
PWM_MAX = 1000


# =========================================================
# 제어 주기
# =========================================================

CONTROL_INTERVAL = 0.05


# =========================================================
# 명령값 -> 목표 PPS 변환
# =========================================================

COMMAND_TO_PPS_SCALE_LEFT = 5.2
COMMAND_TO_PPS_SCALE_RIGHT = 5.2

MAX_COMMAND = 500


# =========================================================
# PID 설정
# =========================================================

KP_LEFT = 0.08
KI_LEFT = 0.0

KP_RIGHT = 0.08
KI_RIGHT = 0.0


# =========================================================
# PID 제한 설정
# =========================================================

INTEGRAL_LIMIT = 5000.0
TARGET_DEAD_ZONE_PPS = 1.0
MAX_DUTY_STEP = 30


# =========================================================
# 모터 방향 설정
# =========================================================

# 현재 로봇 배선 기준
M1_FORWARD_DIR = 1
M2_FORWARD_DIR = 0


# =========================================================
# 유틸리티
# =========================================================

def clamp(value, minimum, maximum):
    return max(minimum, min(maximum, value))


# =========================================================
# 모터 제어 클래스
# =========================================================

class MotorController:

    def __init__(self):

        # -------------------------------------------------
        # 모터 출력 핀
        # -------------------------------------------------

        self.m1_dir = Pin(
            M1_DIR_PIN,
            Pin.OUT
        )

        self.m2_dir = Pin(
            M2_DIR_PIN,
            Pin.OUT
        )

        self.m1_pwm = PWM(
            Pin(M1_PWM_PIN),
            freq=PWM_FREQUENCY,
            duty=0
        )

        self.m2_pwm = PWM(
            Pin(M2_PWM_PIN),
            freq=PWM_FREQUENCY,
            duty=0
        )


        # -------------------------------------------------
        # 엔코더 입력 핀
        # -------------------------------------------------

        self.m1_enc_a = Pin(
            M1_ENC_A_PIN,
            Pin.IN,
            Pin.PULL_UP
        )

        self.m1_enc_b = Pin(
            M1_ENC_B_PIN,
            Pin.IN,
            Pin.PULL_UP
        )

        # GPIO34, GPIO35는 내부 풀업이 없습니다.
        # 반드시 외부 풀업 저항을 연결해야 합니다.
        # 권장: 10kΩ, 3.3V 기준
        self.m2_enc_a = Pin(
            M2_ENC_A_PIN,
            Pin.IN
        )

        self.m2_enc_b = Pin(
            M2_ENC_B_PIN,
            Pin.IN
        )


        # -------------------------------------------------
        # 누적 엔코더 카운트
        # -------------------------------------------------

        self.m1_count = 0
        self.m2_count = 0


        # -------------------------------------------------
        # 엔코더 인터럽트
        #
        # A채널 상승 + 하강 엣지 사용
        # 따라서 A채널 기준 2x 디코딩
        # -------------------------------------------------

        self.m1_enc_a.irq(
            trigger=Pin.IRQ_RISING | Pin.IRQ_FALLING,
            handler=self._m1_encoder_irq
        )

        self.m2_enc_a.irq(
            trigger=Pin.IRQ_RISING | Pin.IRQ_FALLING,
            handler=self._m2_encoder_irq
        )


        # -------------------------------------------------
        # 목표 명령
        # -------------------------------------------------

        self.target_command_left = 0
        self.target_command_right = 0

        self.target_pps_left = 0.0
        self.target_pps_right = 0.0


        # -------------------------------------------------
        # 측정 속도
        # -------------------------------------------------

        self.speed_pps_left = 0.0
        self.speed_pps_right = 0.0

        self.raw_speed_pps_left = 0.0
        self.raw_speed_pps_right = 0.0


        # -------------------------------------------------
        # 엔코더 디버그 정보
        # -------------------------------------------------

        self.last_count_left = 0
        self.last_count_right = 0

        self.last_delta_left = 0
        self.last_delta_right = 0

        self.last_dt = 0.0


        # -------------------------------------------------
        # PID 상태
        # -------------------------------------------------

        self.integral_left = 0.0
        self.integral_right = 0.0

        self.previous_error_left = 0.0
        self.previous_error_right = 0.0

        self.duty_left = 0
        self.duty_right = 0


        # -------------------------------------------------
        # 시간 초기화
        # -------------------------------------------------

        self.last_update_us = time.ticks_us()

        self.stop()


    # =====================================================
    # 엔코더 ISR
    # =====================================================

    def _m1_encoder_irq(self, pin):

        if self.m1_enc_a.value() == self.m1_enc_b.value():
            self.m1_count += 1
        else:
            self.m1_count -= 1


    def _m2_encoder_irq(self, pin):

        if self.m2_enc_a.value() == self.m2_enc_b.value():
            self.m2_count += 1
        else:
            self.m2_count -= 1


    # =====================================================
    # 엔코더 카운트 초기화
    # =====================================================

    def reset_encoder_counts(self):

        # IRQ 처리 중 값이 변할 가능성을 줄이기 위해
        # 현재 값을 먼저 초기화합니다.
        self.m1_count = 0
        self.m2_count = 0

        self.last_count_left = 0
        self.last_count_right = 0

        self.last_delta_left = 0
        self.last_delta_right = 0

        self.speed_pps_left = 0.0
        self.speed_pps_right = 0.0

        self.raw_speed_pps_left = 0.0
        self.raw_speed_pps_right = 0.0


    # =====================================================
    # 명령 설정
    # =====================================================

    def set_target_commands(
        self,
        left_command,
        right_command
    ):

        # 실제 M1/M2 배선과 논리적 좌우가 반대로 연결된 상태라면
        # 이 줄을 유지합니다.
        left_command, right_command = (
            right_command,
            left_command
        )

        left_command = int(
            clamp(
                left_command,
                -MAX_COMMAND,
                MAX_COMMAND
            )
        )

        right_command = int(
            clamp(
                right_command,
                -MAX_COMMAND,
                MAX_COMMAND
            )
        )

        self.target_command_left = left_command
        self.target_command_right = right_command

        self.target_pps_left = (
            left_command
            * COMMAND_TO_PPS_SCALE_LEFT
        )

        self.target_pps_right = (
            right_command
            * COMMAND_TO_PPS_SCALE_RIGHT
        )

        if left_command == 0:
            self._reset_left_pid()
            self._set_left_output(0, 0)

        if right_command == 0:
            self._reset_right_pid()
            self._set_right_output(0, 0)


    # =====================================================
    # 엔코더 속도 계산
    # =====================================================

    def _update_speed(self, dt):

        current_left = self.m1_count
        current_right = self.m2_count

        delta_left = (
            current_left
            - self.last_count_left
        )

        delta_right = (
            current_right
            - self.last_count_right
        )

        self.last_count_left = current_left
        self.last_count_right = current_right

        self.last_delta_left = delta_left
        self.last_delta_right = delta_right
        self.last_dt = dt

        if dt <= 0.0:
            return

        # 설치 방향에 따른 부호 보정
        raw_speed_left = -(
            delta_left / dt
        )

        raw_speed_right = (
            delta_right / dt
        )

        self.raw_speed_pps_left = raw_speed_left
        self.raw_speed_pps_right = raw_speed_right

        # 저역통과 필터
        filter_alpha = 0.2

        self.speed_pps_left = (
            filter_alpha * raw_speed_left
            + (1.0 - filter_alpha)
            * self.speed_pps_left
        )

        self.speed_pps_right = (
            filter_alpha * raw_speed_right
            + (1.0 - filter_alpha)
            * self.speed_pps_right
        )


    # =====================================================
    # 전체 제어 업데이트
    # =====================================================

    def update(self):

        now_us = time.ticks_us()

        elapsed_us = time.ticks_diff(
            now_us,
            self.last_update_us
        )

        control_interval_us = int(
            CONTROL_INTERVAL * 1_000_000
        )

        if elapsed_us < control_interval_us:
            return False

        self.last_update_us = now_us

        dt = elapsed_us / 1_000_000.0

        if dt <= 0.0 or dt > 0.2:
            dt = CONTROL_INTERVAL

        self._update_speed(dt)

        self._update_left_pid(dt)
        self._update_right_pid(dt)

        return True


    # =====================================================
    # 왼쪽 PID
    # =====================================================

    def _update_left_pid(self, dt):

        target = self.target_pps_left

        if abs(target) <= TARGET_DEAD_ZONE_PPS:
            self._reset_left_pid()
            self._set_left_output(0, 0)
            return

        measured = self.speed_pps_left
        error = target - measured

        self.integral_left += error * dt

        self.integral_left = clamp(
            self.integral_left,
            -INTEGRAL_LIMIT,
            INTEGRAL_LIMIT
        )

        derivative = (
            error
            - self.previous_error_left
        ) / dt

        self.previous_error_left = error

        control = (
            KP_LEFT * error
            + KI_LEFT * self.integral_left
        )

        requested_duty = (
            self.duty_left
            + control
        )

        requested_duty = int(
            clamp(
                requested_duty,
                -PWM_MAX,
                PWM_MAX
            )
        )

        requested_duty = (
            self._limit_duty_step(
                self.duty_left,
                requested_duty
            )
        )

        if requested_duty > 0:
            direction = 1

        elif requested_duty < 0:
            direction = -1

        else:
            direction = 0

        self._set_left_output(
            direction,
            requested_duty
        )


    # =====================================================
    # 오른쪽 PID
    # =====================================================

    def _update_right_pid(self, dt):

        target = self.target_pps_right

        if abs(target) <= TARGET_DEAD_ZONE_PPS:
            self._reset_right_pid()
            self._set_right_output(0, 0)
            return

        measured = self.speed_pps_right
        error = target - measured

        self.integral_right += error * dt

        self.integral_right = clamp(
            self.integral_right,
            -INTEGRAL_LIMIT,
            INTEGRAL_LIMIT
        )

        derivative = (
            error
            - self.previous_error_right
        ) / dt

        self.previous_error_right = error

        control = (
            KP_RIGHT * error
            + KI_RIGHT * self.integral_right
        )

        requested_duty = (
            self.duty_right
            + control
        )

        requested_duty = int(
            clamp(
                requested_duty,
                -PWM_MAX,
                PWM_MAX
            )
        )

        requested_duty = (
            self._limit_duty_step(
                self.duty_right,
                requested_duty
            )
        )

        if requested_duty > 0:
            direction = 1

        elif requested_duty < 0:
            direction = -1

        else:
            direction = 0

        self._set_right_output(
            direction,
            requested_duty
        )


    # =====================================================
    # Duty 변화 제한
    # =====================================================

    def _limit_duty_step(
        self,
        current,
        requested
    ):

        upper = current + MAX_DUTY_STEP
        lower = current - MAX_DUTY_STEP

        return int(
            clamp(
                requested,
                lower,
                upper
            )
        )


    # =====================================================
    # 왼쪽 모터 출력
    # =====================================================

    def _set_left_output(
        self,
        direction,
        duty
    ):

        duty = int(
            clamp(
                duty,
                -PWM_MAX,
                PWM_MAX
            )
        )

        magnitude = int(
            clamp(
                abs(duty),
                PWM_MIN,
                PWM_MAX
            )
        )

        if direction == 0 or magnitude == 0:
            self.m1_pwm.duty(0)
            self.duty_left = 0
            return

        if direction > 0:
            self.m1_dir.value(
                M1_FORWARD_DIR
            )

        else:
            self.m1_dir.value(
                1 - M1_FORWARD_DIR
            )

        self.m1_pwm.duty(magnitude)
        self.duty_left = duty


    # =====================================================
    # 오른쪽 모터 출력
    # =====================================================

    def _set_right_output(
        self,
        direction,
        duty
    ):

        duty = int(
            clamp(
                duty,
                -PWM_MAX,
                PWM_MAX
            )
        )

        magnitude = int(
            clamp(
                abs(duty),
                PWM_MIN,
                PWM_MAX
            )
        )

        if direction == 0 or magnitude == 0:
            self.m2_pwm.duty(0)
            self.duty_right = 0
            return

        if direction > 0:
            self.m2_dir.value(
                M2_FORWARD_DIR
            )

        else:
            self.m2_dir.value(
                1 - M2_FORWARD_DIR
            )

        self.m2_pwm.duty(magnitude)
        self.duty_right = duty


    # =====================================================
    # PID 초기화
    # =====================================================

    def _reset_left_pid(self):

        self.integral_left = 0.0
        self.previous_error_left = 0.0


    def _reset_right_pid(self):

        self.integral_right = 0.0
        self.previous_error_right = 0.0


    # =====================================================
    # 모터 정지
    # =====================================================

    def stop(self):

        self.target_command_left = 0
        self.target_command_right = 0

        self.target_pps_left = 0.0
        self.target_pps_right = 0.0

        self._reset_left_pid()
        self._reset_right_pid()

        self._set_left_output(0, 0)
        self._set_right_output(0, 0)


    # =====================================================
    # 상태 반환
    # =====================================================

    def get_status(self):

        return {
            "command_left":
                self.target_command_left,

            "command_right":
                self.target_command_right,

            "target_pps_left":
                self.target_pps_left,

            "target_pps_right":
                self.target_pps_right,

            "speed_pps_left":
                self.speed_pps_left,

            "speed_pps_right":
                self.speed_pps_right,

            "raw_speed_pps_left":
                self.raw_speed_pps_left,

            "raw_speed_pps_right":
                self.raw_speed_pps_right,

            "error_left": (
                self.target_pps_left
                - self.speed_pps_left
            ),

            "error_right": (
                self.target_pps_right
                - self.speed_pps_right
            ),

            "duty_left":
                self.duty_left,

            "duty_right":
                self.duty_right,

            "integral_left":
                self.integral_left,

            "integral_right":
                self.integral_right,

            # 누적 엔코더 카운트
            "count_left":
                self.m1_count,

            "count_right":
                self.m2_count,

            # 최근 1회 제어 구간의 증가량
            "delta_left":
                self.last_delta_left,

            "delta_right":
                self.last_delta_right,

            "dt":
                self.last_dt
        }
