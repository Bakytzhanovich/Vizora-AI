"""Work & Travel job offer resale board.

A student who can't go lists their offer; other students contact them
directly. Vizora takes only a listing fee, invoiced by hand through Kaspi
like plan payments in manual mode, and never handles the offer money: holding
it would make us liable for every transfer the employer or sponsor refuses.
"""

import re
from datetime import date, datetime
from decimal import Decimal

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.job_offer import JobOffer, JobOfferReport
from app.models.user import User
from app.services.push_service import notify_admins
from routers.payments import normalize_kz_phone

router = APIRouter(prefix="/offers", tags=["offers"])

LISTING_FEE_KZT = 3000
LISTING_DAYS = 30
REPORTS_TO_HIDE = 3
MAX_OPEN_LISTINGS = 3
MAX_PROOF_BYTES = 3 * 1024 * 1024

# Sniffed from the file itself: the browser-sent content type is whatever the
# client says, and the owner opens these files in the admin panel.
_PROOF_SIGNATURES = (
    (b"%PDF", "application/pdf"),
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
)


def _sniff_proof_type(head: bytes) -> str | None:
    for sig, mime in _PROOF_SIGNATURES:
        if head.startswith(sig):
            return mime
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp"
    return None


def normalize_contact(v: str) -> str:
    """A Telegram @username or a Kazakhstan phone (shown as a WhatsApp link)."""
    v = v.strip()
    tg = re.fullmatch(r"(?:https?://)?(?:t\.me/|@)([A-Za-z0-9_]{5,32})", v)
    if tg:
        return "@" + tg.group(1)
    try:
        return normalize_kz_phone(v)
    except ValueError:
        raise HTTPException(status_code=422, detail="Contact must be a Telegram @username or a Kazakhstan phone")


def offer_out(o: JobOffer) -> dict:
    return {
        "id": o.id,
        "employer": o.employer,
        "position": o.position,
        "state": o.state,
        "city": o.city,
        "start_date": o.start_date,
        "end_date": o.end_date,
        "hourly_wage": float(o.hourly_wage),
        "hours_per_week": o.hours_per_week,
        "housing": o.housing,
        "sponsor": o.sponsor,
        "agency": o.agency,
        "description": o.description,
        "price_kzt": o.price_kzt,
        "contact": o.contact,
        "published_at": o.published_at,
        "expires_at": o.expires_at,
    }


def _is_live(o: JobOffer) -> bool:
    return o.status == "published" and o.expires_at is not None and o.expires_at > datetime.utcnow()


@router.get("")
async def list_offers(
    state: str | None = Query(None, max_length=40),
    q: str | None = Query(None, max_length=80),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(JobOffer)
        .where(JobOffer.status == "published", JobOffer.expires_at > datetime.utcnow())
        .order_by(JobOffer.published_at.desc())
        .limit(100)
    )
    if state:
        query = query.where(JobOffer.state == state)
    if q:
        like = f"%{q.strip()}%"
        query = query.where(or_(JobOffer.position.ilike(like), JobOffer.employer.ilike(like), JobOffer.city.ilike(like)))
    offers = (await db.scalars(query)).all()
    return {
        "offers": [{**offer_out(o), "is_mine": o.user_id == user_id} for o in offers],
        "listing_fee_kzt": LISTING_FEE_KZT,
        "listing_days": LISTING_DAYS,
    }


