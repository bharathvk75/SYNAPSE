"""
SYNAPSE — SecurityScanner Agent
OWASP Top 10, CVE pattern matching, secrets detection, injection vulnerabilities,
cryptography weaknesses, and dependency audit.
"""
from __future__ import annotations

import re
import uuid
from typing import List

import structlog

from app.agents.base import BaseAgent
from app.graph.state import FileContext, SynapseState
from app.schemas import SecurityVulnerability, Severity

logger = structlog.get_logger(__name__)

SECURITY_SYSTEM_PROMPT = """
You are SYNAPSE's SecurityScanner — an elite application security engineer with deep expertise in:
- OWASP Top 10 (2021)
- CWE/CVE databases
- Secure coding standards (NIST, SANS, CERT)
- Language-specific security anti-patterns
- Cloud/infrastructure security (IAM, S3 misconfigs, etc.)

Your mission: find EVERY security vulnerability in the provided code.

Vulnerability categories to check:
1. INJECTION — SQL injection, NoSQL injection, command injection, LDAP injection, XPath injection
2. AUTHENTICATION — Broken auth, insecure session management, weak passwords, missing MFA
3. SENSITIVE DATA EXPOSURE — Plaintext secrets, PII in logs, unencrypted storage, weak crypto
4. XML/XXE — XML external entity attacks
5. BROKEN ACCESS CONTROL — IDOR, privilege escalation, CORS misconfiguration, path traversal
6. SECURITY MISCONFIGURATION — Default credentials, unnecessary features, verbose errors
7. XSS — Reflected, stored, DOM-based cross-site scripting
8. INSECURE DESERIALIZATION — Pickle, YAML.load, JSON with eval
9. VULNERABLE COMPONENTS — Known vulnerable libraries, outdated dependencies
10. INSUFFICIENT LOGGING — Missing audit trail, no intrusion detection
11. HARDCODED SECRETS — API keys, passwords, tokens in source code
12. CRYPTOGRAPHY — Weak algorithms (MD5, SHA1, DES), hardcoded IV/salt, ECB mode
13. RACE CONDITIONS — TOCTOU, thread-unsafe operations on shared state
14. PROTOTYPE POLLUTION (JS/TS) — Unsafe object merging, __proto__ manipulation
15. PATH TRAVERSAL — ../../../etc/passwd, zipslip

SEVERITY GUIDELINES:
- critical: exploitable remotely, data breach, RCE, auth bypass
- high: significant data exposure, privilege escalation, probable exploit
- medium: requires specific conditions, limited impact
- low: defense-in-depth concerns, minor info disclosure

CVSS SCORING: estimate the CVSS v3 base score (0.0–10.0)

OWASP MAPPING: map to "A01:2021", "A02:2021", etc.

RESPOND WITH VALID JSON ONLY:
{
  "vulnerabilities": [
    {
      "file_path": "path/to/file.py",
      "line_start": 42,
      "line_end": 45,
      "severity": "critical|high|medium|low",
      "title": "Short vulnerability title",
      "description": "Detailed explanation of the vulnerability and attack scenario",
      "remediation": "Specific, actionable remediation steps with code examples",
      "owasp_category": "A01:2021 - Broken Access Control",
      "cve_id": "CVE-2021-XXXXX or null",
      "cvss_score": 9.1,
      "exploit_likelihood": 0.85,
      "code_snippet": "the vulnerable code"
    }
  ],
  "security_summary": "Overall security posture assessment"
}
"""

