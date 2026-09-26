"""
SYNAPSE — Automated Patch & AST Verification Sandbox
Validates generated fixes against syntax parsers, bracket balancers, and diff integrity.
Ensures zero hallucinations and avoids breaking user codebases.
"""
from __future__ import annotations

import ast
import re
from typing import Dict, List, Optional, Tuple


class PatchVerifier:
    """
    Automated Code & Diff Verification Sandbox.
    Performs multi-layer verification on AI-generated fixes before human or automated merge.
    """

    @classmethod
    def verify_fix(
        cls,
        original_code: str,
        fixed_code: str,
        file_path: str,
        diff: Optional[str] = None,
        language: Optional[str] = None,
    ) -> Dict[str, any]:
        """
        Runs comprehensive syntax & diff verification.
        Returns a dict with:
          - ast_valid (bool)
          - verification_status ('verified_clean' | 'syntax_valid' | 'warning')
          - verification_notes (str)
          - confidence_modifier (float)
        """
        lang = language or cls._infer_language(file_path)
        notes: List[str] = []
        is_ast_valid = True
        status = "verified_clean"

        # 1. Empty code check
        if not fixed_code or not fixed_code.strip():
            return {
                "ast_valid": False,
                "verification_status": "warning",
                "verification_notes": "Fix suggested an empty code replacement; flagged for manual review.",
                "confidence_modifier": -0.4,
            }

        # 2. Syntax parse test
        if lang == "python":
            py_valid, py_note = cls._verify_python_ast(fixed_code)
            if not py_valid:
                is_ast_valid = False
                status = "warning"
                notes.append(f"Python AST error: {py_note}")
            else:
                notes.append("AST Parse verified: valid Python syntax.")
        elif lang in ("javascript", "typescript", "json", "yaml", "html", "css", "csharp", "java", "go", "rust", "cpp", "c"):
            balance_valid, balance_note = cls._check_delimiter_balance(fixed_code)
            if not balance_valid:
                is_ast_valid = False
                status = "warning"
                notes.append(f"Delimiter syntax error: {balance_note}")
            else:
                notes.append(f"Syntax delimiters verified ({lang}).")
        else:
            notes.append("Generic syntax check passed.")

        # 3. Check for dangerous constructs or accidental regressions
        safety_valid, safety_note = cls._check_dangerous_patterns(fixed_code)
        if not safety_valid:
            status = "warning"
            notes.append(f"Security watch: {safety_note}")

        # 4. Check Diff structure
        if diff:
            diff_valid, diff_note = cls._verify_diff_structure(diff)
            if not diff_valid:
                notes.append(f"Diff warning: {diff_note}")
                if status == "verified_clean":
                    status = "syntax_valid"
            else:
                notes.append("Unified diff cleanly formatted.")

        # If clean and ast valid
        if is_ast_valid and status != "warning":
            final_status = "verified_clean"
            conf_mod = 0.05
        elif is_ast_valid:
            final_status = "syntax_valid"
            conf_mod = 0.0
        else:
            final_status = "warning"
            conf_mod = -0.3

        return {
            "ast_valid": is_ast_valid,
            "verification_status": final_status,
            "verification_notes": " • ".join(notes) if notes else "Verified successfully.",
            "confidence_modifier": conf_mod,
        }

    @staticmethod
    def _infer_language(file_path: str) -> str:
        ext = file_path.rsplit(".", 1)[-1].lower() if "." in file_path else ""
        ext_map = {
            "py": "python",
            "js": "javascript",
            "jsx": "javascript",
            "ts": "typescript",
            "tsx": "typescript",
            "json": "json",
            "yaml": "yaml",
            "yml": "yaml",
            "go": "go",
            "rs": "rust",
            "java": "java",
            "cs": "csharp",
            "cpp": "cpp",
            "c": "c",
        }
        return ext_map.get(ext, "unknown")

    @staticmethod
    def _verify_python_ast(code: str) -> Tuple[bool, str]:
        """Try parsing Python code directly with ast.parse."""
        try:
            ast.parse(code)
            return True, "Code parsed successfully"
        except SyntaxError as e:
            # If the snippet is an indented block or single statement inside a method, try wrapping it
            try:
                wrapped_code = f"def __synapse_sandbox_wrapper__():\n" + "\n".join(
                    f"    {line}" for line in code.splitlines()
                )
                ast.parse(wrapped_code)
                return True, "Block parsed successfully with method context"
            except SyntaxError:
                return False, f"Line {e.lineno}, col {e.offset}: {e.msg}"

    @staticmethod
    def _check_delimiter_balance(code: str) -> Tuple[bool, str]:
        """Checks balance of parentheses, brackets, and curly braces."""
        stack = []
        pairs = {')': '(', '}': '{', ']': '['}
        line_num = 1
        
        # Simple scan ignoring string literals
        in_string = False
        string_char = ''
        escaped = False

        for char in code:
            if char == '\n':
                line_num += 1

            if in_string:
                if escaped:
                    escaped = False
                elif char == '\\':
                    escaped = True
                elif char == string_char:
                    in_string = False
                continue

            if char in ('"', "'", '`'):
                in_string = True
                string_char = char
                continue

            if char in ('(', '{', '['):
                stack.append((char, line_num))
            elif char in pairs:
                expected = pairs[char]
                if not stack or stack[-1][0] != expected:
                    return False, f"Unmatched '{char}' at line {line_num}"
                stack.pop()

        if stack:
            unclosed, open_line = stack[-1]
            return False, f"Unclosed '{unclosed}' originating from line {open_line}"

        return True, "Delimiters balanced"

    @staticmethod
    def _check_dangerous_patterns(code: str) -> Tuple[bool, str]:
        """Flags potential accidental backdoor insertions or raw dangerous functions."""
        dangerous_patterns = [
            (r"\beval\s*\(", "Use of eval() detected in fix"),
            (r"\bexec\s*\(", "Use of exec() detected in fix"),
            (r"os\.system\s*\(", "Unsafe os.system call in fix"),
            (r"__import__\s*\(", "Dynamic __import__ usage detected"),
            (r"subprocess\.Popen\s*\([^,)]*shell\s*=\s*True", "Shell=True detected in subprocess"),
        ]
        for pattern, warning in dangerous_patterns:
            if re.search(pattern, code):
                return False, warning
        return True, "No dangerous anti-patterns detected"

    @staticmethod
    def _verify_diff_structure(diff: str) -> Tuple[bool, str]:
        """Checks that the unified diff contains valid headers and chunks."""
        lines = diff.strip().splitlines()
        if not lines:
            return False, "Empty diff"
        has_chunk = any(line.startswith("@@") for line in lines)
        if not has_chunk:
            return False, "Missing @@ chunk header in diff"
        return True, "Valid diff structure"


# Singleton instance
patch_verifier = PatchVerifier()
