from flask import Flask, render_template, request, jsonify
from flask_mail import Mail, Message
from flask_cors import CORS
from datetime import datetime
from dotenv import load_dotenv
import os

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 465
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME') 
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD') 
app.config['MAIL_USE_TLS'] = False
app.config['MAIL_USE_SSL'] = True
# ====================================================

mail = Mail(app)

# --- Firebase Admin Setup ---
# Download serviceAccountKey.json from Firebase Console > Project Settings > Service Accounts
# then set: set GOOGLE_APPLICATION_CREDENTIALS=serviceAccountKey.json
_db = None
try:
    import firebase_admin
    from firebase_admin import credentials, firestore as fs_admin
    cred_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS', 'serviceAccountKey.json')
    cred = credentials.Certificate(cred_path)
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

# 2. Home Dashboard
@app.route('/home')
def home():
    return render_template('home.html', active_page='home')

# 3. Bookmarks Page
@app.route('/bookmarks')
def bookmarks():
    return render_template('bookmarks.html', active_page='bookmarks')

# 4. Admin Page
@app.route('/admin')
def admin():
    return render_template('admin.html')

# 5. Send Reminder Email (Triggered by JS)
@app.route('/send-reminder', methods=['POST'])
def send_reminder():
    data = request.json
    email = data.get('email')
    event_title = data.get('title')
    days = data.get('days')
    hours = data.get('hours')

    msg = Message(f"Reminder: {event_title}",
                  sender=app.config['MAIL_USERNAME'],
                  recipients=[email])
    
    msg.body = f"""Hello,

This is a reminder that '{event_title}' is starting soon!

Time Remaining: {days} Days and {hours} Hours.

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
        return jsonify({"success": False, "error": "Server Firebase not configured. Add serviceAccountKey.json and restart."}), 503
    return None


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
    """
    err = _check_api_key()
    if err: return err
    err = _require_db()
    if err: return err

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"success": False, "error": "Request body must be JSON"}), 400

    title = str(data.get('title', '')).strip()
    date  = str(data.get('date',  '')).strip()
    description = str(data.get('description', '')).strip()
    location    = str(data.get('location', '')).strip()

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
        })

    events.sort(key=lambda e: e['date'] or '')
    return jsonify(events)


if __name__ == '__main__':
    app.run(debug=True)