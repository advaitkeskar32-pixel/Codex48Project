"""FastAPI routes for the knowledge base, reviews and finding decisions.

Login / JWT roles are handled by the workflow module; plug its dependency in
where marked. Until then org_id is taken from the URL.
"""
from contextlib import asynccontextmanager
from datetime import date, datetime, timezone
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from . import review as review_service
from .ai import gemini
from .db import get_session, init_db
from .kb import ingest
from .models import (
    ApprovalAudit,
    BrandDocument,
    Comment,
    Fact,
    FindingRow,
    Organisation,
    Review,
    ReviewRevision,
    Term,
)
from .rules import contrast

@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    from .db import SessionLocal
    from .kit import load_kit

    session = SessionLocal()
    try:
        if session.query(Organisation).count() == 0:
            kit_path = Path(__file__).resolve().parent.parent / "sample_kit" / "northwind.json"
            load_kit(session, kit_path, embed=False)
    finally:
        session.close()
    yield


app = FastAPI(title="BrandGuard API", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

MAX_UPLOAD_BYTES = 10 * 1024 * 1024


@app.get("/health")
def health() -> dict:
    return {"ok": True, "ai_configured": gemini.is_configured()}


def _org_or_404(session: Session, org_id: int) -> Organisation:
    org = session.get(Organisation, org_id)
    if org is None:
        raise HTTPException(404, "Organisation not found")
    return org


# ---------- organisations ----------
class OrgIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    product_names: list[str] = []
    palette: list[str] = []


@app.post("/orgs")
def create_org(body: OrgIn, session: Session = Depends(get_session)) -> dict:
    org = Organisation(name=body.name, product_names=body.product_names, palette=body.palette)
    session.add(org)
    session.commit()
    return {"id": org.id}


@app.get("/orgs/{org_id}")
def get_org(org_id: int, session: Session = Depends(get_session)) -> dict:
    org = _org_or_404(session, org_id)
    return {
        "id": org.id,
        "name": org.name,
        "product_names": org.product_names or [],
        "palette": org.palette or [],
        "created_at": org.created_at.isoformat() if org.created_at else None,
    }


# ---------- knowledge base ----------
@app.post("/orgs/{org_id}/kb/documents")
async def upload_document(
    org_id: int,
    file: UploadFile = File(...),
    title: str = Form(""),
    kind: str = Form("guideline"),
    session: Session = Depends(get_session),
) -> dict:
    _org_or_404(session, org_id)
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File is larger than 10 MB")
    try:
        text = ingest.extract_text(file.filename or "", data)
        doc = ingest.add_document(session, org_id, title or file.filename or "Untitled", text, file.filename or "", kind)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    embedded = sum(1 for c in doc.chunks if c.embedding is not None)
    return {"id": doc.id, "passages": len(doc.chunks), "embedded": embedded}


@app.get("/orgs/{org_id}/kb/documents")
def list_documents(org_id: int, session: Session = Depends(get_session)) -> list[dict]:
    _org_or_404(session, org_id)
    docs = session.query(BrandDocument).filter(BrandDocument.org_id == org_id).all()
    return [{"id": d.id, "title": d.title, "kind": d.kind, "passages": len(d.chunks)} for d in docs]


@app.post("/orgs/{org_id}/kb/reembed")
def reembed(org_id: int, session: Session = Depends(get_session)) -> dict:
    _org_or_404(session, org_id)
    try:
        return {"embedded": ingest.reembed_missing(session, org_id)}
    except gemini.AIUnavailable as exc:
        raise HTTPException(503, str(exc))


class FactIn(BaseModel):
    key: str
    statement: str
    value: float | None = None
    unit: str = ""
    keywords: list[str] = []
    source: str = ""
    valid_from: date | None = None
    valid_to: date | None = None


@app.post("/orgs/{org_id}/kb/facts")
def add_fact(org_id: int, body: FactIn, session: Session = Depends(get_session)) -> dict:
    _org_or_404(session, org_id)
    fact = Fact(org_id=org_id, **body.model_dump())
    session.add(fact)
    session.commit()
    return {"id": fact.id}


@app.get("/orgs/{org_id}/kb/facts")
def list_facts(org_id: int, session: Session = Depends(get_session)) -> list[dict]:
    _org_or_404(session, org_id)
    rows = session.query(Fact).filter(Fact.org_id == org_id).all()
    return [
        {"id": f.id, "key": f.key, "statement": f.statement, "value": f.value, "unit": f.unit,
         "keywords": f.keywords, "source": f.source, "valid_from": f.valid_from, "valid_to": f.valid_to}
        for f in rows
    ]


@app.delete("/orgs/{org_id}/kb/facts/{fact_id}")
def delete_fact(org_id: int, fact_id: int, session: Session = Depends(get_session)) -> dict:
    _org_or_404(session, org_id)
    fact = session.get(Fact, fact_id)
    if not fact or fact.org_id != org_id:
        raise HTTPException(404, "Fact not found")
    session.delete(fact)
    session.commit()
    return {"ok": True, "deleted": fact_id}


class TermIn(BaseModel):
    kind: str = Field(pattern="^(terminology|banned_phrase)$")
    phrase: str = Field(min_length=1, max_length=200)
    preferred: str | None = None
    reason: str = ""
    severity: str = Field(default="medium", pattern="^(low|medium|high)$")


@app.post("/orgs/{org_id}/kb/terms")
def add_term(org_id: int, body: TermIn, session: Session = Depends(get_session)) -> dict:
    _org_or_404(session, org_id)
    term = Term(org_id=org_id, **body.model_dump())
    session.add(term)
    session.commit()
    return {"id": term.id}


@app.get("/orgs/{org_id}/kb/terms")
def list_terms(org_id: int, session: Session = Depends(get_session)) -> list[dict]:
    _org_or_404(session, org_id)
    rows = session.query(Term).filter(Term.org_id == org_id).all()
    return [{"id": t.id, "kind": t.kind, "phrase": t.phrase, "preferred": t.preferred,
             "reason": t.reason, "severity": t.severity} for t in rows]


@app.delete("/orgs/{org_id}/kb/terms/{term_id}")
def delete_term(org_id: int, term_id: int, session: Session = Depends(get_session)) -> dict:
    _org_or_404(session, org_id)
    term = session.get(Term, term_id)
    if not term or term.org_id != org_id:
        raise HTTPException(404, "Term not found")
    session.delete(term)
    session.commit()
    return {"ok": True, "deleted": term_id}


# ---------- reviews and workflow ----------
class ReviewIn(BaseModel):
    text: str
    title: str = "Untitled Content"
    channel: str = "General"
    creator_name: str = "Maya (Content Creator)"
    use_ai: bool = True


@app.post("/orgs/{org_id}/review/text")
def review_text(org_id: int, body: ReviewIn, session: Session = Depends(get_session)) -> dict:
    try:
        return review_service.run_review(
            session=session,
            org_id=org_id,
            text=body.text,
            channel=body.channel,
            use_ai=body.use_ai,
            title=body.title,
            creator_name=body.creator_name,
        )
    except LookupError as exc:
        raise HTTPException(404, str(exc))
    except ValueError as exc:
        raise HTTPException(422, str(exc))


@app.post("/orgs/{org_id}/review/file")
async def review_file(
    org_id: int,
    file: UploadFile = File(...),
    title: str = Form(""),
    channel: str = Form("Document"),
    creator_name: str = Form("Maya (Content Creator)"),
    use_ai: bool = Form(True),
    session: Session = Depends(get_session),
) -> dict:
    _org_or_404(session, org_id)
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File exceeds 10MB limit")
    try:
        text = ingest.extract_text(file.filename or "", data)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    return review_service.run_review(
        session=session,
        org_id=org_id,
        text=text,
        channel=channel or "Document",
        use_ai=use_ai,
        title=title or file.filename or "Uploaded Document",
        creator_name=creator_name,
    )


@app.post("/orgs/{org_id}/review/image")
async def review_image(
    org_id: int,
    image: UploadFile = File(...),
    alt_text: str = Form(""),
    session: Session = Depends(get_session),
) -> dict:
    data = await image.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Image is larger than 10 MB")
    try:
        return review_service.review_image(session, org_id, data, alt_text)
    except LookupError as exc:
        raise HTTPException(404, str(exc))
    except ValueError as exc:
        raise HTTPException(422, str(exc))


class ContrastIn(BaseModel):
    fg: str
    bg: str
    large_text: bool = False
    level: str = Field(default="AA", pattern="^(AA|AAA)$")


@app.post("/orgs/{org_id}/review/contrast")
def review_contrast(org_id: int, body: ContrastIn, session: Session = Depends(get_session)) -> dict:
    org = _org_or_404(session, org_id)
    try:
        ratio = contrast.contrast_ratio(body.fg, body.bg)
        finding = contrast.check_contrast(body.fg, body.bg, list(org.palette or []), body.level, body.large_text)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    return {"ratio": round(ratio, 2), "required": contrast.required_ratio(body.level, body.large_text),
            "passes": finding is None, "finding": finding.to_dict() if finding else None}


# ---------- pipeline & approval workflow ----------
@app.get("/orgs/{org_id}/reviews")
def list_reviews(org_id: int, session: Session = Depends(get_session)) -> list[dict]:
    _org_or_404(session, org_id)
    reviews = (
        session.query(Review)
        .filter(Review.org_id == org_id)
        .order_by(Review.created_at.desc())
        .all()
    )
    out = []
    for r in reviews:
        findings_count = len(r.findings)
        open_count = sum(1 for f in r.findings if f.status == "open")
        resolved_count = sum(1 for f in r.findings if f.status in ("accepted", "dismissed"))
        out.append({
            "id": r.id,
            "title": r.title or "Untitled Review",
            "channel": r.channel or "General",
            "status": r.status or "draft",
            "creator_name": r.creator_name or "Maya (Content Creator)",
            "assigned_reviewer": r.assigned_reviewer or "Jordan (Brand Manager)",
            "version": r.version,
            "findings_count": findings_count,
            "open_count": open_count,
            "resolved_count": resolved_count,
            "content_snippet": (r.content[:160] + "...") if len(r.content) > 160 else r.content,
            "ai_used": r.ai_used,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        })
    return out


@app.get("/reviews/{review_id}")
def get_review(review_id: int, session: Session = Depends(get_session)) -> dict:
    review = session.get(Review, review_id)
    if review is None:
        raise HTTPException(404, "Review not found")

    findings = [
        {
            "id": f.id,
            "rule_id": f.rule_id,
            "category": f.category,
            "severity": f.severity,
            "source": f.source,
            "verdict": f.verdict,
            "message": f.message,
            "original": f.original,
            "suggestion": f.suggestion,
            "start": f.start,
            "end": f.end,
            "evidence": f.evidence,
            "status": f.status,
            "dismiss_reason": f.dismiss_reason,
            "incorrect_finding": f.incorrect_finding,
            "decided_at": f.decided_at.isoformat() if f.decided_at else None,
        }
        for f in review.findings
    ]

    revisions = [
        {
            "id": rev.id,
            "version_number": rev.version_number,
            "content": rev.content,
            "change_summary": rev.change_summary,
            "created_by": rev.created_by,
            "created_at": rev.created_at.isoformat() if rev.created_at else None,
        }
        for rev in review.revisions
    ]

    comments = [
        {
            "id": c.id,
            "user_name": c.user_name,
            "user_role": c.user_role,
            "message": c.message,
            "finding_id": c.finding_id,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in review.comments
    ]

    audit_logs = [
        {
            "id": a.id,
            "action": a.action,
            "actor_name": a.actor_name,
            "actor_role": a.actor_role,
            "notes": a.notes,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in review.audit_logs
    ]

    return {
        "id": review.id,
        "org_id": review.org_id,
        "title": review.title or "Untitled Review",
        "channel": review.channel or "General",
        "status": review.status or "draft",
        "creator_name": review.creator_name or "Maya (Content Creator)",
        "assigned_reviewer": review.assigned_reviewer or "Jordan (Brand Manager)",
        "version": review.version,
        "content": review.content,
        "ai_used": review.ai_used,
        "ai_error": review.ai_error,
        "created_at": review.created_at.isoformat() if review.created_at else None,
        "updated_at": review.updated_at.isoformat() if review.updated_at else None,
        "findings": findings,
        "revisions": revisions,
        "comments": comments,
        "audit_logs": audit_logs,
    }


class WorkflowActionIn(BaseModel):
    action: str = Field(pattern="^(submit_for_review|request_changes|approve|publish|reopen)$")
    actor_name: str
    actor_role: str
    notes: str = ""


@app.post("/reviews/{review_id}/workflow")
def update_workflow(review_id: int, body: WorkflowActionIn, session: Session = Depends(get_session)) -> dict:
    review = session.get(Review, review_id)
    if review is None:
        raise HTTPException(404, "Review not found")

    status_map = {
        "submit_for_review": "in_review",
        "request_changes": "changes_requested",
        "approve": "approved",
        "publish": "published",
        "reopen": "draft",
    }
    new_status = status_map[body.action]
    review.status = new_status
    review.updated_at = datetime.now(timezone.utc)

    audit = ApprovalAudit(
        review_id=review.id,
        action=body.action,
        actor_name=body.actor_name,
        actor_role=body.actor_role,
        notes=body.notes or f"Status changed to {new_status}",
    )
    review.audit_logs.append(audit)
    session.commit()
    return {"id": review.id, "status": review.status, "action": body.action}


class RevisionIn(BaseModel):
    content: str
    change_summary: str = ""
    actor_name: str = "Creator"
    use_ai: bool = False


@app.post("/reviews/{review_id}/revisions")
def save_revision(review_id: int, body: RevisionIn, session: Session = Depends(get_session)) -> dict:
    review = session.get(Review, review_id)
    if review is None:
        raise HTTPException(404, "Review not found")
    if not body.content.strip():
        raise HTTPException(422, "Content cannot be empty")

    org = _org_or_404(session, review.org_id)
    org_obj, term_rules, facts = review_service.load_org_data(session, review.org_id)

    # Re-run rule checks on the revised content
    findings, claim_results = review_service.exact_review(body.content, org_obj, term_rules, facts)
    ai_used, ai_error = False, ""
    if body.use_ai and gemini.is_configured():
        try:
            from .ai.grounded_review import adjudicate_claims, review_with_passages
            from .config import settings
            from .kb.retrieval import retrieve

            claim_results = adjudicate_claims(claim_results, facts)
            passages = retrieve(session, review.org_id, body.content, settings.retrieval_top_k)
            ai_findings = review_with_passages(body.content, review.channel, passages)
            exact_so_far = findings + review_service.to_findings(claim_results)
            findings += [a for a in ai_findings if not any(review_service._overlaps(a, e) for e in exact_so_far)]
            ai_used = True
        except Exception as exc:
            ai_error = str(exc)

    findings += review_service.to_findings(claim_results)
    findings = sorted(review_service._dedupe(findings), key=lambda f: (f.start if f.start is not None else 10**9, f.rule_id))

    # Update review
    review.content = body.content
    review.version += 1
    review.updated_at = datetime.now(timezone.utc)
    if ai_used:
        review.ai_used = True

    # Re-populate findings
    for old_f in list(review.findings):
        session.delete(old_f)

    for f in findings:
        review.findings.append(
            FindingRow(
                org_id=review.org_id,
                rule_id=f.rule_id,
                category=f.category,
                severity=f.severity,
                source=f.source,
                verdict=f.verdict,
                message=f.message,
                original=f.original,
                suggestion=f.suggestion,
                start=f.start,
                end=f.end,
                evidence=f.evidence,
                status="open",
            )
        )

    # Log revision and audit
    review.revisions.append(
        ReviewRevision(
            version_number=review.version,
            content=body.content,
            change_summary=body.change_summary or f"Updated revision v{review.version}",
            created_by=body.actor_name,
        )
    )
    review.audit_logs.append(
        ApprovalAudit(
            action="revised",
            actor_name=body.actor_name,
            actor_role="creator",
            notes=body.change_summary or f"Created revision v{review.version}",
        )
    )
    session.commit()
    return {"id": review.id, "version": review.version, "findings_count": len(findings)}


class CommentIn(BaseModel):
    user_name: str
    user_role: str
    message: str
    finding_id: int | None = None


@app.post("/reviews/{review_id}/comments")
def add_comment(review_id: int, body: CommentIn, session: Session = Depends(get_session)) -> dict:
    review = session.get(Review, review_id)
    if review is None:
        raise HTTPException(404, "Review not found")
    comment = Comment(
        review_id=review.id,
        user_name=body.user_name,
        user_role=body.user_role,
        message=body.message,
        finding_id=body.finding_id,
    )
    review.comments.append(comment)
    session.commit()
    return {
        "id": comment.id,
        "review_id": comment.review_id,
        "user_name": comment.user_name,
        "user_role": comment.user_role,
        "message": comment.message,
        "finding_id": comment.finding_id,
        "created_at": comment.created_at.isoformat() if comment.created_at else None,
    }


# ---------- creator decisions on findings ----------
class DecisionIn(BaseModel):
    status: str = Field(pattern="^(accepted|dismissed|open)$")
    reason: str = ""  # required when dismissing
    incorrect_finding: bool = False  # the "incorrect finding" button


@app.patch("/findings/{finding_id}")
def decide(finding_id: int, body: DecisionIn, session: Session = Depends(get_session)) -> dict:
    row = session.get(FindingRow, finding_id)
    if row is None:
        raise HTTPException(404, "Finding not found")
    if body.status == "dismissed" and not body.reason.strip() and not body.incorrect_finding:
        raise HTTPException(422, "Give a reason when dismissing a finding")
    row.status = body.status
    row.dismiss_reason = body.reason
    row.incorrect_finding = body.incorrect_finding
    row.decided_at = datetime.now(timezone.utc).replace(tzinfo=None)
    session.commit()
    return {"id": row.id, "status": row.status}


# ---------- numbers the dashboard needs ----------
@app.get("/orgs/{org_id}/insights/rules")
def rule_insights(org_id: int, session: Session = Depends(get_session)) -> list[dict]:
    """Per rule: how often it fired, how often people dismissed it, how often marked incorrect."""
    _org_or_404(session, org_id)
    rows = (
        session.query(
            FindingRow.rule_id,
            FindingRow.category,
            func.count(FindingRow.id),
            func.sum(case((FindingRow.status == "dismissed", 1), else_=0)),
            func.sum(case((FindingRow.incorrect_finding.is_(True), 1), else_=0)),
        )
        .filter(FindingRow.org_id == org_id)
        .group_by(FindingRow.rule_id, FindingRow.category)
        .all()
    )
    out = []
    for rule_id, category, total, dismissed, incorrect in rows:
        dismissed, incorrect = int(dismissed or 0), int(incorrect or 0)
        out.append({
            "rule_id": rule_id, "category": category, "total": total, "dismissed": dismissed,
            "incorrect": incorrect, "dismissal_rate": round(dismissed / total, 3) if total else 0,
        })
    return sorted(out, key=lambda r: (-r["dismissal_rate"], -r["total"]))


@app.get("/orgs/{org_id}/insights/summary")
def governance_summary(org_id: int, session: Session = Depends(get_session)) -> dict:
    """Executive governance KPI metrics and guideline confusion breakdown."""
    _org_or_404(session, org_id)
    reviews = session.query(Review).filter(Review.org_id == org_id).all()
    findings = session.query(FindingRow).filter(FindingRow.org_id == org_id).all()

    total_reviews = len(reviews)
    approved_reviews = sum(1 for r in reviews if r.status in ("approved", "published"))
    approval_rate = round((approved_reviews / total_reviews * 100), 1) if total_reviews else 0.0

    total_findings = len(findings)
    open_findings = sum(1 for f in findings if f.status == "open")
    resolved_findings = sum(1 for f in findings if f.status in ("accepted", "dismissed"))
    dismissed_findings = sum(1 for f in findings if f.status == "dismissed")
    false_alarms = sum(1 for f in findings if f.incorrect_finding)

    # Categories
    categories: dict[str, int] = {}
    for f in findings:
        cat = f.category or "other"
        categories[cat] = categories.get(cat, 0) + 1

    # Status distribution
    status_counts: dict[str, int] = {}
    for r in reviews:
        st = r.status or "draft"
        status_counts[st] = status_counts.get(st, 0) + 1

    # Brand Health Index (100 minus penalty for open issues per review)
    compliance_score = max(50, min(100, 100 - int((open_findings / max(1, total_reviews)) * 12)))

    # Rules insights for guideline confusion
    rule_stats = rule_insights(org_id, session)
    unclear_guidelines = [r for r in rule_stats if r["total"] >= 1 and r["dismissal_rate"] > 0][:5]

    return {
        "total_reviews": total_reviews,
        "approved_reviews": approved_reviews,
        "approval_rate": approval_rate,
        "compliance_score": compliance_score,
        "total_findings": total_findings,
        "open_findings": open_findings,
        "resolved_findings": resolved_findings,
        "dismissed_findings": dismissed_findings,
        "false_alarms": false_alarms,
        "category_counts": categories,
        "status_counts": status_counts,
        "unclear_guidelines": unclear_guidelines,
    }


# ---------- demo presets for hackathon judging ----------
@app.get("/orgs/{org_id}/demo-presets")
def demo_presets(org_id: int) -> list[dict]:
    return [
        {
            "id": "preset-outdated-stats",
            "title": "Q4 LinkedIn Campaign: Growth Announcement",
            "channel": "LinkedIn post",
            "description": "Realistic draft with outdated metrics ('5 million customers'), absolute security claim, and violent metaphor.",
            "text": "We are thrilled to announce that the tool is now used by over 5 million customers worldwide! Our platform offers 100% secure infrastructure and guaranteed uptime, making it a revolutionary solution for modern enterprises. Check out this killer feature and sign up today!",
            "expected_issues": [
                "Product name: says 'the tool' instead of 'FlowDesk'",
                "Customer terminology: says 'customers' instead of 'teams'",
                "Outdated claim: says 'over 5 million' (approved fact sheet says 3 million)",
                "Banned phrase: '100% secure' (prohibited absolute claim)",
                "Banned phrase: 'guaranteed' (prohibited outcome guarantee)",
                "Banned phrase: 'revolutionary' (unsupported hype)",
                "Banned phrase: 'killer feature' (violent metaphor)",
            ],
        },
        {
            "id": "preset-inaccessible-banner",
            "title": "Web Hero Banner: Low Contrast & Missing Alt Text",
            "channel": "Web Banner",
            "description": "Contains inline HTML failing WCAG AA 4.5:1 contrast, lower-case brand name, and untagged images.",
            "text": '<div style="color:#cccccc;background:#ffffff;padding:20px">\n  <h2>Get started with flowdesk today</h2>\n  <p>Our cheap plans start at $9 per user.</p>\n  <img src="https://example.com/hero.png">\n</div>',
            "expected_issues": [
                "Accessibility: contrast ratio 1.6:1 fails WCAG AA (needs 4.5:1)",
                "Product casing: 'flowdesk' instead of 'FlowDesk'",
                "Banned word: 'cheap' (position on value, use 'affordable')",
                "Contradicted price: '$9 per user' (approved fact sheet says starts at $12)",
                "Accessibility: missing image alt text attribute",
            ],
        },
        {
            "id": "preset-unverified-superlatives",
            "title": "Press Release: Unverified Market Claims",
            "channel": "Press Release",
            "description": "Exaggerated claims and ungrounded superlatives that have no corroborating proof in company fact sheets.",
            "text": "Northwind Labs Inc is officially recognized as the fastest cloud workspace in the market. Revenue grew 45% last quarter, and FlowDesk is now active in 60 countries across the globe.",
            "expected_issues": [
                "Company name: 'Northwind Labs Inc' (marketing guidelines say drop legal suffix)",
                "Unverified superlative: 'fastest cloud workspace' (no evidence in fact sheet)",
                "Unverified statistic: 'Revenue grew 45%' (cannot verify against approved facts)",
                "Contradicted fact: '60 countries' (fact sheet verifies 40 countries only)",
            ],
        },
        {
            "id": "preset-clean-approved",
            "title": "Official Benchmark: Clean Approved Release",
            "channel": "Blog",
            "description": "Compliant, fact-checked publication draft that passes every brand rule and fact check with flying colors.",
            "text": "Northwind Labs is proud to support more than 3 million teams globally with FlowDesk. Built with strong security controls and SOC 2 Type II certification, FlowDesk plans start at $12 per user per month with 99.9% uptime over the past 12 months.",
            "expected_issues": [
                "Zero violations detected! All claims verified against Fact Sheet v3.",
            ],
        },
    ]


import os
from fastapi.staticfiles import StaticFiles

frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")


