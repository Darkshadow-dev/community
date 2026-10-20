# Commonroom

Commonroom is the community site in this folder. Open `index.html` (or the old `Community.html` address, which forwards here) from a local web server or the deployed site.

## Features

- Email and password account creation, sign-in, sign-out, and password reset
- Case-insensitive unique display names reserved transactionally in Firebase, including Unicode-normalized names
- The first account to claim the exact name `Ⓖ THE Creator Ⓖ` becomes the community admin; that name remains permanently reserved
- New accounts can claim an existing anonymous session so posts made before signup stay attached to the same account
- Firebase Realtime Database feed with live posts, replies, reactions, saves, edits, and deletes
- Search, category spaces, following feed, saved posts, member directory, recent activity, and profile editing
- Admin moderation desk for reviewing member reports, opening flagged posts, dismissing reports, and removing posts
- Firebase data from the existing `posts` collection remains readable in the redesigned feed
- Space membership and followed-member preferences are saved in the current browser

## Firebase setup

The page uses the `arduino-guideg` Firebase project already configured for this community. Email/Password is required for account creation. Anonymous sign-in lets visitors browse and lets regular signups link an existing guest session without changing the UID on older posts. For signup, open the page from `http://localhost` or the deployed site rather than `file://`; add that host under Firebase Authentication → Settings → Authorized domains if it is missing. Firebase documents the password provider setup [here](https://firebase.google.com/docs/auth/web/password-auth?hl=en).

To serve this folder locally, open PowerShell here and run `py -m http.server 8000 --bind 127.0.0.1`, then visit `http://localhost:8000/index.html`. Keep the PowerShell window open while using the site.

Import the current `database.rules.json` in Realtime Database → Rules before creating accounts. It keeps existing `/posts` data, lets members edit their own posts and replies, reserves display names, and lets the creator account claim admin once at `/communityConfig/adminUid`. Until the creator account claims it, the original admin UID (`HlLj9hzon7bs2aEUpuOn97HWl9v1`) remains a fallback admin. Once claimed, only the creator account is admin.

The member directory writes display name and UID to `/members/{uid}`; it never writes an email address there. Unique name reservations are stored at `/usernames/{normalizedNameKey}`. Firebase Realtime Database transactions serialize competing reservations so only one account can own a name at a time; see the official [transaction guide](https://firebase.google.com/docs/database/web/read-and-write). Feed reads and writes use the existing `/posts` data shape. Space membership and followed-member preferences are saved in each browser.
