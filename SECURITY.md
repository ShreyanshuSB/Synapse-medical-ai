# Security Policy

## Medical Research & Decision-Support Prototype Notice

**PulmoScan AI is an investigational research and educational decision-support prototype.** It is not certified, cleared, or approved by the U.S. FDA, European Medicines Agency (EMA), or any other regulatory body as a medical device or diagnostic system.

- **No Clinical Deployment:** This software is not intended, tested, or certified for production clinical hospital environments, primary diagnosis, or acute patient management.
- **Do Not Upload Real Patient or Protected Health Information (PHI):** Do not ingest, upload, or process real clinical patient records, HIPAA-regulated Protected Health Information (PHI), or identifiable DICOM studies containing real patient identifiers with this prototype.
- **Synthetic & De-Identified Demo Data:** All demo cases, patient identifiers, demographic information, and sample imaging studies provided within this repository are synthetic, de-identified, or generated for demonstration and research purposes only.
- **No Enterprise SLA:** This repository does not provide an enterprise security SLA, 24/7 incident response guarantees, or regulatory HIPAA/GDPR business associate agreements (BAAs).

---

## Environment Variables & API Key Handling

- **Local Secrets:** All API keys (such as Google Gemini API keys), database credentials, and local configuration must be supplied exclusively through local environment variables (e.g., in a local `.env` or `.env.local` file).
- **Never Commit Secrets:** Never commit `.env`, `.env.local`, API keys, tokens, or credential files to version control. The repository's `.gitignore` is configured to prevent committing these files.
- **External Cloud AI Calls:** When configured with a `GEMINI_API_KEY`, structured radiomics parameters and prompt texts are transmitted over HTTPS to Google's Gemini API endpoints. When no key is configured, the application functions strictly locally with deterministic fallbacks. Users must review Google Cloud's data governance policies before transmitting any data to external cloud services.

---

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

---

## Reporting a Vulnerability

If you discover a security vulnerability or sensitive data exposure issue in this project:

1. **Do not open a public issue.** Please do not publish security vulnerability details publicly on GitHub.
2. **Private Disclosure:** Report the vulnerability privately via **GitHub Security Advisories** on the repository page:
   - Navigate to [https://github.com/ShreyanshuSB/Synapse-medical-ai/security/advisories](https://github.com/ShreyanshuSB/Synapse-medical-ai/security/advisories)
   - Click "New draft advisory" to share findings securely.
   - Alternatively, contact the maintainers directly through their GitHub profile.
3. **Information to Include:**
   - Description of the vulnerability or risk
   - Steps to reproduce or proof-of-concept
   - Potential impact
4. **Resolution:** Maintainers will review the report in good faith, validate the findings, and apply appropriate patches in an open-source development timeframe.
