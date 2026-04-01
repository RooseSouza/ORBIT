from flask import Flask, render_template, request, jsonify
from flask_mail import Mail, Message
from flask_cors import CORS
from datetime import datetime
from dotenv import load_dotenv
import base64
import os
import re

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})


@app.route('/ping', methods=['GET', 'HEAD'])
def ping():
    """Lightweight uptime endpoint for external monitors and keep-alive checks."""
    expected = os.environ.get('UPTIME_PING_TOKEN')
    provided = request.args.get('token')
    if expected and provided != expected:
        return jsonify({"ok": False, "error": "unauthorized"}), 401

    if request.method == 'HEAD':
        response = app.response_class('', status=204)
    else:
        response = jsonify({
            "ok": True,
            "service": "orbit",
            "time": datetime.utcnow().isoformat() + "Z"
        })

    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    return response

app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 465
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME') 
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD') 
app.config['MAIL_USE_TLS'] = False
app.config['MAIL_USE_SSL'] = True
# ====================================================

mail = Mail(app)

# --- Firebase Admin Setup ---
# Uses service account values from environment variables (FIREBASE_* vars).
_db = None
try:
    import firebase_admin
    from firebase_admin import credentials, firestore as fs_admin

    service_account = {
        "type": os.environ.get("FIREBASE_TYPE"),
        "project_id": os.environ.get("FIREBASE_PROJECT_ID"),
        "private_key_id": os.environ.get("FIREBASE_PRIVATE_KEY_ID"),
        "private_key": os.environ.get("FIREBASE_PRIVATE_KEY"),
        "client_email": os.environ.get("FIREBASE_CLIENT_EMAIL"),
        "client_id": os.environ.get("FIREBASE_CLIENT_ID"),
        "auth_uri": os.environ.get("FIREBASE_AUTH_URI", "https://accounts.google.com/o/oauth2/auth"),
        "token_uri": os.environ.get("FIREBASE_TOKEN_URI", "https://oauth2.googleapis.com/token"),
    }

    has_env_service_account = all([
        service_account["type"],
        service_account["project_id"],
        service_account["private_key_id"],
        service_account["private_key"],
        service_account["client_email"],
        service_account["client_id"],
    ])

    if has_env_service_account:
        # .env often stores newlines as escaped "\\n"; convert to real newlines.
        private_key = service_account["private_key"].strip('"').replace('\\n', '\n')
        service_account["private_key"] = private_key
        cred = credentials.Certificate(service_account)
    else:
        missing_fields = [
            key for key, value in service_account.items()
            if key in {"type", "project_id", "private_key_id", "private_key", "client_email", "client_id"} and not value
        ]
        raise RuntimeError("Missing Firebase env vars: " + ", ".join(missing_fields))

    firebase_admin.initialize_app(cred)
    _db = fs_admin.client()
    print("[INFO] Firebase Admin SDK initialised.")
except Exception as _e:
    print(f"[WARNING] Firebase Admin not initialised – /api/events will return 503. ({_e})")

# --- Organiser API key ---
# Set via environment variable:  set ORGANISER_API_KEY=your-secret-key
ORGANISER_API_KEY = os.environ.get('ORGANISER_API_KEY', 'orbit-dev-key')

# 1. Login Page (Root)
@app.route('/')
def login():
    return render_template('login.html')


@app.route('/create-account')
def create_account():
    return render_template('create-account.html')

# 2. Home Dashboard
@app.route('/home')
def home():
    return render_template('home.html', active_page='home')

# 3. Bookmarks Page
@app.route('/bookmarks')
def bookmarks():
    return render_template('bookmarks.html', active_page='bookmarks')

# 4. Explore Map Page
@app.route('/explore-map')
def explore_map():
    return render_template('explore-map.html', active_page='explore_map')

# 5. Admin Page
@app.route('/admin')
def admin():
    return render_template('admin.html')

