"""
scripts/github_pr_helper.py

Automates creating, inspecting, and merging Pull Requests via the GitHub REST API.
Uses credentials from the local Git Credential Manager without exposing them.
"""

import subprocess
import urllib.request
import urllib.error
import json
from typing import Tuple, Dict, Any, Optional

REPO_OWNER = "Shylad2007"
REPO_NAME = "CausalOps"
API_BASE = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}"


def _get_token() -> str:
    p = subprocess.Popen(
        ['git', 'credential', 'fill'],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    stdout, _ = p.communicate('protocol=https\nhost=github.com\n\n')
    for line in stdout.splitlines():
        if line.startswith('password='):
            return line.split('password=', 1)[1].strip()
    raise RuntimeError("Could not retrieve GitHub token from Git credential store.")


def _request(endpoint: str, method: str = "GET", data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    token = _get_token()
    url = f"{API_BASE}/{endpoint.lstrip('/')}"
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "CausalOps-Deployment-Bot",
        "Content-Type": "application/json"
    }
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def create_pr(title: str, body: str, head_branch: str, base_branch: str = "main") -> Tuple[int, str]:
    """Creates a Pull Request on GitHub and returns (pr_number, html_url)."""
    payload = {
        "title": title,
        "body": body,
        "head": head_branch,
        "base": base_branch
    }
    res = _request("pulls", method="POST", data=payload)
    return res["number"], res["html_url"]


def merge_pr(pr_number: int, commit_title: Optional[str] = None, merge_method: str = "merge") -> Tuple[bool, str]:
    """Merges a Pull Request on GitHub."""
    payload: Dict[str, Any] = {"merge_method": merge_method}
    if commit_title:
        payload["commit_title"] = commit_title
    res = _request(f"pulls/{pr_number}/merge", method="PUT", data=payload)
    return res.get("merged", False), res.get("sha", "")


def get_pr(pr_number: int) -> Dict[str, Any]:
    """Gets Pull Request details."""
    return _request(f"pulls/{pr_number}")


if __name__ == "__main__":
    import sys
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    if cmd == "test":
        token = _get_token()
        print("Token retrieved successfully (length:", len(token), ")")
