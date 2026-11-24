# SPDX-License-Identifier: MIT
"""Records one live turn of MiniDSH's full-screen terminal for the launch film.

Runs the published `minidsh chat` (from the neutral npm prefix) inside a pseudo-terminal of a
fixed size, types the task on a fixed schedule, answers an approval band if one appears, quits
with Ctrl+D once the turn is over, and writes every byte the terminal UI printed with its time:

    {"t": <ms since start>, "b": "<base64 bytes>"}      one line per read
    {"t": <ms>, "key": "<what we typed>"}                 one line per input we sent

Nothing here reads or prints a key: the provider key is already in MINIDSH_HOME's store (the
user put it there with `minidsh credentials set`). Run as root under WSL:

    python3 -I tui_record.py --out /mnt/c/.../take1.jsonl
"""
import argparse
import base64
import fcntl
import json
import os
import re
import select
import struct
import sys
import termios
import time

TASK = ("The second test in test/table.test.js fails: numbers should be aligned to the right. "
        "Fix src/table.js and run the tests.")
ANSI = re.compile(rb"\x1b\[[0-9;?$]*[ -/]*[@-~]|\x1b\][^\x07]*\x07|\x1b[()][0-9A-Za-z]|\x1b.")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--cols", type=int, default=100)
    ap.add_argument("--rows", type=int, default=30)
    ap.add_argument("--cwd", default="/code/tinytable")
    ap.add_argument("--home", default="/code/.minidsh")
    ap.add_argument("--node", default="/opt/minidsh-node/bin/node")
    ap.add_argument("--cli", default="/opt/minidsh-pkg/lib/node_modules/minidsh/bin/minidsh.js")
    ap.add_argument("--task", default=TASK)
    ap.add_argument("--type-ms", type=int, default=28, help="ms between typed characters")
    ap.add_argument("--timeout", type=int, default=240)
    a = ap.parse_args()

    env = {
        "PATH": "/opt/minidsh-node/bin:/opt/minidsh-pkg/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
        "HOME": "/code",
        "MINIDSH_HOME": a.home,
        "TERM": "xterm-256color",
        "COLORTERM": "truecolor",
        "LANG": "C.UTF-8",
        "LC_ALL": "C.UTF-8",
    }
    # The provider key may come from the environment (e.g. shared from Windows through WSLENV):
    # handed to MiniDSH as is, never printed or written anywhere.
    if os.environ.get("DEEPSEEK_API_KEY"):
        env["DEEPSEEK_API_KEY"] = os.environ["DEEPSEEK_API_KEY"]
    pid, fd = os.forkpty()
    if pid == 0:
        fcntl.ioctl(0, termios.TIOCSWINSZ, struct.pack("HHHH", a.rows, a.cols, 0, 0))
        os.chdir(a.cwd)
        os.execve(a.node, [a.node, a.cli, "chat", "--cwd", a.cwd], env)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", a.rows, a.cols, 0, 0))

    t0 = time.monotonic()
    ms = lambda: int((time.monotonic() - t0) * 1000)
    records: list[dict] = []
    text = ""  # the printed text with escapes removed, for spotting states

    def pump(seconds: float) -> bool:
        """Reads for up to `seconds`; False once the child has gone."""
        nonlocal text
        end = time.monotonic() + seconds
        while True:
            left = end - time.monotonic()
            if left <= 0:
                return True
            r, _, _ = select.select([fd], [], [], min(left, 0.05))
            if r:
                try:
                    data = os.read(fd, 65536)
                except OSError:
                    return False
                if not data:
                    return False
                records.append({"t": ms(), "b": base64.b64encode(data).decode("ascii")})
                text = (text + ANSI.sub(b"", data).decode("utf-8", "replace"))[-20000:]

    def send(s: str) -> None:
        records.append({"t": ms(), "key": s})
        os.write(fd, s.encode("utf-8"))

    def wait_for(pattern: str, seconds: float, after: int = 0) -> bool:
        end = time.monotonic() + seconds
        while time.monotonic() < end:
            if not pump(0.1):
                return False
            if re.search(pattern, text[after:]):
                return True
        return False

    alive = wait_for(r"Ask for anything|ready", 40)
    if not alive:
        print("no welcome screen", file=sys.stderr)
    pump(1.5)
    for ch in a.task:
        send(ch)
        pump(a.type_ms / 1000)
    pump(0.8)
    mark = len(text)
    send("\r")
    deadline = time.monotonic() + a.timeout
    saw_working = False
    answered = 0
    while time.monotonic() < deadline:
        if not pump(0.2):
            break
        tail = text[mark:]
        if "working" in tail:
            saw_working = True
        asks = tail.count("Approval needed")
        if asks > answered:
            pump(0.9)  # the band's keys arm after 600 ms
            send("y")
            answered = asks
            continue
        if saw_working and re.search(r"ready", text[-600:]) and "working" not in text[-120:]:
            break
    pump(2.5)
    send("\x04")
    pump(3.0)
    try:
        os.waitpid(pid, 0)
    except ChildProcessError:
        pass
    with open(a.out, "w", encoding="utf-8") as f:
        f.write(json.dumps({"cols": a.cols, "rows": a.rows, "task": a.task, "approvals": answered}) + "\n")
        for r in records:
            f.write(json.dumps(r) + "\n")
    print(f"wrote {len(records)} records, {ms()} ms, approvals answered: {answered}, saw working: {saw_working}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
