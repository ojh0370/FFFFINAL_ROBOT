import { useRef, useCallback } from "react";

// ESP32 부저와 같은 440Hz 톤을 웹 오디오로 재현 (별도 mp3 파일 불필요)
export function useBuzzerAudio() {
  const ctxRef = useRef(null);

  const getCtx = () => {
    if (!ctxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      ctxRef.current = new AudioCtx();
    }
    return ctxRef.current;
  };

  // 브라우저 자동재생 정책상, 사용자가 한 번이라도 페이지를 클릭/터치한 이후에만 소리가 납니다.
  const playAlertSound = useCallback(() => {
    try {
      const ctx = getCtx();
      if (ctx.state === "suspended") ctx.resume();

      const beep = (startDelaySec) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = 440;
        gain.gain.value = 0.15;
        osc.connect(gain).connect(ctx.destination);
        const t0 = ctx.currentTime + startDelaySec;
        osc.start(t0);
        osc.stop(t0 + 0.22);
      };

      // 삐-삐-삐 3연타
      beep(0);
      beep(0.35);
      beep(0.7);
    } catch (e) {
      console.warn("[buzzer] 소리 재생 실패:", e);
    }
  }, []);

  return { playAlertSound };
}
