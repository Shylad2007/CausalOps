import os
import shutil
import zipfile
import tempfile
import logging
from pathlib import Path
from typing import Tuple, List, Optional
from app.models.codebase_schemas import CodebaseManifest, ProjectType

logger = logging.getLogger("CausalOps.RepoIngest")

IGNORED_DIRECTORIES = {
    ".git", "__pycache__", "node_modules", "venv", ".venv", "dist", "build",
    ".idea", ".vscode", "target", ".pytest_cache", ".next", ".nuxt"
}

SUPPORTED_EXTENSIONS = {
    ".py", ".js", ".jsx", ".ts", ".tsx", ".json", ".sql", ".env", ".yaml", ".yml", ".html"
}

MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 # 5 MB per file
MAX_TOTAL_ARCHIVE_FILES = 2000

class RepoIngestService:
    """
    Safely unpacks ZIP codebases preventing path traversal and Zip Bomb attacks.
    Detects project languages, frameworks, and architecture.
    """

    def extract_zip(self, zip_bytes: bytes, target_dir: str) -> List[str]:
        """
        Safely extracts ZIP bytes ensuring no Zip-Slip (path traversal) vulnerability.
        If all archive members are contained inside a single root directory (e.g., GitHub
        zipball format `{owner}-{repo}-{sha}/`), strips that root folder so project
        files are placed directly at canonical repository paths.
        """
        extracted_files = []
        target_path = Path(target_dir).resolve()
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=".zip") as tmp_file:
            tmp_file.write(zip_bytes)
            tmp_file_path = tmp_file.name

        try:
            with zipfile.ZipFile(tmp_file_path, 'r') as zip_ref:
                infolist = zip_ref.infolist()
                if len(infolist) > MAX_TOTAL_ARCHIVE_FILES:
                    raise ValueError(f"Archive exceeds maximum allowed files count ({MAX_TOTAL_ARCHIVE_FILES})")

                # Detect if all non-empty entries share a single common root folder
                # (e.g. GitHub archives have root "{owner}-{repo}-{sha}/")
                valid_members = [
                    m for m in infolist
                    if not m.filename.startswith("__MACOSX")
                    and not m.filename.endswith(".DS_Store")
                ]

                first_parts = set()
                for m in valid_members:
                    p_parts = Path(m.filename).parts
                    if p_parts:
                        first_parts.add(p_parts[0])

                has_single_root = (
                    len(first_parts) == 1
                    and all(len(Path(m.filename).parts) > 1 or m.is_dir() for m in valid_members)
                )

                for member in infolist:
                    parts = Path(member.filename).parts
                    if not parts:
                        continue

                    # If single common root folder (e.g. owner-repo-sha), strip it
                    if has_single_root:
                        if len(parts) <= 1:
                            # This is the root folder itself
                            continue
                        rel_parts = parts[1:]
                    else:
                        rel_parts = parts

                    # Skip ignored directories
                    if set(rel_parts).intersection(IGNORED_DIRECTORIES):
                        continue

                    rel_path = Path(*rel_parts)
                    member_path = (target_path / rel_path).resolve()

                    # Defensive Zip-Slip check: prevent extraction outside target_path
                    if not str(member_path).startswith(str(target_path)):
                        raise ValueError(f"Malicious archive member attempted path traversal: {member.filename}")
                    
                    if member.file_size > MAX_FILE_SIZE_BYTES:
                        logger.warning(f"Skipping oversized file {member.filename} ({member.file_size} bytes)")
                        continue

                    if member.is_dir():
                        member_path.mkdir(parents=True, exist_ok=True)
                    else:
                        member_path.parent.mkdir(parents=True, exist_ok=True)
                        with zip_ref.open(member) as source, open(member_path, "wb") as target:
                            shutil.copyfileobj(source, target)
                        extracted_files.append(str(member_path))
        finally:
            if os.path.exists(tmp_file_path):
                os.remove(tmp_file_path)

        return extracted_files

    def analyze_manifest(self, base_dir: str) -> CodebaseManifest:
        """
        Analyzes directory structure to detect project languages, frameworks, and structure.
        """
        base_path = Path(base_dir).resolve()
        languages = set()
        frameworks = set()
        source_files = []
        total_files = 0

        for root, dirs, files in os.walk(base_path):
            dirs[:] = [d for d in dirs if d not in IGNORED_DIRECTORIES]
            for file in files:
                total_files += 1
                rel_path = os.path.relpath(os.path.join(root, file), base_path)
                ext = Path(file).suffix.lower()

                if ext in SUPPORTED_EXTENSIONS:
                    source_files.append(rel_path.replace("\\", "/"))

                # Language detection
                if ext == ".py":
                    languages.add("Python")
                elif ext in [".js", ".jsx"]:
                    languages.add("JavaScript")
                elif ext in [".ts", ".tsx"]:
                    languages.add("TypeScript")
                elif ext == ".sql":
                    languages.add("SQL")

                # Framework and config detection
                if file == "requirements.txt" or file == "Pipfile":
                    # Check for FastAPI / Flask / Django
                    try:
                        content = (Path(root) / file).read_text(encoding="utf-8", errors="ignore").lower()
                        if "fastapi" in content: frameworks.add("FastAPI")
                        if "flask" in content: frameworks.add("Flask")
                        if "django" in content: frameworks.add("Django")
                    except Exception:
                        pass
                elif file == "package.json":
                    try:
                        content = (Path(root) / file).read_text(encoding="utf-8", errors="ignore").lower()
                        if "express" in content: frameworks.add("Express")
                        if "react" in content: frameworks.add("React")
                        if "next" in content: frameworks.add("Next.js")
                        if "vue" in content: frameworks.add("Vue")
                    except Exception:
                        pass

        # Infer Project Type
        has_fe = bool(frameworks.intersection({"React", "Vue", "Next.js"}))
        has_be = bool(frameworks.intersection({"FastAPI", "Flask", "Django", "Express"}))

        if has_fe and has_be:
            proj_type = ProjectType.FULL_STACK
        elif has_be:
            proj_type = ProjectType.API_BACKEND
        elif has_fe:
            proj_type = ProjectType.WEB_APP
        else:
            proj_type = ProjectType.WEB_APP if "JavaScript" in languages else ProjectType.API_BACKEND

        return CodebaseManifest(
            project_name=base_path.name,
            detected_languages=sorted(list(languages)),
            detected_frameworks=sorted(list(frameworks)),
            project_type=proj_type,
            total_files=total_files,
            scanned_files=len(source_files),
            source_files=source_files[:100] # Cap listing for API payload
        )
