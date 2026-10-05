"""Original 30-second soundtrack for the Nightshift product film.

Pure Python (standard library only): synthesises a calm 96 BPM synth track whose sections follow
the film's scenes, then writes a 44.1 kHz stereo 16-bit WAV.

    python music.py out.wav

Mix it into the video with ffmpeg (see landing-handoff.md).
"""
import math
import random
import struct
import sys
import wave
from array import array

SR = 44100
LENGTH = 30.0
BPM = 96
BEAT = 60 / BPM          # 0.625 s
BAR = BEAT * 4           # 2.5 s -> 12 bars in 30 s
N = int(SR * LENGTH)
L = array("f", bytes(4 * N))
R = array("f", bytes(4 * N))
TAU = 2 * math.pi
random.seed(3)


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def mix(start, samples, amp, pan=0.0):
    """Add mono samples at time `start` (s), panned -1 (left) .. 1 (right)."""
    i0 = int(start * SR)
    gl, gr = amp * math.sqrt((1 - pan) / 2), amp * math.sqrt((1 + pan) / 2)
    for k, s in enumerate(samples):
        i = i0 + k
        if i >= N:
            break
        L[i] += s * gl
        R[i] += s * gr


def pluck(f, dur=0.7):
    n = int(dur * SR)
    out = []
    for k in range(n):
        t = k / SR
        a = min(1.0, t / 0.004)
        out.append(a * (math.sin(TAU * f * t) * math.exp(-t * 5.5) + 0.3 * math.sin(TAU * 2 * f * t) * math.exp(-t * 11)))
    return out


def bell(f, dur=2.2):
    n = int(dur * SR)
    return [min(1.0, (k / SR) / 0.003) * (math.sin(TAU * f * k / SR) + 0.35 * math.sin(TAU * 2.76 * f * k / SR) * math.exp(-k / SR * 3))
            * math.exp(-k / SR * 2.2) for k in range(n)]


def pad(f, dur, attack=1.2, release=1.4):
    n = int(dur * SR)
    out = []
    for k in range(n):
        t = k / SR
        env = min(1.0, t / attack) * min(1.0, max(0.0, (dur - t) / release))
        out.append(env * (math.sin(TAU * f * t) + 0.6 * math.sin(TAU * f * 1.004 * t + 1.3) + 0.22 * math.sin(TAU * 2 * f * t)))
    return out


def bass(f, dur):
    n = int(dur * SR)
    return [min(1.0, (k / SR) / 0.01) * math.exp(-(k / SR) * 1.6) * (math.sin(TAU * f * k / SR) + 0.25 * math.sin(TAU * 2 * f * k / SR))
            for k in range(n)]


def kick():
    n = int(0.35 * SR)
    out, ph = [], 0.0
    for k in range(n):
        t = k / SR
        f = 45 + 85 * math.exp(-t * 28)
        ph += TAU * f / SR
        out.append(math.sin(ph) * math.exp(-t * 9))
    return out


def hat():
    n = int(0.05 * SR)
    prev, out = 0.0, []
    for k in range(n):
        w = random.uniform(-1, 1)
        out.append((w - prev) * math.exp(-k / SR * 90))   # crude high-pass on noise
        prev = w
    return out


# Chords per bar (MIDI), bass root per bar. Scenes: day 0-1, night 2-3, dashboard 4-6, privacy 7-8, matching 9-10, end 11.
CMAJ7, AM7, FMAJ7, G6, DM7, CMAJ9 = [60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 64], [50, 53, 57, 60], [60, 64, 67, 71, 74]
BARS = [CMAJ7, CMAJ7, AM7, AM7, FMAJ7, G6, AM7, FMAJ7, DM7, G6, FMAJ7, CMAJ9]
ROOTS = [36, 36, 45, 45, 41, 43, 45, 41, 38, 43, 41, 36]
KICK, HAT = kick(), hat()

