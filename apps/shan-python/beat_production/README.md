# Beat Production (Flask MVP)

## Run app

```bash
cd beat_production
python -m app.main
```

## Seed demo data

```bash
cd beat_production
python -m app.seed
```

## Migration file

An initial Alembic-style migration is included at:

- `migrations/versions/20260305_0001_initial_schema.py`

If you initialize full Alembic/Flask-Migrate tooling later, use this revision as the baseline schema reference.
