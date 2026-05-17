from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps.auth import optional_auth_user
from app.models import Task, User
from app.schemas import TaskCreate, TaskRead, TaskUpdate
from app.services import create_task, delete_task, list_tasks, task_to_read, update_task

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _to_read(task: Task) -> TaskRead:
    return TaskRead(**task_to_read(task))


@router.get("", response_model=list[TaskRead])
def get_tasks(
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(optional_auth_user),
):
    return [_to_read(t) for t in list_tasks(db, user_id=user.id if user else None)]


@router.post("", response_model=TaskRead, status_code=201)
def post_task(
    data: TaskCreate,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(optional_auth_user),
):
    task = create_task(db, data, user_id=user.id if user else None)
    return _to_read(task)


@router.get("/{task_id}", response_model=TaskRead)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(optional_auth_user),
):
    task = db.get(Task, task_id)
    uid = user.id if user else None
    if not task or task.user_id != uid:
        raise HTTPException(404, "Task not found")
    return _to_read(task)


@router.patch("/{task_id}", response_model=TaskRead)
def patch_task(
    task_id: int,
    data: TaskUpdate,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(optional_auth_user),
):
    task = db.get(Task, task_id)
    uid = user.id if user else None
    if not task or task.user_id != uid:
        raise HTTPException(404, "Task not found")
    task = update_task(db, task, data)
    return _to_read(task)


@router.delete("/{task_id}", status_code=204)
def remove_task(
    task_id: int,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(optional_auth_user),
):
    task = db.get(Task, task_id)
    uid = user.id if user else None
    if not task or task.user_id != uid:
        raise HTTPException(404, "Task not found")
    delete_task(db, task)