# ── Static signature patterns ──────────────────────────────────────────────────
SECURITY_PATTERNS = [
    # SQL Injection
    (r'(?i)execute\s*\(\s*["\'].*%[s\d]|f["\'].*SELECT.*{',
     "SQL Injection via string formatting", "A03:2021", Severity.CRITICAL, 9.8,
     "Use parameterised queries / ORM. Never format SQL with user input.", "CWE-89"),

    # Command Injection
    (r'(?i)(os\.system|subprocess\.call|subprocess\.run|eval|exec)\s*\(\s*[^,\)]*\+',
     "Potential command/code injection", "A03:2021", Severity.CRITICAL, 9.0,
     "Never pass user-controlled input to os.system/eval/exec. Use subprocess with list args.", "CWE-78"),

    # Hardcoded secrets
    (r'(?i)(api_key|secret_key|password|passwd|token|auth_token|access_token)\s*=\s*["\'][A-Za-z0-9+/=_\-]{8,}["\']',
     "Hardcoded secret/credential detected", "A02:2021", Severity.CRITICAL, 9.1,
     "Store secrets in environment variables or a secrets manager (Vault, AWS SSM, etc.).", "CWE-798"),

    # Weak crypto
    (r'(?i)(md5|sha1)\s*\(',
     "Weak cryptographic hash function", "A02:2021", Severity.HIGH, 7.5,
     "Replace MD5/SHA1 with SHA-256, SHA-3, or bcrypt/argon2 for passwords.", "CWE-327"),

    # Python pickle
    (r'pickle\.loads?\s*\(',
     "Insecure deserialization with pickle", "A08:2021", Severity.CRITICAL, 9.8,
     "Never deserialise untrusted data with pickle. Use JSON or signed serialisation.", "CWE-502"),

    # PyYAML unsafe load
    (r'yaml\.load\s*\([^,)]+\)(?!\s*,\s*Loader)',
     "Unsafe YAML load() without Loader", "A08:2021", Severity.HIGH, 8.1,
     "Use yaml.safe_load() or yaml.load(data, Loader=yaml.SafeLoader).", "CWE-502"),

    # Path traversal
    (r'open\s*\([^)]*\+[^)]*\)',
     "Potential path traversal in file open", "A01:2021", Severity.HIGH, 7.8,
     "Validate and sanitise file paths. Use pathlib.Path.resolve() and check against allowed root.", "CWE-22"),

    # SQL with f-string
    (r'(?i)f["\'].*\b(SELECT|INSERT|UPDATE|DELETE|DROP)\b',
     "SQL query constructed with f-string", "A03:2021", Severity.CRITICAL, 9.8,
     "Use parameterised queries: cursor.execute('SELECT * FROM t WHERE id = %s', (user_id,))", "CWE-89"),

    # Debug mode
    (r'(?i)(DEBUG\s*=\s*True|app\.run\(.*debug\s*=\s*True)',
     "Debug mode enabled in production code", "A05:2021", Severity.HIGH, 7.2,
     "Disable debug mode in production. Use environment variables for config.", "CWE-215"),

    # CORS wildcard
    (r'(?i)(allow_origins\s*=\s*\[?\s*["\'\*]["\']|Access-Control-Allow-Origin.*\*)',
     "CORS wildcard allows all origins", "A05:2021", Severity.MEDIUM, 6.5,
     "Restrict CORS to specific trusted origins. Never use * in production with credentials.", "CWE-942"),

    # JWT none algorithm
    (r'(?i)(algorithm\s*=\s*["\']none["\']|alg.*none)',
     "JWT 'none' algorithm vulnerability", "A02:2021", Severity.CRITICAL, 9.8,
     "Never accept 'none' as JWT algorithm. Whitelist allowed algorithms explicitly.", "CWE-347"),

    # eval with user input (JS)
    (r'\beval\s*\(',
     "Use of eval() — potential code injection", "A03:2021", Severity.HIGH, 8.0,
     "Remove eval(). Use JSON.parse() for JSON, or refactor to avoid dynamic code execution.", "CWE-95"),

    # Prototype pollution (JS)
    (r'(?i)\b__proto__\b|\bObject\.assign\s*\(\s*target.*src\b',
     "Potential prototype pollution", "A08:2021", Severity.HIGH, 7.8,
     "Validate object keys to exclude '__proto__', 'constructor', 'prototype' before merging.", "CWE-1321"),

    # Random for security
    (r'(?i)\brandom\b(?!\.seed|_state).*(?:token|key|secret|nonce|salt|password)',
     "Insecure random number generator used for security material", "A02:2021", Severity.HIGH, 7.5,
     "Use secrets.token_bytes() / secrets.token_hex() (Python) or crypto.getRandomValues() (JS).", "CWE-330"),
]


