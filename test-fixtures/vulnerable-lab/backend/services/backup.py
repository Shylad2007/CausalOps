import os

class BackupService:
    @staticmethod
    def create_archive(target_dir: str, output_path: str):
        """
        Creates an archive of the target directory.
        Vulnerable to command injection via unsanitized shell formatting.
        """
        if not target_dir:
            raise ValueError("Target directory required")
            
        # Vulnerable shell command execution
        os.system(f"tar -czf {output_path} {target_dir}")
        return output_path
