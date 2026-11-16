import struct, os
for f in sorted(os.listdir("screenshots")):
    p = "screenshots/" + f
    d = open(p, "rb").read()
    i = 2; w = h = 0
    while i < len(d):
        if d[i] != 0xFF:
            i += 1; continue
        m = d[i + 1]
        if m in (0xC0, 0xC1, 0xC2):
            h = struct.unpack(">H", d[i + 5:i + 7])[0]
            w = struct.unpack(">H", d[i + 7:i + 9])[0]
            break
        if m in (0xD8, 0xD9) or 0xD0 <= m <= 0xD7:
            i += 2; continue
        ln = struct.unpack(">H", d[i + 2:i + 4])[0]; i += 2 + ln
    ok = len(d) <= 262144
    print("%-22s %dx%d %7.1f KiB  cap_ok=%s" % (f, w, h, len(d) / 1024, ok))
