# Aura — Python triage engine (stateless FastAPI on :8000)
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

<<<<<<< Updated upstream
COPY main.py models.py prompt.py llm.py tts.py config.py fairness.py triage_dataset.json ./
=======
COPY main.py models.py prompt.py llm.py config.py tts.py triage_dataset.json ./
>>>>>>> Stashed changes

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
