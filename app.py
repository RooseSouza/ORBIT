from flask import Flask, render_template, request, jsonify
from flask_mail import Mail, Message
import os

app = Flask(__name__)

app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 465
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME') 
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD') 
app.config['MAIL_USE_TLS'] = False
app.config['MAIL_USE_SSL'] = True
# ====================================================

mail = Mail(app)

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

if __name__ == '__main__':
    app.run(debug=True)