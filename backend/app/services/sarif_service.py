"""
SYNAPSE — DevSecOps SARIF v2.1.0 & PR Markdown Exporter
Converts SYNAPSE multi-agent review findings into standard OASIS SARIF format
compatible with GitHub Advanced Security Code Scanning, GitLab SAST, and CI/CD pipelines.
"""
from __future__ import annotations

from typing import Any, Dict, List
from app.schemas import ReviewResponse, Severity


class SarifService:
    """Generates standard SARIF v2.1.0 and rich Markdown summaries."""

    @classmethod
    def generate_sarif(cls, review: ReviewResponse) -> Dict[str, Any]:
        """Convert a SYNAPSE ReviewResponse into an OASIS SARIF v2.1.0 JSON document."""
        rules: Dict[str, Dict[str, Any]] = {}
        results: List[Dict[str, Any]] = []

        # 1. Process Code Issues
        for issue in review.issues:
            rule_id = issue.rule_id or f"SYNAPSE-{issue.category.upper()}-{issue.id}"
            if rule_id not in rules:
                rules[rule_id] = {
                    "id": rule_id,
                    "name": issue.title,
                    "shortDescription": {"text": issue.title},
                    "fullDescription": {"text": issue.description},
                    "defaultConfiguration": {
                        "level": cls._severity_to_sarif_level(issue.severity)
                    },
                    "properties": {
                        "category": issue.category,
                        "tags": ["quality", issue.category],
                    },
                }

            result = {
                "ruleId": rule_id,
                "level": cls._severity_to_sarif_level(issue.severity),
                "message": {"text": f"{issue.title}: {issue.description}\nSuggestion: {issue.suggestion}"},
                "locations": [
                    {
                        "physicalLocation": {
                            "artifactLocation": {"uri": issue.file_path, "uriBaseId": "%SRCROOT%"},
                            "region": {
                                "startLine": max(1, issue.line_start),
                                "endLine": max(1, issue.line_end or issue.line_start),
                            },
                        }
                    }
                ],
            }
            results.append(result)

        # 2. Process Security Vulnerabilities
        for vuln in review.vulnerabilities:
            rule_id = vuln.cve_id or (
                vuln.owasp_category.split(" - ")[0].replace(":", "_").replace(" ", "_")
                if vuln.owasp_category
                else f"SYNAPSE-SEC-{vuln.id}"
            )
            if rule_id not in rules:
                rules[rule_id] = {
                    "id": rule_id,
                    "name": vuln.title,
                    "shortDescription": {"text": vuln.title},
                    "fullDescription": {"text": vuln.description},
                    "help": {"text": f"Remediation: {vuln.remediation}"},
                    "defaultConfiguration": {
                        "level": cls._severity_to_sarif_level(vuln.severity)
                    },
                    "properties": {
                        "security-severity": str(vuln.cvss_score) if vuln.cvss_score else "7.5",
                        "tags": ["security", vuln.owasp_category or "vulnerability"],
                    },
                }

            result = {
                "ruleId": rule_id,
                "level": cls._severity_to_sarif_level(vuln.severity),
                "message": {
                    "text": (
                        f"[SECURITY] {vuln.title} ({vuln.owasp_category or 'OWASP'})\n"
                        f"{vuln.description}\nRemediation: {vuln.remediation}"
                    )
                },
                "locations": [
                    {
                        "physicalLocation": {
                            "artifactLocation": {"uri": vuln.file_path, "uriBaseId": "%SRCROOT%"},
                            "region": {
                                "startLine": max(1, vuln.line_start),
                                "endLine": max(1, vuln.line_end or vuln.line_start),
                            },
                        }
                    }
                ],
            }
            results.append(result)

        sarif_doc = {
            "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
            "version": "2.1.0",
            "runs": [
                {
                    "tool": {
                        "driver": {
                            "name": "SYNAPSE",
                            "version": "2.12.0",
                            "informationUri": "https://github.com/bharathvk75/SYNAPSE",
                            "rules": list(rules.values()),
                        }
                    },
                    "results": results,
                }
            ],
        }
        return sarif_doc

    @classmethod
    def generate_pr_markdown(cls, review: ReviewResponse) -> str:
        """Produce GitHub PR comment markdown with badges, executive summary, and diffs."""
        summary = review.summary
        impact = review.impact_assessment

        score_emoji = "🟢" if summary.overall_score >= 8 else ("🟡" if summary.overall_score >= 5 else "🔴")
        risk_badge = {
            "low": "https://img.shields.io/badge/Risk-LOW-success",
            "medium": "https://img.shields.io/badge/Risk-MEDIUM-yellow",
            "high": "https://img.shields.io/badge/Risk-HIGH-orange",
            "critical": "https://img.shields.io/badge/Risk-CRITICAL-red",
        }.get(summary.risk_level.lower(), "https://img.shields.io/badge/Risk-UNKNOWN-lightgrey")

        md = []
        md.append(f"## {score_emoji} SYNAPSE v2.12 — Automated Code Review")
        md.append("")
        md.append(f"![Risk]({risk_badge}) ![Score](https://img.shields.io/badge/Score-{summary.overall_score}%2F10-blue) ![Agents](https://img.shields.io/badge/Agents-6%20Active-purple)")
        md.append("")

        if review.hermes_narrative:
            md.append("### 🧠 Hermes Orchestrator Verdict")
            md.append(f"> {review.hermes_narrative.strip()}")
            md.append("")

        # Metrics Table
        md.append("### 📊 Review Summary")
        md.append("| Metric | Count / Value |")
        md.append("|---|---|")
        md.append(f"| **Overall Health Score** | **{summary.overall_score}/10** |")
        md.append(f"| **Security Vulnerabilities** | **{summary.security_vulnerabilities}** ({summary.critical_issues} critical) |")
        md.append(f"| **Code Quality Issues** | **{summary.total_issues}** |")
        md.append(f"| **Automated Fixes Ready** | **{len(review.fix_suggestions)}** |")
        md.append(f"| **Test Suites Suggested** | **{len(review.test_suggestions)}** |")
        if impact:
            md.append(f"| **Architectural Blast Radius** | **{impact.blast_radius_score}/100** ({impact.risk_level.upper()}) |")
        md.append("")

        # Architectural & Blast Radius Section
        if impact:
            md.append("### 💥 Blast Radius & System Impact")
            md.append(f"- **Breaking API Contracts:** {'⚠️ Yes' if impact.breaking_change_risk else '✅ None detected'}")
            md.append(f"- **Database Assessment:** {impact.database_impact}")
            md.append(f"- **Performance Footprint:** {impact.performance_impact}")
            if impact.architectural_recommendations:
                md.append("- **Recommendations:**")
                for rec in impact.architectural_recommendations:
                    md.append(f"  - {rec}")
            md.append("")

        # Security Findings
        if review.vulnerabilities:
            md.append("### 🛡️ Critical Security Vulnerabilities")
            for idx, vuln in enumerate(review.vulnerabilities, 1):
                md.append(f"<details><summary><b>#{idx} [{vuln.severity.value.upper()}] {vuln.title}</b> (<code>{vuln.file_path}:{vuln.line_start}</code>)</summary>")
                md.append("")
                md.append(f"- **OWASP Category:** {vuln.owasp_category or 'N/A'}")
                md.append(f"- **CVSS:** {vuln.cvss_score or 'N/A'} | Exploit Likelihood: {int(vuln.exploit_likelihood * 100)}%")
                md.append(f"- **Description:** {vuln.description}")
                md.append(f"- **Remediation:** {vuln.remediation}")
                if vuln.code_snippet:
                    md.append(f"```\n{vuln.code_snippet}\n```")
                md.append("</details>")
                md.append("")

        # Automated Fixes
        if review.fix_suggestions:
            md.append("### 🔧 Automated Fix Suggestions (AST-Verified)")
            for idx, fix in enumerate(review.fix_suggestions, 1):
                badge = "✅ AST Verified" if fix.ast_valid else "⚠️ Review Needed"
                md.append(f"<details><summary><b>Fix #{idx} for <code>{fix.file_path}</code></b> — {badge}</summary>")
                md.append("")
                md.append(f"**Explanation:** {fix.explanation}")
                if fix.verification_notes:
                    md.append(f"**Verification:** _{fix.verification_notes}_")
                md.append(f"```diff\n{fix.diff}\n```")
                md.append("</details>")
                md.append("")

        # Footer
        md.append("---")
        md.append(f"*Reviewed autonomously by [SYNAPSE v2.12](https://github.com/bharathvk75/SYNAPSE) • Session ID: `{review.session_id}`*")
        return "\n".join(md)

    @staticmethod
    def _severity_to_sarif_level(severity: Severity) -> str:
        s = severity.value.lower() if hasattr(severity, "value") else str(severity).lower()
        if s in ("critical", "high"):
            return "error"
        elif s == "medium":
            return "warning"
        return "note"


sarif_service = SarifService()
