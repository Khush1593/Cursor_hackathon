# Aura — Python triage engine (stateless FastAPI on :8000)
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# All runtime modules (fairness, guardrails, shortcuts) — keep in sync with main.py imports
COPY main.py models.py prompt.py llm.py tts.py config.py fairness.py guardrails.py triage_shortcuts.py triage_dataset.json ./

EXPOSE 8000

# Prefer $PORT (Render); fall back to 8000 locally
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import os,urllib.request; p=os.environ.get('PORT','8000'); urllib.request.urlopen(f'http://127.0.0.1:{p}/health')"

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