# 6. Send Reminder Email (Triggered by JS)
@app.route('/send-reminder', methods=['POST'])
def send_reminder():
    data = request.json
    email = data.get('email')
    event_title = data.get('title')
    days = data.get('days')
    hours = data.get('hours')
    remaining_days = data.get('remainingDays')
    remaining_hours = data.get('remainingHours')
    remaining_minutes = data.get('remainingMinutes')

    msg = Message(f"Reminder: {event_title}",
                  sender=app.config['MAIL_USERNAME'],
                  recipients=[email])
    
    def _plural(value, unit):
        return f"{value} {unit}" if value == 1 else f"{value} {unit}s"

    if remaining_days is not None and remaining_hours is not None and remaining_minutes is not None:
        parts = []
        if remaining_days:
            parts.append(_plural(remaining_days, "day"))
        if remaining_hours:
            parts.append(_plural(remaining_hours, "hour"))
        if remaining_minutes or not parts:
            parts.append(_plural(remaining_minutes, "minute"))
        time_str = " and ".join(parts)
    elif days == 0:
        time_str = f"{hours} hour(s)"
    elif hours == 0:
        time_str = f"{days} day(s)"
    else:
        time_str = f"{days} day(s) and {hours} hour(s)"

    msg.body = f"""Hello,

This is a reminder that '{event_title}' is starting soon!

Time Remaining: {time_str}.

See you there!
- The Orbit Team
"""
    
    try:
        mail.send(msg)
        print(f"Email sent to {email} for {event_title}")
        return jsonify({"success": True})
    except Exception as e:
        print(f"Failed to send email: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# ─────────────────────────────────────────────
# External Organiser API
# ─────────────────────────────────────────────

def _check_api_key():
    """Returns None if valid, else a 401 response tuple."""
    key = request.headers.get('X-API-Key') or request.args.get('api_key')
    if key != ORGANISER_API_KEY:
        return jsonify({"success": False, "error": "Unauthorised – invalid or missing API key"}), 401
    return None

def _require_db():
    """Returns None if db ready, else a 503 response tuple."""
    if _db is None:
        return jsonify({
            "success": False,
            "error": "Server Firebase not configured. Set FIREBASE_* environment variables and restart."
        }), 503
    return None


def _normalize_http_image_url(value):
    """Allow only http(s) image links for organiser API payloads."""
    raw = str(value or "").strip()
    if not raw:
        return None
    if re.match(r"^https?://", raw, flags=re.IGNORECASE):
        return raw
    return None


def _extract_image_urls_from_payload(payload):
    """Parse image URLs from JSON/form payload using flexible field names."""
    candidates = []
    raw = payload.get('images')
    if raw is None:
        raw = payload.get('imageLinks')
    if raw is None:
        raw = payload.get('imageUrls')

    if isinstance(raw, list):
        candidates.extend(raw)
    elif isinstance(raw, str):
        candidates.extend([x.strip() for x in re.split(r"[\n,]", raw) if x.strip()])

    urls = []
    seen = set()
    for candidate in candidates:
        normalized = _normalize_http_image_url(candidate)
        if normalized and normalized not in seen:
            seen.add(normalized)
            urls.append(normalized)
    return urls


def _extract_uploaded_images_as_data_urls(files):
    """Convert uploaded image files to data URLs so they can be stored directly in Firestore."""
    images = []
    for file in files:
        if not file or not file.filename:
            continue
        mime = (file.mimetype or '').lower()
        if not mime.startswith('image/'):
            continue
        data = file.read()
        if not data:
            continue
        b64 = base64.b64encode(data).decode('ascii')
        images.append(f"data:{mime};base64,{b64}")
    return images


@app.route('/api/events', methods=['POST'])
def api_create_event():
    """
    POST /api/events
    Header:  X-API-Key: <your key>
    Body (JSON):
      title       (required)  – event name
      date        (required)  – ISO 8601, e.g. "2026-06-15T18:00:00"
      description (optional)  – event details
      location    (optional)  – venue / address text
            ticketUrl   (optional)  – booking page URL
    """
    err = _check_api_key()
    if err: return err
    err = _require_db()
    if err: return err

    data = request.get_json(silent=True) if request.is_json else request.form.to_dict(flat=True)
    if not data:
        return jsonify({"success": False, "error": "Request body must be JSON or form data"}), 400

    title = str(data.get('title', '')).strip()
    date = str(data.get('date', '')).strip()
    description = str(data.get('description', '')).strip()
    location = str(data.get('location', '')).strip()
    ticket_url = str(data.get('ticketUrl') or data.get('ticket_url') or '').strip()
    if ticket_url and not re.match(r"^https?://", ticket_url, flags=re.IGNORECASE):
        ticket_url = ''
    image_urls = _extract_image_urls_from_payload(data)

    # Optional Postman form-data files under key: image_files
    uploaded_images = _extract_uploaded_images_as_data_urls(request.files.getlist('image_files'))
    all_images = []
    seen_images = set()
    for img in image_urls + uploaded_images:
        if img not in seen_images:
            seen_images.add(img)
            all_images.append(img)

    # Keep payload size reasonable for Firestore documents.
    all_images = all_images[:8]

    if not title or not date:
        return jsonify({"success": False, "error": "'title' and 'date' are required"}), 422

    # Validate ISO 8601 date
    try:
        datetime.fromisoformat(date.replace('Z', '+00:00'))
    except ValueError:
        return jsonify({"success": False, "error": "Invalid date – use ISO 8601, e.g. 2026-06-15T18:00:00"}), 422

    doc_ref = _db.collection('public_events').document()
    doc_ref.set({
        'title': title,
        'description': description,
        'date': date,
        'type': 'public',
        'locationType': 'text',
        'locationValue': location,
        'ticketUrl': ticket_url,
        'images': all_images,
    })

    return jsonify({"success": True, "id": doc_ref.id, "message": f"Event '{title}' published."}), 201


@app.route('/api/events', methods=['GET'])
def api_get_events():
    """
    GET /api/events
    Header:  X-API-Key: <your key>
    Returns all public events as JSON.
    """
    err = _check_api_key()
    if err: return err
    err = _require_db()
    if err: return err

    events = []
    for doc in _db.collection('public_events').stream():
        d = doc.to_dict()
        events.append({
            'id':          doc.id,
            'title':       d.get('title'),
            'date':        d.get('date'),
            'description': d.get('description'),
            'location':    d.get('locationValue'),
            'ticketUrl':   d.get('ticketUrl') or '',
            'images':      d.get('images') or [],
        })

    events.sort(key=lambda e: e['date'] or '')
    return jsonify(events)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)