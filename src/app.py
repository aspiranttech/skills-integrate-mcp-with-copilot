"""
High School Management System API

A simple FastAPI application for viewing, filtering, and managing
extracurricular activities at Mergington High School.
"""

import json
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parent
ACTIVITIES_PATH = BASE_DIR / "activities.json"
TEACHERS_PATH = BASE_DIR / "teachers.json"


def _load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


activities = _load_json(ACTIVITIES_PATH)
teachers = _load_json(TEACHERS_PATH).get("teachers", {})


def _is_teacher(username: str = None, password: str = None) -> bool:
    if not username or not password:
        return False
    return teachers.get(username) == password


app = FastAPI(
    title="Mergington High School API",
    description="API for viewing and signing up for extracurricular activities",
)

app.mount(
    "/static",
    StaticFiles(directory=str(BASE_DIR / "static")),
    name="static",
)


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


@app.get("/activities")
def get_activities(
    category: str = None,
    search: str = None,
    sort: str = "name",
    order: str = "asc",
):
    """Return the activities list, optionally filtered and sorted."""
    results = {}
    for name, details in activities.items():
        details_obj = dict(details)
        details_obj["name"] = name

        if category and category.lower() != "all":
            if str(details.get("category", "")).lower() != category.lower():
                continue

        if search:
            search_term = search.lower()
            haystack = " ".join(
                [
                    name,
                    details.get("description", ""),
                    details.get("schedule", ""),
                    details.get("category", ""),
                ]
            ).lower()
            if search_term not in haystack:
                continue

        results[name] = details_obj

    if sort == "participants":
        results = dict(
            sorted(
                results.items(),
                key=lambda item: len(item[1].get("participants", [])),
                reverse=(order.lower() == "desc"),
            )
        )
    elif sort in {"name", "activity"}:
        results = dict(
            sorted(
                results.items(),
                key=lambda item: item[0].lower(),
                reverse=(order.lower() == "desc"),
            )
        )
    elif sort == "date":
        results = dict(
            sorted(
                results.items(),
                key=lambda item: item[1].get("date", ""),
                reverse=(order.lower() == "desc"),
            )
        )
    elif sort == "time":
        results = dict(
            sorted(
                results.items(),
                key=lambda item: item[1].get("schedule", ""),
                reverse=(order.lower() == "desc"),
            )
        )

    return results


@app.post("/activities/{activity_name}/signup")
async def signup_for_activity(
    activity_name: str,
    email: str = None,
    request: Request = None,
    x_teacher_username: str = Header(default=None, alias="x-teacher-username"),
    x_teacher_password: str = Header(default=None, alias="x-teacher-password"),
):
    """Sign up a student for an activity.

    Teacher credentials are accepted for admin flows, but legacy student signups
    continue to work when no admin headers are provided.
    """
    if email is None and request is not None:
        payload = await request.json()
        email = payload.get("email") if isinstance(payload, dict) else None

    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    if x_teacher_username or x_teacher_password:
        if not _is_teacher(x_teacher_username, x_teacher_password):
            raise HTTPException(status_code=403, detail="Invalid teacher credentials")

    activity = activities[activity_name]

    if email in activity["participants"]:
        raise HTTPException(status_code=400, detail="Student is already signed up")

    if len(activity["participants"]) >= activity["max_participants"]:
        raise HTTPException(status_code=400, detail="Activity is full")

    activity["participants"].append(email)
    return {"message": f"Signed up {email} for {activity_name}"}


@app.delete("/activities/{activity_name}/unregister")
async def unregister_from_activity(
    activity_name: str,
    email: str = None,
    request: Request = None,
    x_teacher_username: str = Header(default=None, alias="x-teacher-username"),
    x_teacher_password: str = Header(default=None, alias="x-teacher-password"),
):
    """Unregister a student from an activity."""
    if email is None and request is not None:
        payload = await request.json()
        email = payload.get("email") if isinstance(payload, dict) else None

    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    if x_teacher_username or x_teacher_password:
        if not _is_teacher(x_teacher_username, x_teacher_password):
            raise HTTPException(status_code=403, detail="Invalid teacher credentials")

    activity = activities[activity_name]

    if email not in activity["participants"]:
        raise HTTPException(status_code=400, detail="Student is not signed up for this activity")

    activity["participants"].remove(email)
    return {"message": f"Unregistered {email} from {activity_name}"}