class SecurityScannerAgent(BaseAgent):
    """OWASP + CVE security scanner with LLM deep-dive + static pattern matching."""

    name = "security_scanner"
    description = "Security vulnerability scanner — OWASP Top 10, injection, secrets, CVEs"
    emoji = "🛡️"

    async def run(self, state: SynapseState) -> dict:
        if not state.request.enable_security:
            return {}

        state.mark_agent_start("security_scanner")
        await self._emit_start(state)

        all_vulns: List[SecurityVulnerability] = list(state.vulnerabilities)

        try:
            total = len(state.files)
            for idx, file_ctx in enumerate(state.files):
                progress = (idx / max(total, 1)) * 0.9
                await self._emit_progress(state, progress, f"Scanning {file_ctx.path}…")

                # Fast static pattern scan
                static_vulns = self._static_scan(file_ctx)
                all_vulns.extend(static_vulns)

                # Deep LLM security analysis
                llm_vulns = await self._llm_security_scan(file_ctx)
                all_vulns.extend(llm_vulns)

            await self._emit_progress(state, 1.0, "Security scan complete")
            state.mark_agent_done("security_scanner", 0)
            await self._emit_complete(state, f"Found {len(all_vulns)} security vulnerabilities")
            return {"vulnerabilities": all_vulns, "agent_states": state.agent_states}

        except Exception as exc:
            err = str(exc)
            self.logger.error("SecurityScanner failed", error=err)
            state.mark_agent_error("security_scanner", err)
            await self._emit_error(state, err)
            return {"vulnerabilities": all_vulns, "agent_states": state.agent_states}

    def _static_scan(self, file_ctx: FileContext) -> List[SecurityVulnerability]:
        """Fast regex-based vulnerability detection."""
        vulns: List[SecurityVulnerability] = []
        lines = file_ctx.content.splitlines()

        for line_no, line in enumerate(lines, start=1):
            for pattern, title, owasp, severity, cvss, remediation, cwe_id in SECURITY_PATTERNS:
                if re.search(pattern, line):
                    vulns.append(SecurityVulnerability(
                        id=str(uuid.uuid4())[:8],
                        file_path=file_ctx.path,
                        line_start=line_no,
                        severity=severity,
                        title=title,
                        description=f"Detected on line {line_no}. Code: `{line.strip()[:100]}`",
                        remediation=remediation,
                        owasp_category=owasp,
                        cvss_score=cvss,
                        exploit_likelihood=0.75,
                        code_snippet=line.strip()[:120],
                    ))

        return vulns

    async def _llm_security_scan(self, file_ctx: FileContext) -> List[SecurityVulnerability]:
        """Deep AI-powered security audit."""
        code = self._truncate_code(file_ctx.content, max_lines=200)
        messages = [
            {"role": "system", "content": SECURITY_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Security audit for {file_ctx.language} file: {file_ctx.path}\n\n"
                    f"```{file_ctx.language}\n{code}\n```\n\n"
                    "Report ONLY genuine vulnerabilities. Respond with JSON only."
                ),
            },
        ]

        try:
            response, tokens = await self.llm.chat(messages, max_tokens=2500)
            parsed = self._extract_json_block(response) or {}
            raw = parsed.get("vulnerabilities", [])

            vulns = []
            for r in raw:
                try:
                    vuln = SecurityVulnerability(
                        id=str(uuid.uuid4())[:8],
                        file_path=r.get("file_path", file_ctx.path),
                        line_start=int(r.get("line_start", 1)),
                        line_end=r.get("line_end"),
                        severity=Severity(r.get("severity", "medium")),
                        title=r.get("title", "Security issue"),
                        description=r.get("description", ""),
                        remediation=r.get("remediation", ""),
                        owasp_category=r.get("owasp_category"),
                        cve_id=r.get("cve_id"),
                        cvss_score=r.get("cvss_score"),
                        exploit_likelihood=float(r.get("exploit_likelihood", 0.5)),
                        code_snippet=r.get("code_snippet"),
                    )
                    vulns.append(vuln)
                except Exception:
                    continue
            return vulns
        except Exception as exc:
            self.logger.warning("LLM security scan failed", file=file_ctx.path, error=str(exc))
            return []
