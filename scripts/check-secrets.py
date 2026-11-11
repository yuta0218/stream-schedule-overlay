#!/usr/bin/env python3
"""ステージまたは送信する履歴から、秘密情報の形式と禁止ファイル名を検査します。"""
import re
import subprocess
import sys
from pathlib import PurePosixPath


def git(*args):
    return subprocess.check_output(["git", *args])


TOKEN = re.compile(
    rb"pat-[a-z0-9]{2,}-|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}"
    rb"|xox[baprs]-[A-Za-z0-9-]{10,}|sk-ant-[A-Za-z0-9_-]{20,}"
    rb"|sk-[A-Za-z0-9]{32,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}"
    rb"|-----BEGIN [A-Z ]*PRIVATE KEY-----"
)


def inspect(revision, names):
    failed = False
    for raw_name in names.split(b"\0"):
        if not raw_name:
            continue
        name = raw_name.decode("utf-8")
        leaf = PurePosixPath(name).name.lower()
        if (leaf == ".env" or leaf.startswith(".env.") or
                leaf.startswith("id_rsa") or leaf.endswith((".pem", ".key", ".p12")) or
                leaf in ("credentials.json", "service-account.json")):
            print(f"禁止ファイルが含まれています: {name}", file=sys.stderr)
            failed = True
            continue
        content = git("show", f"{revision}:{name}")
        if len(content) > 5 * 1024 * 1024:
            print(f"5MBを超えるファイルは公開対象から外してください: {name}", file=sys.stderr)
            failed = True
        if name != "scripts/check-secrets.py" and TOKEN.search(content):
            # 検出値そのものはログへ出しません。
            print(f"秘密情報らしき文字列が含まれています: {name}", file=sys.stderr)
            failed = True
    return failed


if sys.argv[1:] == ["--staged"]:
    failed = inspect("", git("diff", "--cached", "--name-only", "--diff-filter=ACMRT", "-z"))
elif len(sys.argv) == 3 and sys.argv[1] == "--history":
    failed = False
    for revision in git("rev-list", sys.argv[2]).decode().splitlines():
        names = git("diff-tree", "--root", "--no-commit-id", "--name-only", "-r", "--diff-filter=ACMRT", "-z", revision)
        failed = inspect(revision, names) or failed
else:
    sys.exit("使い方: check-secrets.py --staged または --history <コミット範囲>")
sys.exit(1 if failed else 0)
