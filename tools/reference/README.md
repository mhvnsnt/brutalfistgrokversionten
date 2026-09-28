# Reference fighters — measuring a game that already feels right

Owner, repeatedly: "play a match of the Tekken game and play a match of our game
side by side and then build until our game feels just as smooth" ... "I didn't
download the Tekken rom for nothing it's in a drive u gave u and ur gonna find a
way to use it."

He was right, and it works. **Tekken 3 runs in this container.**

## What is measured, and what is NOT copied

**Frame data and design are facts, not assets.** Nobody owns "a 10-frame jab" or
"recovery is 18 frames" — every fighting-game frame-data site is built by
measuring a retail copy, and every fighting game since 1994 has copied Tekken's
timing conventions. Those NUMBERS are what this is for, and they are applied to
animations we legally hold: Schwarzerblitz's imported clips, Mixamo, CMU,
Truebones CC0, and the owner's own mocap.

**What is never taken:** Tekken's animation data, models, textures, audio or
code. None of it enters the repo or the build. The ROM stays out of git.

A note the owner raised and that is worth having written down: Pokkén Tournament
could reuse Tekken animations because **Bandai Namco made both**. That is
ownership, not a loophole — it is not a route available to us. Measuring timing
is.

## Running it

The disc image is the owner's own copy and lives OUTSIDE the repo:

    ~/scratch/rom/Tekken 3 (USA).cue   (+ three .bin tracks)

No Sony BIOS is required or used. PCSX-Reloaded ships an **HLE BIOS** and
defaults to it (`Bios = HLE` in `~/.pcsxr/pcsxr.cfg`), which is what makes this
possible at all — mednafen refuses without a real `scph5501.bin`, and that file
is not ours to fetch.

    apt-get install -y pcsxr x11-apps imagemagick
    Xvfb :77 -screen 0 640x480x24 &
    DISPLAY=:77 /usr/games/pcsxr -nogui -cdfile "<path>/Tekken 3 (USA).cue" &
    DISPLAY=:77 import -window root frame.png

`pcsxr` writes its config on first GUI launch; `-nogui` refuses to start without
one, so run it once under Xvfb to generate `~/.pcsxr/pcsxr.cfg` before scripting.

VERIFIED: boots to attract mode, plays the KING vs HEIHACHI demo match with live
health bars and a running timer, characters animating between captured frames.
ALSA errors in the log are a missing sound card and are harmless.

## Why this matters more than it looks

Every combat probe written before this compared our game against MY IDEA of how
a fighting game should behave. This replaces that with a measurement of one that
demonstrably does.
