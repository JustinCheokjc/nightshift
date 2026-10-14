"""Stand-in workload for the sandbox: one 64x64 tile of a Mandelbrot render.

Deterministic, so any device's result can be checked by recomputing it.
Each tile stands in for 15 core-minutes of a buyer's real work.
"""

SIZE = 64        # tile edge, pixels
IMAGE = 256      # rendered image edge, pixels
TILES_PER_SIDE = IMAGE // SIZE
MAX_ITER = 255


def render_tile(cx, cy, scale, tx, ty, should_stop=None):
    """Return SIZE*SIZE bytes of iteration counts, or None if should_stop() said stop."""
    out = bytearray(SIZE * SIZE)
    half = IMAGE / 2
    for py in range(SIZE):
        if should_stop and should_stop():
            return None
        y0 = cy + (ty * SIZE + py - half) * scale
        row = py * SIZE
        for px in range(SIZE):
            x0 = cx + (tx * SIZE + px - half) * scale
            x = y = 0.0
            i = 0
            while x * x + y * y <= 4.0 and i < MAX_ITER:
                x, y = x * x - y * y + x0, 2 * x * y + y0
                i += 1
            out[row + px] = i
    return bytes(out)
