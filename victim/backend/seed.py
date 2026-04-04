"""
seed.py — Populates the DB with starter data for local development.
Seed content is defined here as constants; connection config comes from config.py.
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from config import MONGO_URI, MONGO_DB_NAME

# ── Seed data (easy to extend without touching logic) ─────────────────────────

SEED_EVIDENCE = [
    {"name": "knife",  "type": "weapon"},
    {"name": "gun",    "type": "weapon"},
    {"name": "letter", "type": "document"},
]

SEED_TESTIMONIES = [
    {
        "title":   "Initial Statement by Rekha",
        "content": "I saw him running away from the village square at 9 PM. He was wearing a dark shirt.",
        "date":    "2023-10-14",
    },
    {
        "title":   "Follow-up Interview",
        "content": "The car was definitely a red sedan. It sped past me.",
        "date":    "2023-10-16",
    },
]


# ─────────────────────────────────────────────────────────────────────────────

async def seed():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[MONGO_DB_NAME]

    evidence_count = await db.evidence.count_documents({})
    if evidence_count == 0:
        print("Seeding evidence…")
        await db.evidence.insert_many(SEED_EVIDENCE)
    else:
        print(f"Evidence already present ({evidence_count} docs) — skipping.")

    testimony_count = await db.testimonies.count_documents({})
    if testimony_count == 0:
        print("Seeding testimonies…")
        await db.testimonies.insert_many(SEED_TESTIMONIES)
    else:
        print(f"Testimonies already present ({testimony_count} docs) — skipping.")

    print("Seeding complete.")


if __name__ == "__main__":
    asyncio.run(seed())
