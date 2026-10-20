# Commonroom

Commonroom is the community site in this folder. Open `index.html` (or the old `Community.html` address, which forwards here) from a local web server or the deployed site.

## Features

- Email and password account creation, sign-in, sign-out, and password reset
- New accounts can claim an existing anonymous session so posts made before signup stay attached to the same account
- Firebase Realtime Database feed with live posts, replies, reactions, saves, edits, and deletes
- Search, category spaces, following feed, saved posts, member directory, recent activity, and profile editing
- Admin moderation desk for reviewing member reports, opening flagged posts, dismissing reports, and removing posts
- Firebase data from the existing `posts` collection remains readable in the redesigned feed
- Space membership and followed-member preferences are saved in the current browser

## Firebase setup

The page uses the Firebase project already configured for this community. In Firebase Console, enable **Email/Password** and **Anonymous** under Authentication → Sign-in method. The anonymous session lets a visitor browse and lets signup link that session to an email account without changing the UID on older posts. Serve the site from `localhost` or a domain authorized in Firebase Authentication; account creation cannot be relied on from a `file://` URL.

Import `database.rules.json` in Realtime Database → Rules before opening the site publicly. The rules preserve the existing `/posts` data, let members edit their own posts and replies, scope reactions to the signed-in member, and reserve report review and resolution for the community admin. The admin UID in the rules and moderation menu is carried over from the original community script (`HlLj9hzon7bs2aEUpuOn97HWl9v1`). Sign in with that Firebase account to see the Moderation item. Do not replace this with a UID supplied by the browser; the same trusted UID must be configured in both the app and database rules.

The member directory writes display name and UID to `/members/{uid}`; it never writes an email address there. Feed reads and writes use the existing `/posts` data shape. Space membership and followed-member preferences are saved in each browser.