for b, chord in enumerate(BARS):
    t0 = b * BAR
    # Arpeggio: eighths, then sixteenths in the "matching" build. Off in the final bar.
    if b < 11:
        step = BEAT / 4 if b in (9, 10) else BEAT / 2
        steps = int(BAR / step)
        tones = chord + [n + 12 for n in chord]
        order = list(range(len(tones))) + list(range(len(tones) - 2, 0, -1))
        amp = {0: .16, 1: .17, 7: .07, 8: .07}.get(b, .12 if b < 9 else .11)
        for s in range(steps):
            note = tones[order[s % len(order)]] + 12
            mix(t0 + s * step, pluck(hz(note), 0.55 if step < BEAT / 2 else 0.8), amp, pan=-.35 if s % 2 else .35)
    # Pad from nightfall on.
    if b >= 2:
        for i, note in enumerate(chord):
            mix(t0, pad(hz(note), BAR + 0.6 if b < 11 else 2.5, attack=1.0 if b == 2 else .5, release=1.0 if b < 11 else 2.3),
                .045, pan=(i - 1.5) * .3)
    # Bass from the second night bar.
    if b >= 3:
        for beat in ((0, 2) if b not in (9, 10) else (0, 1, 2, 3)):
            mix(t0 + beat * BEAT, bass(hz(ROOTS[b]), BEAT * 1.8), .22 if b != 11 else .26)
    # Beat in the dashboard and matching scenes; one last hit on the end card.
    if b in (4, 5, 6, 9, 10):
        for beat in ((0, 2) if b < 9 else (0, 1, 2, 3)):
            mix(t0 + beat * BEAT, KICK, .5 if b < 9 else .42)
        for e in range(8):
            if e % 2:
                mix(t0 + e * BEAT / 2, HAT, .09, pan=.2)
    if b == 11:
        mix(t0, KICK, .45)
    # Bells for the privacy scene and the end card.
    if b in (7, 8):
        for beat, note in ((0, chord[-1] + 24), (2, chord[1] + 24)):
            mix(t0 + beat * BEAT, bell(hz(note)), .07, pan=.4 if beat else -.4)
    if b == 11:
        for i, note in enumerate((CMAJ9[2] + 12, CMAJ9[4] + 12, CMAJ9[0] + 24)):
            mix(t0 + i * BEAT * .5, bell(hz(note), 3.0), .06, pan=(i - 1) * .4)


def reverb(x, delays, wet=.28):
    """Small Schroeder reverb: four parallel combs into two allpasses."""
    out = array("f", bytes(4 * N))
    for d, g in delays:
        buf = array("f", bytes(4 * N))
        for i in range(N):
            buf[i] = x[i] + (g * buf[i - d] if i >= d else 0.0)
            out[i] += buf[i] * .25
    for d in (225, 556):
        y = array("f", bytes(4 * N))
        for i in range(N):
            xd = out[i - d] if i >= d else 0.0
            yd = y[i - d] if i >= d else 0.0
            y[i] = -0.5 * out[i] + xd + 0.5 * yd
        out = y
    return array("f", (x[i] * (1 - wet) + out[i] * wet for i in range(N)))


L = reverb(L, [(1557, .80), (1617, .80), (1491, .79), (1422, .78)])
R = reverb(R, [(1577, .80), (1637, .80), (1511, .79), (1442, .78)])

peak = max(max(abs(v) for v in L), max(abs(v) for v in R)) or 1.0
fade_in, fade_out = int(.25 * SR), int(2.2 * SR)
frames = bytearray()
for i in range(N):
    g = .89 / peak * min(1.0, i / fade_in) * min(1.0, (N - i) / fade_out)
    frames += struct.pack("<hh", int(max(-1, min(1, L[i] * g)) * 32767), int(max(-1, min(1, R[i] * g)) * 32767))

out_path = sys.argv[1] if len(sys.argv) > 1 else "nightshift-film-music.wav"
with wave.open(out_path, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(bytes(frames))
print("wrote", out_path)
