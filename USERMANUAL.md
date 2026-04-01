# Orbit User Manual

Version: 1.0
Date: March 30, 2026
Product: Orbit Event Management Platform

## Document Control

### Revision History

| Version | Date | Author | Notes |
|---|---|---|---|
| 1.0 | March 30, 2026 | Orbit Team | First full draft |

## Table of Contents

1. Introduction
2. Intended Audience
3. System Requirements
4. Quick Start
5. User Roles and Access Levels
6. Main Navigation
7. Account and Login
8. Home Page Guide
9. Event Details Popup Guide
10. Bookmarks and Reminder Guide
11. Explore Map Guide
12. Admin CMS Guide
13. Organizer API Guide
14. Notifications and Reminder Emails
15. Dark Mode and Appearance
16. Troubleshooting
17. FAQ
18. Security and Privacy Notes
19. Glossary
20. Support and Feedback

## 1. Introduction

Orbit is an event management web application that helps users discover, track, and organize events. The platform provides:

- Event browsing with list and calendar views
- Live countdowns for event start times
- Bookmarking and reminder settings
- Explore Map view for events that include map locations
- Admin tools for creating and maintaining public events
- Optional organizer API for posting events programmatically

## 2. Intended Audience

This manual is for:

- Guest users who want quick access without full account setup
- Logged-in users who want personalized features like bookmarks
- Admin users who manage public events
- External organizers using the API to publish events

## 3. System Requirements

### Supported Environment

- Modern desktop or mobile browser
- Stable internet connection
- JavaScript enabled

### Recommended

- Google account login for full synchronization features
- Email configuration enabled on server for reminder emails

## 4. Quick Start

### 4.1 Start the App

1. Open Orbit in your browser.
2. Wait for the login page to load.

### 4.2 Choose Access Method

1. Log in with Google for full feature access.
2. Create an account if using the account creation flow.
3. Use Guest Mode if available for limited access.

### 4.3 Navigate Core Pages

1. Open Home to browse events.
2. Open Bookmarks to view saved events.
3. Open Explore Map to view events by location.

## 5. User Roles and Access Levels

### 5.1 Guest User

Guest users can:

- Browse events
- Open event details
- Use basic navigation

Guest limitations:

- Limited or restricted personalized features
- Some profile and source-specific controls may be hidden

### 5.2 Logged-in User

Logged-in users can:

- Access full browsing features
- Add and remove bookmarks
- Set reminder preferences for bookmarked events
- Use complete menu and profile controls

### 5.3 Admin User

Admin users can:

- Access admin dashboard
- Create public events
- Edit upcoming public events
- Delete public events
- Manage event map or text location entries

## 6. Main Navigation

The side menu contains:

- Home
- Bookmarks
- Explore Map
- Dark Mode toggle

Top bar includes:

- Menu button
- Profile menu
- Logout
- Theme toggle

## 7. Account and Login

### 7.1 Login

1. Open the login page.
2. Select preferred login method.
3. Complete authentication.
4. You are redirected to Home.

### 7.2 Create Account

1. Open Create Account page.
2. Enter required information.
3. Submit and continue to app.

### 7.3 Logout

1. Open profile menu in top right.
2. Click Logout.
3. You return to login page.

## 8. Home Page Guide

Home supports two views:

- List View
- Calendar View

### 8.1 List View

List View shows event cards with:

- Event title
- Event date and time
- Short description
- Countdown summary
- Bookmark icon

### 8.2 Calendar View

Calendar View shows:

- Month calendar grid
- Events marked by date
- Day panel for selected date

### 8.3 Search and Filters

Users can filter by:

- Search text
- Source type
- Time period
- Category and custom keywords
- Event type
- Location type
- Sort order

### 8.4 Event Selection

Clicking an event opens the Event Details popup with complete information.

## 9. Event Details Popup Guide

The event popup includes:

- Event title
- Date and time
- Description
- Live countdown timer
- Image carousel when images exist
- Location section
- Ticket button when ticket URL exists
- Bookmark icon

### 9.1 Location Display Rules

- If event uses map location, an embedded map preview is shown
- If event uses text location, text address card is shown

### 9.2 Countdown Behavior

Countdown shows:

- Days
- Hours
- Minutes
- Seconds

When event time passes, countdown shows zeros.

## 10. Bookmarks and Reminder Guide

### 10.1 Add Bookmark

1. Click bookmark icon on event card or popup.
2. Bookmark icon turns active.
3. Event appears in Bookmarks page.

### 10.2 Remove Bookmark

1. Click active bookmark icon.
2. Event is removed from bookmarks.

### 10.3 Reminder Setup

After bookmarking, users can select reminder lead time.

Supported reminder examples:

- 15 minutes before
- 30 minutes before
- 1 hour before
- 1 day before
- No reminder

### 10.4 Reminder Email

If server email is configured, reminders are sent to user email based on selected timing.

## 11. Explore Map Guide

Explore Map displays upcoming events that include map location data.

### 11.1 What You See

