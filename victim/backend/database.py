"""
database.py — Motor async client + collection accessors.
All collections are now case-scoped (fragments, conversations, cache).
Global collections (testimonies, evidence, documents) remain shared.
"""
from motor.motor_asyncio import AsyncIOMotorClient
from config import (
    MONGO_URI,
    MONGO_DB_NAME,
    COLLECTION_FRAGMENTS,
    COLLECTION_TESTIMONIES,
    COLLECTION_EVIDENCE,
    COLLECTION_CONVERSATIONS,
    COLLECTION_DOCUMENTS,
    COLLECTION_USERS,
    COLLECTION_MEDIA_UPLOADS,
    COLLECTION_SHARED_LINKS,
    COLLECTION_COMMUNITY_STORIES,
)

client   = AsyncIOMotorClient(MONGO_URI)
database = client[MONGO_DB_NAME]

# ── Global / shared collections ───────────────────────────────────────────────
testimony_collection    = database.get_collection(COLLECTION_TESTIMONIES)
evidence_collection     = database.get_collection(COLLECTION_EVIDENCE)
document_collection     = database.get_collection(COLLECTION_DOCUMENTS)
user_collection         = database.get_collection(COLLECTION_USERS)
media_upload_collection = database.get_collection(COLLECTION_MEDIA_UPLOADS)
shared_links_collection = database.get_collection(COLLECTION_SHARED_LINKS)
community_stories_collection = database.get_collection(COLLECTION_COMMUNITY_STORIES)

# ── Default (legacy / no-case) collections ────────────────────────────────────
fragment_collection     = database.get_collection(COLLECTION_FRAGMENTS)
conversation_collection = database.get_collection(COLLECTION_CONVERSATIONS)


# ── Case-scoped collection helpers ────────────────────────────────────────────

def get_case_fragment_collection(case_id: str):
    """Returns the fragments collection namespaced to a specific case."""
    return database.get_collection(f"fragments_{case_id}")


def get_case_conversation_collection(case_id: str):
    """Returns the conversations collection namespaced to a specific case."""
    return database.get_collection(f"conversations_{case_id}")


def get_case_cache_collection(case_id: str):
    """Returns the cache collection namespaced to a specific case."""
    return database.get_collection(f"cache_{case_id}")


# ── Serialisers ───────────────────────────────────────────────────────────────

def fragment_helper(fragment) -> dict:
    """Serialize a raw MongoDB fragment document to a clean API dict."""
    return {
        "id":                str(fragment["_id"]),
        "type":              fragment["type"],
        "content":           fragment["content"],
        "timestamp":         fragment["timestamp"],
        "cluster":           fragment.get("cluster"),
        "position":          fragment.get("position", {"x": 50, "y": 50}),
        "has_evidence":      fragment.get("has_evidence", False),
        "original_text":     fragment.get("original_text", ""),
        "original_language": fragment.get("original_language", "en"),
        "linked_evidence":   fragment.get("linked_evidence", []),
    }


async def get_community_stories(category: str = "all"):
    """Fetches stories, optionally filtered by category."""
    query = {}
    if category != "all":
        query["category"] = category
    
    cursor = community_stories_collection.find(query).sort("_id", -1)
    stories = await cursor.to_list(length=100)
    return [story_helper(s) for s in stories]


async def add_community_story(alias: str, title: str, full_story: str, category: str, category_label: str, tags: list):
    """Adds a new community story to the database."""
    from utils import generate_anonymous_alias
    
    # Generate excerpt (first 150 chars)
    excerpt = (full_story[:150] + '...') if len(full_story) > 150 else full_story
    
    new_story = {
        "alias": alias or generate_anonymous_alias(),
        "avatar": (alias or "S")[0].upper(),
        "category": category,
        "categoryLabel": category_label,
        "title": title,
        "excerpt": excerpt,
        "fullStory": full_story,
        "tags": tags,
        "likes": 0,
        "replies": 0,
        "timeAgo": "Just now",
        "verified": False,
    }
    result = await community_stories_collection.insert_one(new_story)
    new_story["_id"] = result.inserted_id
    return story_helper(new_story)


async def like_community_story(story_id: str):
    """Increments the like count for a story."""
    from bson import ObjectId
    await community_stories_collection.update_one(
        {"_id": ObjectId(story_id)},
        {"$inc": {"likes": 1}}
    )
    story = await community_stories_collection.find_one({"_id": ObjectId(story_id)})
    return story_helper(story) if story else None


def testimony_helper(doc) -> dict:
    """Serialize a testimony/case document."""
    out = dict(doc)
    out["id"] = str(out.pop("_id"))
    for frag in out.get("fragments", []):
        if "_id" in frag:
            frag["id"] = str(frag.pop("_id"))
    return out


def story_helper(story) -> dict:
    """Serialize a community story document."""
    return {
        "id":            str(story["_id"]),
        "alias":         story["alias"],
        "avatar":        story.get("avatar", ""),
        "category":      story["category"],
        "categoryLabel": story.get("categoryLabel", ""),
        "title":         story["title"],
        "excerpt":       story.get("excerpt", ""),
        "fullStory":     story["fullStory"],
        "tags":          story.get("tags", []),
        "likes":         story.get("likes", 0),
        "replies":       story.get("replies", 0),
        "timeAgo":       story.get("timeAgo", "Just now"),
        "verified":      story.get("verified", False),
    }