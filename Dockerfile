FROM postgres:15

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        postgresql-contrib \
        postgresql-15-pgvector \
        postgresql-15-postgis \
    && rm -rf /var/lib/apt/lists/*