- Interactive map with event markers
- Small event name labels at marker locations
- Right-side detail panel

### 11.2 Marker Interaction

1. Click a map marker.
2. Right-side panel updates with selected event details.

Right panel includes:

- Event title
- Date and time
- Description
- Countdown timer
- Location link
- Ticket button when present
- Bookmark icon

### 11.3 Map Data Rules

- Only events with map location are shown
- Past events are excluded
- Coordinates are extracted from stored map links when possible

## 12. Admin CMS Guide

### 12.1 Admin Access

Admin access is restricted to approved admin account(s).

### 12.2 Admin Login Flow

1. Open Admin page.
2. Authenticate with admin account.
3. Admin panel becomes available.

### 12.3 Create Public Event

Required fields:

- Title
- Date and time

Optional fields:

- Description
- Location
- Ticket URL
- Images

Location options:

- Text location
- Map location using iframe code or map URL

### 12.4 Edit Event

- Only upcoming events can be edited
- Edit mode pre-fills event form
- Save updates event in database

### 12.5 Delete Event

1. Click delete action on event card.
2. Confirm delete in modal.
3. Event is removed.

### 12.6 Image Handling

Admin can:

- Upload image files
- Add image links
- Preview images before save
- Remove selected preview images

## 13. Organizer API Guide

Orbit provides API support for external organizers.

### 13.1 Authentication

- API key required
- Key passed using X-API-Key header or api_key query parameter

### 13.2 Create Event Endpoint

- Method: POST
- Path: /api/events
- Content type: JSON or form-data

Common fields:

- title required
- date required
- description optional
- location optional
- ticketUrl optional
- image URLs optional

### 13.3 API Errors

Possible errors include:

- 401 unauthorized for missing or invalid API key
- 400 for invalid request body
- 503 when server-side Firebase configuration is unavailable

## 14. Notifications and Reminder Emails

### 14.1 Automatic Reminder

System can send reminder emails based on bookmark reminder rules.

### 14.2 Email Configuration Dependency

Email reminders require server mail settings to be correctly configured.

## 15. Dark Mode and Appearance

Users can toggle dark mode from:

- Side menu toggle
- Top bar theme toggle

Theme choice is saved locally and restored on next visit.

## 16. Troubleshooting

### 16.1 Login Problems

Symptoms:

- Redirect back to login
- Session not retained

Actions:

1. Refresh page.
2. Re-login.
3. Check browser cookies and storage permissions.

### 16.2 No Events Visible

Actions:

1. Reset filters.
2. Ensure time filters are not too restrictive.
3. Confirm events exist and are in future.

### 16.3 Map Not Showing

Actions:

1. Refresh page.
2. Check internet connection.
3. Verify event location entries include valid map link data.

### 16.4 Reminder Email Missing

Actions:

1. Confirm event is bookmarked.
2. Confirm reminder time is set.
3. Verify server email configuration.
4. Check spam folder.

### 16.5 Admin Cannot Edit Event

Cause:

- Event may already be in the past

Action:

- Edit only upcoming events

## 17. FAQ

### Q1: Why do some events not appear in Explore Map?

Only events with valid map location entries are shown.

### Q2: Why are past events missing in Explore Map?

Explore Map is configured to show only upcoming events.

### Q3: Can I use Orbit without logging in?

Yes, Guest Mode is available with limited features.

### Q4: How do I make map preview show correctly in event popup?

Use valid Google map iframe or map URL in admin location map field.

### Q5: Can I add ticket links?

Yes, add a valid HTTP or HTTPS ticket URL when creating or editing event.

## 18. Security and Privacy Notes

- Keep admin credentials private
- Keep API key private
- Do not expose server environment secrets
- Follow least-privilege access for admin users
- Review shared screenshots for sensitive data before publishing

## 19. Glossary

- Public Event: Event published by admin and visible to users
- Bookmark: Saved event linked to user profile or guest storage
- Reminder: Notification preference tied to a bookmark
- Explore Map: Map-based event discovery view
- Admin CMS: Event management console for authorized admins

## 20. Support and Feedback

When reporting issues, provide:

- Page where issue happened
- Steps to reproduce
- Expected behavior
- Actual behavior
- Browser and device
- Screenshot if available

Recommended internal support workflow:

1. Reproduce issue
2. Check console logs and network calls
3. Validate data in Firestore
4. Confirm configuration values

## Appendix A: Suggested Screenshot Plan

Capture screenshots for:

1. Login page
2. Home list view
3. Home calendar view
4. Event details popup
5. Bookmarks page
6. Explore Map with marker labels
7. Explore Map right detail panel
8. Admin dashboard
9. Admin create/edit form
10. Dark mode examples

## Appendix B: Release Checklist for Manual Updates

Before each release:

1. Verify menu items and page names are unchanged
2. Verify login and role flows are unchanged
3. Verify filter options still match UI
4. Verify Explore Map behavior still matches this manual
5. Verify admin form fields still match this manual
6. Update version and revision history