@router.get("/mine")
async def my_offers(user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    offers = (
        await db.scalars(select(JobOffer).where(JobOffer.user_id == user_id).order_by(JobOffer.created_at.desc()))
    ).all()
    return {
        "offers": [
            {
                **offer_out(o),
                # An expired listing is still "published" in the table; the seller sees it as expired.
                "status": "expired" if o.status == "published" and not _is_live(o) else o.status,
                "reject_reason": o.reject_reason,
                "listing_fee": o.listing_fee,
                "phone": o.phone,
                "created_at": o.created_at,
            }
            for o in offers
        ]
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_offer(
    background_tasks: BackgroundTasks,
    employer: str = Form(..., min_length=2, max_length=120),
    position: str = Form(..., min_length=2, max_length=120),
    state: str = Form(..., min_length=2, max_length=40),
    city: str = Form(..., min_length=2, max_length=80),
    start_date: date = Form(...),
    end_date: date = Form(...),
    hourly_wage: Decimal = Form(..., gt=0, le=100),
    hours_per_week: int = Form(..., gt=0, le=80),
    sponsor: str = Form(..., min_length=2, max_length=120),
    price_kzt: int = Form(..., ge=0, le=10_000_000),
    contact: str = Form(..., max_length=100),
    phone: str = Form(..., max_length=30),
    housing: str | None = Form(None, max_length=200),
    agency: str | None = Form(None, max_length=120),
    description: str | None = Form(None, max_length=2000),
    proof: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    if end_date <= start_date:
        raise HTTPException(status_code=422, detail="end_date must be after start_date")
    try:
        phone = normalize_kz_phone(phone)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    contact = normalize_contact(contact)

    data = await proof.read(MAX_PROOF_BYTES + 1)
    if len(data) > MAX_PROOF_BYTES:
        raise HTTPException(status_code=413, detail="Proof file is larger than 3 MB")
    proof_type = _sniff_proof_type(data[:16])
    if not proof_type:
        raise HTTPException(status_code=415, detail="Proof must be a PDF, JPG, PNG or WEBP")

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    open_count = await db.scalar(
        select(func.count()).select_from(JobOffer).where(
            JobOffer.user_id == user_id, JobOffer.status.in_(("pending", "published", "hidden"))
        )
    )
    if open_count >= MAX_OPEN_LISTINGS:
        raise HTTPException(status_code=409, detail="Too many open listings")

    offer = JobOffer(
        user_id=user_id, employer=employer.strip(), position=position.strip(), state=state.strip(),
        city=city.strip(), start_date=start_date, end_date=end_date, hourly_wage=hourly_wage,
        hours_per_week=hours_per_week, housing=(housing or "").strip() or None, sponsor=sponsor.strip(),
        agency=(agency or "").strip() or None, description=(description or "").strip() or None,
        price_kzt=price_kzt, contact=contact, proof=data, proof_type=proof_type, phone=phone,
        listing_fee=LISTING_FEE_KZT, status="pending", reports_count=0,
    )
    db.add(offer)
    await db.commit()
    background_tasks.add_task(
        notify_admins,
        "Новый оффер на проверку",
        f"{user.email} · {offer.position}, {offer.city} · счёт {LISTING_FEE_KZT} ₸ · +{phone}",
        "/admin/offers",
    )
    return {"id": offer.id, "status": offer.status, "listing_fee": LISTING_FEE_KZT, "phone": phone}


async def _get_own_offer(offer_id: str, user_id: str, db: AsyncSession) -> JobOffer:
    offer = await db.get(JobOffer, offer_id)
    if not offer or offer.user_id != user_id:
        raise HTTPException(status_code=404, detail="Offer not found")
    return offer


@router.post("/{offer_id}/sold")
async def mark_sold(offer_id: str, user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    offer = await _get_own_offer(offer_id, user_id, db)
    if offer.status not in ("published", "hidden"):
        raise HTTPException(status_code=409, detail=f"Offer is {offer.status}")
    offer.status = "sold"
    await db.commit()
    return {"status": "sold"}


@router.post("/{offer_id}/report")
async def report_offer(
    offer_id: str,
    background_tasks: BackgroundTasks,
    reason: str | None = Form(None, max_length=300),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    offer = await db.get(JobOffer, offer_id)
    if not offer or not _is_live(offer):
        raise HTTPException(status_code=404, detail="Offer not found")
    if offer.user_id == user_id:
        raise HTTPException(status_code=400, detail="Can't report your own offer")
    db.add(JobOfferReport(offer_id=offer_id, user_id=user_id, reason=(reason or "").strip() or None))
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        return {"status": "already_reported"}
    # Counted from the reports table, not incremented: two reports landing at
    # once would both read the same old counter.
    offer.reports_count = await db.scalar(
        select(func.count()).select_from(JobOfferReport).where(JobOfferReport.offer_id == offer_id)
    )
    if offer.reports_count >= REPORTS_TO_HIDE:
        offer.status = "hidden"
        background_tasks.add_task(
            notify_admins, "Оффер скрыт по жалобам", f"{offer.position}, {offer.city} · {offer.reports_count} жалобы", "/admin/offers"
        )
    await db.commit()
    return {"status": "reported"}
