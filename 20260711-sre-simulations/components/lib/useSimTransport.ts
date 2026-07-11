/**
 * useSimTransport — Play/Pause/Scrub-Transport der Diagnose-Sims
 * (generalisiert aus dem rAF-Loop der Original-HTMLs). Der Playhead läuft
 * in Sim-Sekunden [0..tMax] und spielt die Gesamtspanne in `runSeconds`
 * Realzeit ab. `onChange` feuert bei jeder Playhead-Änderung — dort hängen
 * die (nicht-reaktiven) D3-Sync-Aufrufe des Hosts.
 *
 * Loops starten pausiert, canceln bei Unmount und sollten vom Host bei
 * Folienwechsel via stop() angehalten werden (Slidev hält Nachbar-Folien
 * gemountet).
 */
import { getCurrentInstance, onUnmounted, ref } from "vue";

export interface SimTransportOptions {
  tMax: number; // Sim-Zeitspanne (Sekunden)
  runSeconds?: number; // Realzeit für einen kompletten Durchlauf (Default 11 s)
  startAtEnd?: boolean; // Playhead initial ans Ende (Default true — Originale zeigen erst das fertige Bild)
  onChange?: (t: number) => void;
}

export function useSimTransport(opts: SimTransportOptions) {
  const runSeconds = opts.runSeconds ?? 11;
  const playhead = ref(opts.startAtEnd === false ? 0 : opts.tMax);
  const playing = ref(false);

  let rafId = 0;
  let playStart: number | null = null;
  let playFrom = 0;

  function emitChange() {
    opts.onChange?.(playhead.value);
  }

  function tick(ts: number) {
    if (!playing.value) return;
    if (playStart === null) playStart = ts;
    playhead.value = Math.min(
      opts.tMax,
      playFrom + ((ts - playStart) / 1000) * (opts.tMax / runSeconds),
    );
    emitChange();
    if (playhead.value >= opts.tMax) {
      setPlay(false);
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  function setPlay(on: boolean) {
    playing.value = on;
    if (on) {
      playStart = null;
      playFrom = playhead.value;
      rafId = requestAnimationFrame(tick);
    } else if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  /* ▶/⏸-Knopf: am Ende angekommen startet Play wieder von vorn. */
  function toggle() {
    if (!playing.value && playhead.value >= opts.tMax) {
      playhead.value = 0;
      emitChange();
    }
    setPlay(!playing.value);
  }

  /* Slider-Input: Scrubben pausiert. */
  function scrub(t: number) {
    if (playing.value) setPlay(false);
    playhead.value = Math.max(0, Math.min(opts.tMax, t));
    emitChange();
  }

  function stop() {
    setPlay(false);
  }

  /* Ans Ende springen (z.B. nach Reset). */
  function jumpToEnd() {
    setPlay(false);
    playhead.value = opts.tMax;
    emitChange();
  }

  if (getCurrentInstance()) onUnmounted(stop);

  return { playhead, playing, toggle, scrub, stop, jumpToEnd, setPlay };
}
