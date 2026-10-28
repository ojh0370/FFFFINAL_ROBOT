# main.py

import time

from motor_control import (
    MotorController
)

from uart_receive import (
    UARTReceiver,
    COMMAND_MOTOR,
    COMMAND_SENSOR_START,
    COMMAND_SENSOR_STOP
)

from sensor_control import (
    SensorController
)


# =========================================================
# 로그 설정
# =========================================================

STATUS_LOG_INTERVAL = 0.5

UART_RESPONSE_INTERVAL = 0.05


# Raspberry Pi의 모터 명령이 끊겼을 때
# 자동 정지
COMMAND_TIMEOUT = 0.5


def main():

    print(
        "=========================================="
    )

    print(
        "ESP32 Motor + Sensor Controller Start"
    )

    print(
        "UART: 115200 baud"
    )

    print(
        "Motor command: left,right"
    )

    print(
        "Sensor command: START / STOP"
    )

    print(
        "Motor response: "
        "OK,left,right,m1_pps,m2_pps"
    )

    print(
        "Sensor response: "
        "SENSOR,distance_cm"
    )

    print(
        "Encoder IRQ: "
        "A channel rising + falling"
    )

    print(
        "Encoder decoding: 2x"
    )

    print(
        "=========================================="
    )

    # =====================================================
    # 객체 생성
    # =====================================================

    motor = MotorController()

    uart = UARTReceiver()

    sensor = SensorController()
    
#    sensor.start() #삭제해야하는 부


    last_command_time = (
        time.ticks_ms()
    )

    last_status_log_time = (
        time.ticks_ms()
    )

    last_uart_response_time = (
        time.ticks_ms()
    )


    try:

        while True:

            # =================================================
            # UART 명령 수신
            # =================================================

            command = (
                uart.read_command()
            )

            if command is not None:

                command_type = (
                    command[0]
                )

                # ---------------------------------------------
                # 모터 명령
                # ---------------------------------------------

                if (
                    command_type
                    == COMMAND_MOTOR
                ):

                    left_command = (
                        command[1]
                    )

                    right_command = (
                        command[2]
                    )

                    motor.set_target_commands(
                        left_command,
                        right_command
                    )

                    # 중요:
                    #
                    # motor watchdog 시간은
                    # MOTOR 명령을 받았을 때만 갱신한다.
                    #
                    # START / STOP 때문에 watchdog이
                    # 연장되면 안 된다.

                    last_command_time = (
                        time.ticks_ms()
                    )

                # ---------------------------------------------
                # 센서 START
                # ---------------------------------------------

                elif (
                    command_type
                    == COMMAND_SENSOR_START
                ):

                    sensor.start()

                    uart.send_sensor_started()

                    print(
                        "[SENSOR] START"
                    )

                # ---------------------------------------------
                # 센서 STOP
                # ---------------------------------------------

                elif (
                    command_type
                    == COMMAND_SENSOR_STOP
                ):

                    sensor.stop()

                    uart.send_sensor_stopped()

                    print(
                        "[SENSOR] STOP"
                    )


            # =================================================
            # 모터 UART timeout
            # =================================================

            command_age_ms = (
                time.ticks_diff(
                    time.ticks_ms(),
                    last_command_time
                )
            )

            if command_age_ms > int(
                COMMAND_TIMEOUT * 1000
            ):

                if (
                    motor.target_command_left != 0
                    or
                    motor.target_command_right != 0
                ):

                    print(
                        "[SAFETY] UART timeout "
                        "-> motor stop"
                    )

                    motor.stop()


            # =================================================
            # 속도 PID 업데이트
            # =================================================

            updated = (
                motor.update()
            )

            if updated:

                status = (
                    motor.get_status()
                )

                now_ms = (
                    time.ticks_ms()
                )


                # =============================================
                # Raspberry Pi로 모터 PPS 전송
                # =============================================

                if time.ticks_diff(
                    now_ms,
                    last_uart_response_time
                ) >= int(
                    UART_RESPONSE_INTERVAL
                    * 1000
                ):

                    last_uart_response_time = (
                        now_ms
                    )

                    uart.send_status(
                        status[
                            "command_left"
                        ],
                        status[
                            "command_right"
                        ],
                        status[
                            "speed_pps_left"
                        ],
                        status[
                            "speed_pps_right"
                        ]
                    )


                # =============================================
                # 상세 로그
                # =============================================

                if time.ticks_diff(
                    now_ms,
                    last_status_log_time
                ) >= int(
                    STATUS_LOG_INTERVAL
                    * 1000
                ):

                    last_status_log_time = (
                        now_ms
                    )

                    print(
                        "[PID] "
                        "CMD L:{:4d} R:{:4d} | "
                        "TARGET L:{:7.1f} R:{:7.1f} | "
                        "PPS L:{:7.1f} R:{:7.1f} | "
                        "RAW L:{:7.1f} R:{:7.1f} | "
                        "ERR L:{:7.1f} R:{:7.1f} | "
                        "DUTY L:{:4d} R:{:4d}"
                        .format(
                            status[
                                "command_left"
                            ],
                            status[
                                "command_right"
                            ],
                            status[
                                "target_pps_left"
                            ],
                            status[
                                "target_pps_right"
                            ],
                            status[
                                "speed_pps_left"
                            ],
                            status[
                                "speed_pps_right"
                            ],
                            status[
                                "raw_speed_pps_left"
                            ],
                            status[
                                "raw_speed_pps_right"
                            ],
                            status[
                                "error_left"
                            ],
                            status[
                                "error_right"
                            ],
                            status[
                                "duty_left"
                            ],
                            status[
                                "duty_right"
                            ]
                        )
                    )


                    print(
                        "[ENC] "
                        "COUNT L:{:8d} R:{:8d} | "
                        "DELTA L:{:5d} R:{:5d} | "
                        "DT:{:.4f}s"
                        .format(
                            status[
                                "count_left"
                            ],
                            status[
                                "count_right"
                            ],
                            status[
                                "delta_left"
                            ],
                            status[
                                "delta_right"
                            ],
                            status[
                                "dt"
                            ]
                        )
                    )


            # =================================================
            # 초음파 센서 측정
            # =================================================
            #
            # motor.update() 뒤에서 실행한다.
            #
            # time_pulse_us()는 Echo를 기다리는 동안
            # 잠시 blocking될 수 있으므로,
            # 현재 PID update를 먼저 수행시키기 위함.
            # =================================================

            distance_cm = sensor.update()

            if distance_cm is not None:

                uart.send_sensor_data(
                    distance_cm
                )


            time.sleep_ms(2)


    except KeyboardInterrupt:

        print(
            "\n[STOP] KeyboardInterrupt"
        )


    except Exception as error:

        print(
            "\n[FATAL ERROR]",
            error
        )


    finally:

        sensor.stop()

        motor.stop()

        print(
            "ESP32 Motor + Sensor Stop"
        )


main()

