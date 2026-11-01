# Persistent JSON storage

Runtime files are created here from `seeds/` on first start. In production set `DATA_DIR` to a persistent mounted volume, not the application deployment directory.

This directory contains customer personal data, order receipt secret, admin session hashes and private backups. Never serve it as static files, commit it, or put it inside `public/`. Only the server APIs access it. Use owner-only permissions and encrypted off-server backups.
