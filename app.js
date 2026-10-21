(() => {
  const db = window.communityDb;
  const auth = window.communityAuth;
  const CREATOR_NAME = "Ⓖ THE Creator Ⓖ";
  const CREATOR_USERNAME_KEY = "67-20-74-68-65-20-63-72-65-61-74-6f-72-20-67";
  const spaces = [
    { name: "Design & making", category: "project", icon: "◒", tone: "peach" },
    { name: "Slow living", category: "help", icon: "☘", tone: "mint" },
    { name: "Good questions", category: "question", icon: "✦", tone: "lilac" },
    { name: "Tiny victories", category: "release", icon: "↗", tone: "yellow" }
  ];
  const $ = (selector, root = document) => root.querySelector(selector);
  const postList = $("#post-list");
  const emptyState = $("#empty-state");
  const activeFilter = $("#active-filter");
  const authErrors = {
    "auth/email-already-in-use": "That email already has an account. Sign in instead.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/weak-password": "Choose a password with at least 6 characters.",
    "auth/wrong-password": "That email and password don’t match.",
    "auth/user-not-found": "No account was found for that email.",
    "auth/invalid-credential": "That email and password don’t match.",
    "auth/credential-already-in-use": "That email already belongs to another account. Sign in to it instead.",
    "auth/operation-not-allowed": "Email and password accounts are not enabled for this Firebase project yet.",
    "auth/admin-restricted-operation": "Firebase blocked signup for this project. Check that Email/Password is enabled in guidelines-community Authentication settings.",
    "auth/invalid-api-key": "Firebase rejected this app’s API key. Check the Firebase web app configuration for guidelines-community.",
    "auth/unauthorized-domain": "This site’s domain is not authorized in Firebase Authentication. Add localhost or your deployed domain under Authentication → Settings → Authorized domains, then reopen the site there.",
    "auth/network-request-failed": "Firebase could not connect. Check your internet connection and try again.",
    "auth/too-many-requests": "Too many attempts. Wait a little and try again.",
    "database/permission-denied": "Firebase denied this change. Import the updated database.rules.json in Realtime Database → Rules.",
    "community/name-already-in-use": "That display name is already taken. Choose a different name.",
    "community/creator-name-exact": "Use the exact creator name Ⓖ THE Creator Ⓖ to claim the admin account.",
    "community/admin-already-claimed": "The creator account has already been claimed. Contact the current admin."
  };
  let currentUser = null;
  let usernameReady = false;
  let registrationInProgress = false;
  let authReady = false;
  let firstAuthEvent = true;
  let anonymousLoginPromise = null;
  let resolveAuthReady;
  const authReadyPromise = new Promise(resolve => { resolveAuthReady = resolve; });
  let postsRef = null;
  let membersRef = null;
  let reportsRef = null;
  let adminConfigRef = null;
  let adminUid = null;
  let allPosts = [];
  let members = {};
  let reports = {};
  let activeSpace = "All spaces";
  let activeView = "home";
  let activeFeed = "for-you";
  let visiblePostCount = 6;
  let authMode = "signin";
  let query = "";
  let toastTimer;
  let followingIds = new Set();
  let joinedSpaces = new Set(spaces.map(space => space.name));
  const openComments = new Set();

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    })[character]);
  }

  function safeLocalStorage(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch (_) {
      return fallback;
    }
  }

  function showToast(message) {
    const toast = $("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
  }

  function displayName(user = currentUser) {
    if (!user) return "Community member";
    const savedName = localStorage.getItem(`communityUsername.${user.uid}`) || members[user.uid]?.displayName;
    if (savedName) return savedName;
    if (user.displayName) return user.displayName;
    if (user.isAnonymous) return `Guest-${user.uid}`;
    return user.email?.split("@")[0] || "Community member";
  }

  async function resolveAccountName(user) {
    const savedName = localStorage.getItem(`communityUsername.${user.uid}`) || members[user.uid]?.displayName;
    if (savedName) return savedName;
    try {
      const profile = await db.ref(`members/${user.uid}/displayName`).once("value");
      if (profile.val()) return profile.val();
      const reservations = await db.ref("usernames").orderByChild("uid").equalTo(user.uid).once("value");
      const reservation = Object.values(reservations.val() || {})[0];
      if (reservation?.displayName) return reservation.displayName;
    } catch (error) {
      console.warn("Could not load the saved account name:", error);
    }
    return user.displayName || user.email?.split("@")[0] || "Community member";
  }

  function rememberAccountName(user, name) {
    if (user?.uid) localStorage.setItem(`communityUsername.${user.uid}`, name);
  }

  function initials(name) {
    return String(name || "?").trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || "").join("") || "?";
  }

  function avatarClass(id) {
    const variants = ["avatar-alex", "avatar-nia", "avatar-noah", "avatar-leo", "avatar-priya", "avatar-samira", "avatar-elliot"];
    let hash = 0;
    for (const character of String(id || "")) hash = (hash * 31 + character.charCodeAt(0)) | 0;
    return variants[Math.abs(hash) % variants.length];
  }

  function userAvatar(user = currentUser) {
    return user?.isAnonymous ? "avatar-maya" : avatarClass(user?.uid || "member");
  }

  function formatTime(timestamp) {
    const value = Number(timestamp);
    if (!value) return "just now";
    const seconds = Math.max(0, Math.floor((Date.now() - value) / 1000));
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function getCount(value) {
    if (!value) return 0;
    if (Array.isArray(value)) return value.filter(Boolean).length;
    return Object.values(value).filter(Boolean).length;
  }

  function objectEntries(value) {
    if (!value) return [];
    return Array.isArray(value) ? value.map((item, index) => [String(index), item]).filter(([, item]) => item) : Object.entries(value);
  }

  function spaceForCategory(category) {
    return spaces.find(space => space.category === category)?.name || "Good questions";
  }

  function initialsFor(userName) {
    return initials(userName);
  }

  function mapComment(id, comment) {
    const name = comment.username || "Community member";
    return {
      id,
      userId: comment.userId || "",
      author: { id: comment.userId || `legacy:${name}`, name, initials: initialsFor(name), avatar: avatarClass(comment.userId || name) },
      text: comment.content || "",
      time: formatTime(comment.timestamp),
      created: Number(comment.timestamp) || 0,
      edited: Boolean(comment.edited)
    };
  }

  function mapPost(id, raw) {
    const name = raw.username || "Community member";
    const authorId = raw.userId || `legacy:${name}`;
    const comments = objectEntries(raw.comments)
      .map(([commentId, comment]) => mapComment(commentId, comment))
      .sort((first, second) => first.created - second.created);
    const category = raw.category || "question";
    return {
      id,
      category,
      space: spaceForCategory(category),
      author: { id: authorId, name, initials: initialsFor(name), avatar: avatarClass(authorId), role: categoryRole(category) },
      title: raw.title || "Untitled conversation",
      body: raw.content || "",
      code: raw.code || "",
      created: Number(raw.timestamp) || 0,
      time: formatTime(raw.timestamp),
      edited: Boolean(raw.edited),
      likes: getCount(raw.likes),
      _rawLikes: raw.likes || {},
      liked: Boolean(currentUser && raw.likes?.[currentUser.uid]),
      dislikes: getCount(raw.dislikes),
      saved: Boolean(currentUser && raw.favorites?.[currentUser.uid]),
      tags: [categoryLabel(category)],
      comments,
      commentsOpen: openComments.has(id)
    };
  }

  function categoryRole(category) {
    return ({ project: "Making in public", question: "Curious and asking", help: "Here to help", release: "Sharing a small win" })[category] || "Community member";
  }

  function categoryLabel(category) {
    return ({ project: "projects", question: "questions", help: "help", release: "small wins" })[category] || "community";
  }

  function canWrite() {
    return Boolean(currentUser);
  }

  function isAdmin() {
    return Boolean(currentUser && adminUid && currentUser.uid === adminUid);
  }

  function normalizedName(name) {
    return String(name || "").normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
  }

  function usernameKey(name) {
    return Array.from(normalizedName(name), character => character.codePointAt(0).toString(16)).join("-");
  }

  function createCommunityError(code) {
    return Object.assign(new Error(authErrors[code] || "Unable to complete this account change."), { code });
  }

  async function reserveUsername(name, user) {
    const key = usernameKey(name);
    if (!key || !user) throw createCommunityError("community/name-already-in-use");
    if (key === CREATOR_USERNAME_KEY && name !== CREATOR_NAME) throw createCommunityError("community/creator-name-exact");
    if (key === CREATOR_USERNAME_KEY) {
      const adminSnapshot = await db.ref("communityConfig/adminUid").once("value");
      if (adminSnapshot.exists() && adminSnapshot.val() !== user.uid) throw createCommunityError("community/admin-already-claimed");
    }
    let createdByThisCall = false;
    const result = await db.ref(`usernames/${key}`).transaction(existing => {
      if (!existing) {
        createdByThisCall = true;
        return { uid: user.uid, displayName: name, createdAt: Date.now() };
      }
      createdByThisCall = false;
      if (existing.uid !== user.uid) return;
      return { ...existing, displayName: name, updatedAt: Date.now() };
    });
    if (!result.committed) throw createCommunityError("community/name-already-in-use");
    return { key, created: createdByThisCall };
  }

  async function releaseUsername(key, uid) {
    if (!key || !uid || key === CREATOR_USERNAME_KEY) return;
    await db.ref(`usernames/${key}`).transaction(existing => existing?.uid === uid ? null : undefined);
  }

  async function claimCreatorAdmin(user, key) {
    if (key !== CREATOR_USERNAME_KEY) return;
    const ref = db.ref("communityConfig/adminUid");
    const current = await ref.once("value");
    if (current.exists() && current.val() !== user.uid) throw createCommunityError("community/admin-already-claimed");
    const result = await ref.transaction(existing => existing || user.uid);
    if (!result.committed || result.snapshot.val() !== user.uid) throw createCommunityError("community/admin-already-claimed");
  }

  async function verifyAccountUsername(user) {
    if (!user) return;
    try {
      const name = user.isAnonymous
        ? (localStorage.getItem(`communityUsername.${user.uid}`) || members[user.uid]?.displayName || `Guest-${user.uid}`)
        : await resolveAccountName(user);
      rememberAccountName(user, name);
      const reservation = await reserveUsername(name, user);
      await claimCreatorAdmin(user, reservation.key);
      if (auth.currentUser?.uid !== user.uid) return;
      usernameReady = true;
      await saveMemberProfile(user, name);
      updateProfileUI();
    } catch (error) {
      if (auth.currentUser?.uid !== user.uid) return;
      usernameReady = false;
      updateProfileUI();
      showToast(`${authErrorMessage(error)} Open your account settings to choose another display name.`);
    }
  }

  function requireAccount(action) {
    if (canWrite() && usernameReady) return true;
    if (currentUser?.isAnonymous) {
      openAccountDialog("signup");
      $("#auth-intro").textContent = "Your guest profile is getting ready. Try again shortly, or create an account to keep your name across devices.";
      return false;
    }
    if (canWrite()) {
      openAccountDialog("account");
      showMessage("profile-message", "Choose a display name that is not already in use before joining in.", true);
      return false;
    }
    openAccountDialog("signup");
    $("#auth-intro").textContent = `Create a free account to ${action}.`;
    return false;
  }

  function currentUsername() {
    return displayName();
  }

  function preferencesKey(kind) {
    return `commonroom.${kind}.${currentUser?.uid || "guest"}`;
  }

  function loadPreferences() {
    followingIds = new Set(safeLocalStorage(preferencesKey("following"), []));
    joinedSpaces = new Set(safeLocalStorage(preferencesKey("spaces"), spaces.map(space => space.name)));
  }

  function saveFollowing() {
    try { localStorage.setItem(preferencesKey("following"), JSON.stringify([...followingIds])); } catch (_) { showToast("Your browser couldn’t save that preference."); }
  }

  function saveSpaces() {
    try { localStorage.setItem(preferencesKey("spaces"), JSON.stringify([...joinedSpaces])); } catch (_) { showToast("Your browser couldn’t save that preference."); }
  }

  function hasSpace(name) {
    return joinedSpaces.has(name);
  }

  function openDialog(id) {
    const dialog = $("#" + id);
    if (dialog && !dialog.open) dialog.showModal();
  }

  function closeDialog(id) {
    const dialog = $("#" + id);
    if (dialog?.open) dialog.close();
  }

  function openComposer() {
    if (!requireAccount("start a conversation")) return;
    $("#post-author-hint").textContent = `Posting as ${currentUsername()}`;
    openDialog("composer-dialog");
    setTimeout(() => $("#post-title").focus(), 50);
  }

  function openAccountDialog(mode = "signin") {
    const authenticated = Boolean(currentUser && !currentUser.isAnonymous);
    $("#auth-panel").hidden = authenticated;
    $("#account-panel").hidden = !authenticated;
    $("#account-dialog-title").textContent = authenticated ? "Your account" : "Welcome in";
    if (authenticated) {
      const name = displayName();
      $("#account-display-name").textContent = name;
      $("#account-email").textContent = currentUser.email || "Email not available";
      $("#account-avatar").textContent = initials(name);
      $("#account-avatar").className = `avatar ${userAvatar()}`;
      $("#profile-display-name").value = name;
    } else {
      setAuthMode(currentUser?.isAnonymous ? "signup" : mode);
      if (currentUser?.isAnonymous) {
        $("#account-dialog-title").textContent = "Your guest account";
        $("#auth-intro").textContent = "Add an email and password to keep your guest name and posts on an account.";
      }
    }
    openDialog("account-dialog");
  }

  function setAuthMode(mode) {
    authMode = mode;
    const create = mode === "signup";
    $("#auth-panel").hidden = false;
    $("#account-panel").hidden = true;
    $("#account-dialog-title").textContent = create ? "Make yourself at home" : "Welcome back";
    $("#auth-intro").textContent = create
      ? currentUser?.isAnonymous
        ? "Add an email and password to keep your guest name and posts on this account."
        : "You can browse and join as a guest, or create an account to keep your place across devices."
      : "Good to see you again. Come on in.";
    $(".auth-name-field").hidden = !create;
    $("#auth-name-hint").hidden = !create;
    $(".auth-confirm-field").hidden = !create;
    $("#auth-password").autocomplete = create ? "new-password" : "current-password";
    $("#auth-submit").textContent = create ? "Create my account" : "Sign in";
    $("#forgot-password").hidden = create;
    document.querySelectorAll(".auth-tab").forEach(tab => {
      const selected = tab.dataset.authMode === mode;
      tab.classList.toggle("active", selected);
      tab.setAttribute("aria-selected", String(selected));
    });
    hideMessage("auth-message");
    if (create) {
      const savedName = currentUser?.uid ? localStorage.getItem(`communityUsername.${currentUser.uid}`) || "" : localStorage.getItem("communityUsername") || "";
      if (!$("#auth-name").value) $("#auth-name").value = savedName;
    }
  }

  function showMessage(id, message, error = false) {
    const element = $("#" + id);
    if (!element) return;
    element.textContent = message;
    element.hidden = false;
    element.classList.toggle("error", error);
  }

  function hideMessage(id) {
    const element = $("#" + id);
    if (element) { element.hidden = true; element.textContent = ""; element.classList.remove("error"); }
  }

  function authErrorMessage(error) {
    return authErrors[error?.code] || error?.message || "Something went wrong. Please try again.";
  }

  async function saveMemberProfile(user, name = displayName(user)) {
    if (!user) return;
    try {
      await db.ref(`members/${user.uid}`).update({
        uid: user.uid,
        displayName: name,
        updatedAt: Date.now()
      });
    } catch (error) {
      console.warn("Could not update the public member directory:", error);
    }
  }

  function updateProfileUI() {
    const signedIn = canWrite();
    const guest = Boolean(currentUser?.isAnonymous);
    const adminButton = $("#admin-button");
    if (adminButton) adminButton.hidden = !isAdmin();
    const name = signedIn ? displayName() : "Join";
    $("#profile-name").textContent = signedIn ? (name.split(/\s+/)[0] || name) : "Join";
    $("#profile-avatar").textContent = signedIn ? initials(name) : "?";
    $("#profile-avatar").className = `avatar ${signedIn ? userAvatar() : "avatar-maya"}`;
    $("#composer-avatar").textContent = signedIn ? initials(name) : "?";
    $("#composer-avatar").className = `avatar ${signedIn ? userAvatar() : "avatar-maya"}`;
    $("#profile-button").setAttribute("aria-label", guest ? `Guest profile, ${name}. Create an account to keep your place.` : signedIn ? `Your account, ${name}` : "Create an account or sign in");
    $("#profile-button").title = guest ? "Create an account to keep your place" : signedIn ? "Your account" : "Create an account or sign in";
    if (signedIn && usernameReady) saveMemberProfile(currentUser, name);
    renderPosts();
    renderPeople();
    renderSpaces();
    renderAdminReports();
  }

  function attachPosts() {
    if (postsRef) postsRef.off("value");
    postsRef = db.ref("posts");
    postsRef.on("value", snapshot => {
      const rawPosts = snapshot.val() || {};
      allPosts = Object.entries(rawPosts).map(([id, post]) => mapPost(id, post));
      renderPosts();
      updateNotificationDot();
      renderPeople();
      renderTopics();
      updateStats();
    }, error => {
      showToast(authErrorMessage(error));
      allPosts = [];
      renderPosts();
    });
  }

  function attachMembers() {
    if (membersRef) membersRef.off("value");
    membersRef = db.ref("members");
    membersRef.on("value", snapshot => {
      members = snapshot.val() || {};
      renderPeople();
      renderTopics();
      updateStats();
    }, () => {
      members = {};
      renderPeople();
      updateStats();
    });
  }

  function attachAdminConfig() {
    if (adminConfigRef) adminConfigRef.off("value");
    adminConfigRef = db.ref("communityConfig/adminUid");
    adminConfigRef.on("value", snapshot => {
      adminUid = snapshot.val() || null;
      updateProfileUI();
      attachReports();
    }, error => showToast(authErrorMessage(error)));
  }

  function attachReports() {
    if (reportsRef) reportsRef.off("value");
    reports = {};
    if (!isAdmin()) { renderAdminReports(); return; }
    reportsRef = db.ref("reports");
    reportsRef.on("value", snapshot => {
      reports = snapshot.val() || {};
      renderAdminReports();
    }, error => showToast(authErrorMessage(error)));
  }

  function renderAdminReports() {
    const list = $("#report-list");
    const counter = $("#open-report-count");
    if (!list || !counter) return;
    if (!isAdmin()) {
      list.innerHTML = `<p class="activity-empty">Sign in with the community admin account to review reports.</p>`;
      counter.textContent = "Admin access only";
      return;
    }
    const openReports = Object.entries(reports)
      .filter(([, report]) => report && report.status !== "resolved")
      .sort(([, first], [, second]) => (Number(second.timestamp) || 0) - (Number(first.timestamp) || 0));
    counter.textContent = `${openReports.length} open ${openReports.length === 1 ? "report" : "reports"}`;
    list.innerHTML = openReports.length ? openReports.map(([id, report]) => {
      const post = allPosts.find(item => item.id === report.postId);
      const title = post?.title || "Post no longer available";
      const excerpt = post?.body || "This post may have been removed.";
      return `<article class="report-card" data-report-id="${escapeHTML(id)}"><div class="report-card-head"><span class="report-mark">!</span><div><strong>${escapeHTML(title)}</strong><small>Reported ${escapeHTML(formatTime(report.timestamp))}</small></div></div><p>${escapeHTML(excerpt)}</p><div class="report-actions"><button class="secondary-button" data-admin-action="view" data-post-id="${escapeHTML(report.postId || "")}" ${post ? "" : "disabled"}>View post</button><button class="secondary-button" data-admin-action="dismiss" data-report-id="${escapeHTML(id)}">Dismiss</button><button class="secondary-button danger-button" data-admin-action="remove" data-report-id="${escapeHTML(id)}" data-post-id="${escapeHTML(report.postId || "")}" ${post ? "" : "disabled"}>Remove post</button></div></article>`;
    }).join("") : `<p class="activity-empty">You’re all caught up. New member reports will appear here.</p>`;
  }

  async function resolveReport(reportId, resolution) {
    if (!isAdmin() || !reportId) return;
    try {
      await db.ref(`reports/${reportId}`).update({
        status: "resolved",
        resolution,
        resolvedBy: currentUser.uid,
        resolvedAt: Date.now()
      });
      showToast(resolution === "removed" ? "Post removed and report resolved." : "Report dismissed.");
    } catch (error) { showToast(authErrorMessage(error)); }
  }

  function showReportedPost(postId) {
    if (!isAdmin() || !postId) return;
    activeView = "home";
    activeSpace = "All spaces";
    activeFeed = "for-you";
    query = "";
    $("#search-input").value = "";
    const matchingIndex = visiblePosts().findIndex(post => post.id === postId);
    visiblePostCount = Math.max(6, matchingIndex + 1);
    updateSelectedNavigation();
    renderPosts();
    closeDialog("admin-dialog");
    requestAnimationFrame(() => {
      const card = postList.querySelector(`[data-post-id="${CSS.escape(postId)}"]`);
      card?.scrollIntoView({ behavior: "smooth", block: "center" });
      card?.classList.add("report-highlight");
      if (card) setTimeout(() => card.classList.remove("report-highlight"), 1800);
    });
  }

  function visiblePosts() {
    let posts = [...allPosts];
    if (activeView === "saved") posts = posts.filter(post => post.saved);
    if (activeView === "my-posts") posts = posts.filter(post => post.author.id === currentUser?.uid);
    if (activeSpace !== "All spaces") posts = posts.filter(post => post.space === activeSpace);
    if (activeFeed === "following") posts = posts.filter(post => post.author.id === currentUser?.uid || followingIds.has(post.author.id));
    if (query) {
      const needle = query.toLowerCase();
      posts = posts.filter(post => [post.title, post.body, post.code, post.author.name, post.space, ...(post.tags || []), ...post.comments.map(comment => comment.text)].join(" ").toLowerCase().includes(needle));
    }
    posts.sort((first, second) => $("#sort-select").value === "popular" ? second.likes - first.likes : second.created - first.created);
    return posts;
  }

  function renderPost(post) {
    const own = post.author.id === currentUser?.uid;
    const admin = isAdmin();
    const canEdit = own || admin;
    const comments = post.comments || [];
    return `<article class="post-card" data-post-id="${escapeHTML(post.id)}">
      <div class="post-meta"><span class="avatar ${escapeHTML(post.author.avatar)}">${escapeHTML(post.author.initials)}</span><div class="post-author"><strong>${escapeHTML(post.author.name)}</strong><small>${escapeHTML(post.author.role)} · ${escapeHTML(post.time)}${post.edited ? " · edited" : ""}</small></div>
      <div class="post-menu-wrap"><button class="post-menu-button" data-action="menu" aria-label="Post options" aria-expanded="false">···</button></div></div>
      <span class="space-tag" data-space="${escapeHTML(post.space)}">${escapeHTML(post.space)}</span><h2 class="post-title">${escapeHTML(post.title)}</h2><p class="post-body">${escapeHTML(post.body)}</p>
      ${post.code ? `<details class="post-extra"><summary>Code &amp; extra details</summary><pre>${escapeHTML(post.code)}</pre></details>` : ""}
      ${post.tags?.length ? `<div class="post-tags">${post.tags.map(tag => `<span>#${escapeHTML(tag)}</span>`).join("")}</div>` : ""}
      <div class="post-actions"><button class="action-button ${post.liked ? "liked" : ""}" data-action="like" aria-label="Like post">${icon("heart")}<span>${post.likes}</span></button><button class="action-button" data-action="comments">${icon("comment")}<span>${comments.length} ${comments.length === 1 ? "reply" : "replies"}</span></button><span class="action-spacer"></span><button class="action-button ${post.saved ? "saved" : ""}" data-action="save" aria-label="${post.saved ? "Remove bookmark" : "Bookmark"}">${icon("bookmark")}</button><button class="action-button share-button" data-action="share" aria-label="Share post">${icon("share")}</button></div>
      <div class="comments" ${post.commentsOpen ? "" : "hidden"}><div class="comment-list">${comments.map(comment => renderComment(comment)).join("")}</div><form class="comment-reply-form"><span class="avatar ${escapeHTML(userAvatar())}">${escapeHTML(initials(canWrite() ? currentUsername() : "?"))}</span><input class="comment-input" name="comment" maxlength="500" required placeholder="Add something kind or curious…" aria-label="Write a reply"><button class="comment-submit" type="submit">Reply</button></form></div>
    </article>`;
  }

  function renderComment(comment) {
    const own = comment.userId === currentUser?.uid;
    const admin = isAdmin();
    return `<div class="comment" data-comment-id="${escapeHTML(comment.id)}"><span class="avatar ${escapeHTML(comment.author.avatar)}">${escapeHTML(comment.author.initials)}</span><div class="comment-content"><div class="comment-head"><strong>${escapeHTML(comment.author.name)}</strong><time>${escapeHTML(comment.time)}${comment.edited ? " · edited" : ""}</time></div><p>${escapeHTML(comment.text)}</p>${own || admin ? `<div class="comment-controls"><button data-action="edit-comment">Edit</button><button data-action="delete-comment">Delete</button></div>` : ""}</div></div>`;
  }

  function updateEmptyMessage() {
    const heading = $("#empty-state h2");
    const message = $("#empty-state p");
    if (activeView === "saved") { heading.textContent = "Nothing saved just yet"; message.textContent = "Bookmark a post and it’ll be waiting here when you need it."; }
    else if (activeView === "my-posts") { heading.textContent = "Your story starts here"; message.textContent = canWrite() ? "Share a thought or a small win with the room." : "Create an account to start your own conversations."; }
    else if (query) { heading.textContent = "No conversations found"; message.textContent = "Try a different word or start a new conversation."; }
    else { heading.textContent = "The room is getting ready"; message.textContent = "Be the first to share something. Your people are here."; }
    $("#empty-create").textContent = canWrite() ? "＋ Start a conversation" : "＋ Create an account";
  }

  function renderPosts() {
    const posts = visiblePosts();
    postList.innerHTML = posts.slice(0, visiblePostCount).map(renderPost).join("");
    const empty = posts.length === 0;
    emptyState.hidden = !empty;
    postList.hidden = empty;
    $("#load-more").hidden = posts.length <= visiblePostCount;
    $("#load-more").textContent = `Load more conversations · ${Math.max(0, posts.length - visiblePostCount)} remaining`;
    const hasFilter = activeSpace !== "All spaces" || activeView !== "home" || query || activeFeed !== "for-you";
    activeFilter.hidden = !hasFilter;
    if (hasFilter) {
      $("#filter-label").textContent = [activeSpace !== "All spaces" ? activeSpace : null, activeView === "saved" ? "Saved posts" : activeView === "my-posts" ? "My posts" : null, activeFeed === "following" ? "Following" : null, query ? `Search: “${query}”` : null].filter(Boolean).join(" · ") || "Filtered feed";
    }
    updateEmptyMessage();
  }

  function allMembers() {
    const result = new Map();
    Object.entries(members).forEach(([uid, profile]) => result.set(uid, {
      id: uid, name: profile.displayName || "Community member", initials: initials(profile.displayName || "Member"), avatar: avatarClass(uid), about: "Community member", updatedAt: Number(profile.updatedAt) || 0
    }));
    allPosts.forEach(post => {
      const id = post.author.id;
      if (!id || id.startsWith("legacy:") || result.has(id)) return;
      result.set(id, { id, name: post.author.name, initials: post.author.initials, avatar: post.author.avatar, about: "Sharing with the room", updatedAt: post.created });
    });
    if (canWrite()) result.set(currentUser.uid, { id: currentUser.uid, name: displayName(), initials: initials(displayName()), avatar: userAvatar(), about: "You’re in the room", updatedAt: Date.now() });
    return [...result.values()].sort((first, second) => second.updatedAt - first.updatedAt);
  }

  function memberRow(member, directory = false) {
    if (member.id === currentUser?.uid && !directory) return "";
    const following = followingIds.has(member.id);
    return `<div class="person-row"><span class="avatar ${escapeHTML(member.avatar)}">${escapeHTML(member.initials)}</span><div class="person-info"><strong>${escapeHTML(member.name)}${member.id === currentUser?.uid ? " · you" : ""}</strong><span>${escapeHTML(member.about)}</span></div>${member.id !== currentUser?.uid ? `<button class="follow-button ${following ? "following" : ""}" data-follow="${escapeHTML(member.id)}">${following ? "Following" : "Follow +"}</button>` : ""}</div>`;
  }

  function renderPeople() {
    const people = allMembers().filter(person => person.id !== currentUser?.uid).slice(0, 3);
    $("#people-list").innerHTML = people.length ? people.map(member => memberRow(member)).join("") : `<p class="side-caption">New members will show up here as they join the conversation.</p>`;
    $("#members-list").innerHTML = allMembers().length ? allMembers().map(member => memberRow(member, true)).join("") : `<p class="side-caption">You’re the first one here. Start a conversation and invite someone in.</p>`;
  }

  function renderTopics() {
    const counts = new Map(spaces.map(space => [space.name, 0]));
    allPosts.forEach(post => counts.set(post.space, (counts.get(post.space) || 0) + 1));
    const topics = spaces.map(space => ({ ...space, count: counts.get(space.name) || 0 })).filter(space => space.count > 0).sort((a, b) => b.count - a.count).slice(0, 3);
    $("#trending-list").innerHTML = topics.length ? topics.map((space, index) => `<div class="trending-topic" role="button" tabindex="0" data-space-topic="${escapeHTML(space.name)}"><span class="trend-number">0${index + 1}</span><span class="trend-copy"><strong>${escapeHTML(space.name)}</strong><span>${space.count} ${space.count === 1 ? "conversation" : "conversations"}</span></span><span class="trend-arrow">↗</span></div>`).join("") : `<p class="side-caption">The first conversations will set the tone.</p>`;
  }

  function updateStats() {
    const ids = new Set(allPosts.map(post => post.author.id).filter(id => id && !id.startsWith("legacy:")));
    Object.keys(members).forEach(id => ids.add(id));
    if (canWrite()) ids.add(currentUser.uid);
    $("#member-count").textContent = ids.size.toLocaleString();
  }

  function renderSpaces() {
    const selected = activeSpace;
    const items = spaces.filter(space => hasSpace(space.name));
    $("#spaces-list").innerHTML = `<button class="space-link ${selected === "All spaces" ? "selected" : ""}" data-space="All spaces"><span class="space-emoji">✳</span>All spaces</button>${items.map(space => `<button class="space-link ${selected === space.name ? "selected" : ""}" data-space="${escapeHTML(space.name)}"><span class="space-emoji ${space.tone}">${space.icon}</span>${escapeHTML(space.name)}</button>`).join("")}`;
    $("#space-explorer").innerHTML = spaces.map(space => `<div class="explore-space"><span class="space-emoji ${space.tone}">${space.icon}</span><div><strong>${escapeHTML(space.name)}</strong><span>${categoryDescription(space.category)}</span></div><button class="follow-button ${hasSpace(space.name) ? "following" : ""}" data-join-space="${escapeHTML(space.name)}">${hasSpace(space.name) ? "Joined" : "Join +"}</button></div>`).join("");
  }

  function categoryDescription(category) {
    return ({ project: "Projects, craft, and works in progress", help: "Small routines and everyday life", question: "Curiosity, ideas, and open questions", release: "Wins worth celebrating" })[category];
  }

  function icon(name) {
    const paths = {
      heart: '<path d="M20.8 8.8c0 4.5-8.8 10-8.8 10s-8.8-5.5-8.8-10A4.6 4.6 0 0 1 12 6.2a4.6 4.6 0 0 1 8.8 2.6Z"/>',
      comment: '<path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.7 8.7 0 0 1-3.2-.6L4 20l1.3-3.6A7.2 7.2 0 0 1 4 12c0-4.2 3.6-7.5 8-7.5s8 2.8 8 7Z"/>',
      bookmark: '<path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4z"/>',
      share: '<path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
  }

  function postRef(id) {
    return db.ref(`posts/${id}`);
  }

  function editPost(post, card) {
    const titleElement = card.querySelector(".post-title");
    const bodyElement = card.querySelector(".post-body");
    const form = document.createElement("form");
    form.className = "post-edit-form";
    form.innerHTML = `<label class="field-label">Title<input class="text-field title-field" name="title" maxlength="100" required value="${escapeHTML(post.title)}"></label><label class="field-label">Post<textarea class="text-field body-field" name="body" maxlength="800" required>${escapeHTML(post.body)}</textarea></label><label class="field-label">Code or extra details<textarea class="text-field body-field" name="code" maxlength="5000">${escapeHTML(post.code)}</textarea></label><div class="post-edit-actions"><button type="button" data-action="cancel-edit">Cancel</button><button type="submit">Save changes</button></div>`;
    bodyElement.after(form);
    titleElement.hidden = true;
    bodyElement.hidden = true;
    form.querySelector("[name=title]").focus();
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const title = form.elements.title.value.trim();
      const body = form.elements.body.value.trim();
      const code = form.elements.code.value.trim();
      if (!title || !body) { showToast("A post needs a title and a little context."); return; }
      try {
        await postRef(post.id).update({ title, content: body, code, edited: true, editedAt: Date.now() });
        showToast("Your post is updated.");
      } catch (error) { showToast(authErrorMessage(error)); }
    });
    form.querySelector("[data-action=cancel-edit]").addEventListener("click", renderPosts);
  }

  function editComment(post, comment) {
    const commentElement = document.querySelector(`[data-post-id="${CSS.escape(post.id)}"] [data-comment-id="${CSS.escape(comment.id)}"]`);
    const paragraph = commentElement?.querySelector(".comment-content p");
    if (!paragraph) return;
    const form = document.createElement("form");
    form.className = "comment-edit-form";
    form.innerHTML = `<textarea maxlength="500" required aria-label="Edit reply">${escapeHTML(comment.text)}</textarea><div><button type="button" data-cancel>Cancel</button><button type="submit">Save</button></div>`;
    paragraph.replaceWith(form);
    form.querySelector("textarea").focus();
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const text = form.querySelector("textarea").value.trim();
      if (!text) return;
      try {
        await db.ref(`posts/${post.id}/comments/${comment.id}`).update({ content: text, edited: true, editedTime: Date.now() });
        showToast("Your reply is updated.");
      } catch (error) { showToast(authErrorMessage(error)); }
    });
    form.querySelector("[data-cancel]").addEventListener("click", renderPosts);
  }

  async function submitComment(form) {
    if (!requireAccount("reply to a conversation")) return;
    const card = form.closest(".post-card");
    const post = allPosts.find(item => item.id === card?.dataset.postId);
    const content = form.elements.comment.value.trim();
    if (!post || !content) return;
    const commentRef = db.ref(`posts/${post.id}/comments`).push();
    const comment = { id: commentRef.key, username: currentUsername(), content, timestamp: Date.now(), userId: currentUser.uid, edited: false };
    try {
      await commentRef.set(comment);
      openComments.add(post.id);
      showToast("Your reply is in the room.");
    } catch (error) { showToast(authErrorMessage(error)); }
  }

  async function toggleReaction(post, type) {
    if (!requireAccount(type === "likes" ? "like a post" : "save a post")) return;
    const current = type === "likes" ? post.liked : post.saved;
    const updates = {};
    updates[`${type}/${currentUser.uid}`] = current ? null : { timestamp: Date.now() };
    if (type === "likes") updates[`dislikes/${currentUser.uid}`] = null;
    try {
      await postRef(post.id).update(updates);
    } catch (error) { showToast(authErrorMessage(error)); }
  }

  async function createPost(event) {
    event.preventDefault();
    if (!requireAccount("start a conversation")) return;
    const title = $("#post-title").value.trim();
    const content = $("#post-body").value.trim();
    if (!title || !content) return;
    const selectedSpace = spaces.find(space => space.name === $("#post-space").value) || spaces[2];
    const postRefNew = db.ref("posts").push();
    const post = {
      id: postRefNew.key,
      username: currentUsername(),
      title,
      category: selectedSpace.category,
      content,
      code: "",
      timestamp: Date.now(),
      userId: currentUser.uid,
      likes: {},
      dislikes: {},
      favorites: {},
      comments: {},
      edited: false
    };
    const submit = $("#post-form button[type=submit]");
    submit.disabled = true;
    try {
      await postRefNew.set(post);
      $("#post-form").reset();
      $("#character-count").textContent = "0 / 800";
      closeDialog("composer-dialog");
      activeView = "home";
      activeSpace = "All spaces";
      activeFeed = "for-you";
      query = "";
      $("#search-input").value = "";
      updateSelectedNavigation();
      showToast("Your conversation is live.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) { showToast(authErrorMessage(error)); }
    finally { submit.disabled = false; }
  }

  function updateSelectedNavigation() {
    document.querySelectorAll(".nav-item[data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === activeView));
    document.querySelectorAll(".feed-tab").forEach(button => {
      const selected = button.dataset.feed === activeFeed;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", String(selected));
    });
    renderSpaces();
  }

  function openNotifications() {
    renderNotifications();
    openDialog("notifications-dialog");
    if (currentUser) localStorage.setItem(`commonroom.notifications-read.${currentUser.uid}`, String(Date.now()));
    updateNotificationDot();
  }

  function renderNotifications() {
    if (!currentUser) {
      $("#activity-list").innerHTML = `<p class="activity-empty">Sign in to see activity on your conversations.</p>`;
      return;
    }
    const items = [];
    const lastRead = Number(localStorage.getItem(`commonroom.notifications-read.${currentUser.uid}`) || 0);
    allPosts.filter(post => post.author.id === currentUser.uid).forEach(post => {
      post.comments.filter(comment => comment.userId !== currentUser.uid).forEach(comment => items.push({ id: `${post.id}:${comment.id}`, created: comment.created, text: `<strong>${escapeHTML(comment.author.name)}</strong> replied to <b>${escapeHTML(post.title)}</b>`, unread: comment.created > lastRead }));
      const rawLikes = post._rawLikes || {};
      const otherLikes = Object.entries(rawLikes).filter(([uid]) => uid !== currentUser.uid);
      if (otherLikes.length) {
        const latestLike = Math.max(...otherLikes.map(([, value]) => Number(value?.timestamp) || post.created));
        items.push({ id: `${post.id}:likes`, created: latestLike, text: `<strong>${otherLikes.length} ${otherLikes.length === 1 ? "person likes" : "people like"}</strong> your post <b>${escapeHTML(post.title)}</b>`, unread: latestLike > lastRead });
      }
    });
    items.sort((first, second) => second.created - first.created);
    $("#activity-list").innerHTML = items.length ? items.map(item => `<div class="activity-item ${item.unread ? "unread" : ""}"><span class="activity-mark">✳</span><div><p>${item.text}</p><small>${escapeHTML(formatTime(item.created))}</small></div></div>`).join("") : `<p class="activity-empty">No activity yet. Replies and reactions to your posts will appear here.</p>`;
  }

  function updateNotificationDot() {
    const dot = $("#notification-dot");
    if (!dot) return;
    if (!currentUser) { dot.style.display = "none"; return; }
    const lastRead = Number(localStorage.getItem(`commonroom.notifications-read.${currentUser.uid}`) || 0);
    const unread = allPosts.some(post => post.author.id === currentUser.uid && (
      post.comments.some(comment => comment.userId !== currentUser.uid && comment.created > lastRead) ||
      Object.entries(post._rawLikes || {}).some(([uid, value]) => uid !== currentUser.uid && (Number(value?.timestamp) || post.created) > lastRead)
    ));
    dot.style.display = unread ? "block" : "none";
  }

  function setAuthError(error) {
    const message = authErrorMessage(error);
    if (error?.code === "auth/email-already-in-use" || error?.code === "auth/credential-already-in-use") setAuthMode("signin");
    showMessage("auth-message", message, true);
  }

  async function submitAuth(event) {
    event.preventDefault();
    if (!auth) { showMessage("auth-message", "Firebase Authentication is not available.", true); return; }
    const submittingSignup = authMode === "signup";
    if (submittingSignup) registrationInProgress = true;
    if (!authReady) await authReadyPromise;
    if (anonymousLoginPromise) await anonymousLoginPromise;
    hideMessage("auth-message");
    const email = $("#auth-email").value.trim();
    const password = $("#auth-password").value;
    const button = $("#auth-submit");
    button.disabled = true;
    button.textContent = submittingSignup ? "Creating your account…" : "Signing in…";
    let signupSucceeded = false;
    let signupAccountRemoved = false;
    try {
      if (submittingSignup) {
        const name = $("#auth-name").value.trim().replace(/\s+/gu, " ");
        const confirmation = $("#auth-confirm").value;
        if (Array.from(name).length < 2) throw new Error("Please enter a name of at least 2 characters.");
        if (Array.from(name).length > 40) throw new Error("Please keep your name to 40 characters or fewer.");
        if (password.length < 6) throw Object.assign(new Error(), { code: "auth/weak-password" });
        if (password !== confirmation) throw new Error("Those passwords don’t match yet.");
        let result;
        let reservation;
        if (auth.currentUser?.isAnonymous) {
          const guest = auth.currentUser;
          const credential = firebase.auth.EmailAuthProvider.credential(email, password);
          const canReserveBeforeLink = usernameKey(name) !== CREATOR_USERNAME_KEY;
          if (!canReserveBeforeLink) {
            result = await guest.linkWithCredential(credential);
            await result.user.getIdToken(true);
            reservation = await reserveUsername(name, result.user);
          } else {
            reservation = await reserveUsername(name, guest);
            try {
              result = await guest.linkWithCredential(credential);
            } catch (error) {
              if (reservation.created) await releaseUsername(reservation.key, guest.uid).catch(() => {});
              throw error;
            }
          }
          const previousGuestName = localStorage.getItem(`communityUsername.${guest.uid}`) || members[guest.uid]?.displayName || `Guest-${guest.uid}`;
          const previousGuestKey = usernameKey(previousGuestName);
          if (previousGuestKey !== reservation.key) await releaseUsername(previousGuestKey, guest.uid).catch(error => console.warn("Could not release the temporary guest name:", error));
        } else {
          result = await auth.createUserWithEmailAndPassword(email, password);
          try {
            reservation = await reserveUsername(name, result.user);
          } catch (error) {
            try { await result.user.delete(); signupAccountRemoved = true; } catch (_) {}
            throw error;
          }
        }
        currentUser = result.user;
        try {
          await claimCreatorAdmin(result.user, reservation.key);
        } catch (error) {
          if (reservation.created) await releaseUsername(reservation.key, result.user.uid).catch(() => {});
          throw error;
        }
        usernameReady = true;
        signupSucceeded = true;
        rememberAccountName(result.user, name);
        await saveMemberProfile(result.user, name);
        closeDialog("account-dialog");
        showToast(normalizedName(name) === normalizedName(CREATOR_NAME) ? "Welcome, Creator. Your admin account is ready." : `Welcome to the room, ${name.split(/\s+/)[0]}.`);
      } else {
        const result = await auth.signInWithEmailAndPassword(email, password);
        currentUser = result.user;
        try {
          const name = await resolveAccountName(result.user);
          rememberAccountName(result.user, name);
          const reservation = await reserveUsername(name, result.user);
          await claimCreatorAdmin(result.user, reservation.key);
          usernameReady = true;
          await saveMemberProfile(result.user, name);
          closeDialog("account-dialog");
          showToast("Welcome back.");
        } catch (error) {
          usernameReady = false;
          closeDialog("account-dialog");
          openAccountDialog("account");
          showMessage("profile-message", `${authErrorMessage(error)} Update your display name in your account settings.`, true);
        }
      }
    } catch (error) {
      if (submittingSignup && !signupAccountRemoved && auth.currentUser && !auth.currentUser.isAnonymous) {
        currentUser = auth.currentUser;
        closeDialog("account-dialog");
        openAccountDialog("account");
        showMessage("profile-message", `${authErrorMessage(error)} Choose another display name in your account settings.`, true);
      } else setAuthError(error);
    }
    finally {
      if (submittingSignup) {
        registrationInProgress = false;
        if (signupSucceeded) updateProfileUI();
      }
      button.disabled = false;
      button.textContent = submittingSignup ? "Create my account" : "Sign in";
    }
  }

  async function resetPassword(email, messageId = "auth-message") {
    const address = (email || $("#auth-email").value).trim();
    if (!address) { showMessage(messageId, "Enter your email address first.", true); return; }
    try {
      await auth.sendPasswordResetEmail(address);
      showMessage(messageId, "Password reset email sent. Check your inbox.");
    } catch (error) { showMessage(messageId, authErrorMessage(error), true); }
  }

  function initAuthentication() {
    auth.onAuthStateChanged(user => {
      currentUser = user;
      if (!authReady) { authReady = true; resolveAuthReady(); }
      loadPreferences();
      if (user) {
        attachPosts();
        attachMembers();
        attachAdminConfig();
        if (!registrationInProgress) {
          usernameReady = false;
          verifyAccountUsername(user);
        }
      } else {
        if (postsRef) { postsRef.off("value"); postsRef = null; }
        if (membersRef) { membersRef.off("value"); membersRef = null; }
        if (reportsRef) { reportsRef.off("value"); reportsRef = null; }
        if (adminConfigRef) { adminConfigRef.off("value"); adminConfigRef = null; }
        adminUid = null;
        usernameReady = false;
        reports = {};
        allPosts = [];
        members = {};
        renderPosts(); renderPeople(); renderTopics(); updateStats();
        renderAdminReports();
      }
      updateProfileUI();
      updateStats();
      if (firstAuthEvent) {
        firstAuthEvent = false;
        if (!user) anonymousLoginPromise = auth.signInAnonymously().catch(error => showToast(error?.code === "auth/operation-not-allowed" ? "Guest browsing is disabled. Email/password signup is still available." : authErrorMessage(error))).finally(() => { anonymousLoginPromise = null; });
      }
    }, error => showToast(authErrorMessage(error)));
  }

  function attachEvents() {
    $("#profile-button").addEventListener("click", () => openAccountDialog(canWrite() ? "account" : "signup"));
    $("#admin-button").addEventListener("click", () => {
      if (!isAdmin()) return;
      renderAdminReports();
      openDialog("admin-dialog");
    });
    $("#report-list").addEventListener("click", async event => {
      const button = event.target.closest("[data-admin-action]");
      if (!button || !isAdmin()) return;
      const action = button.dataset.adminAction;
      if (action === "view") { showReportedPost(button.dataset.postId); return; }
      const reportId = button.dataset.reportId;
      if (action === "dismiss") return resolveReport(reportId, "dismissed");
      if (action === "remove") {
        if (!window.confirm("Remove this reported post and resolve the report? This cannot be undone.")) return;
        const postId = button.dataset.postId;
        try {
          if (postId) await postRef(postId).remove();
          await resolveReport(reportId, "removed");
        } catch (error) { showToast(authErrorMessage(error)); }
      }
    });
    $("#close-account").addEventListener("click", () => closeDialog("account-dialog"));
    $("#account-dialog").addEventListener("click", event => { if (event.target.classList.contains("dialog-scrim")) closeDialog("account-dialog"); });
    document.querySelectorAll(".auth-tab").forEach(button => button.addEventListener("click", () => setAuthMode(button.dataset.authMode)));
    $("#auth-form").addEventListener("submit", submitAuth);
    $("#forgot-password").addEventListener("click", () => resetPassword());
    $("#send-reset-email").addEventListener("click", () => resetPassword(currentUser?.email, "profile-message"));
    $("#sign-out-button").addEventListener("click", async () => {
      try { await auth.signOut(); closeDialog("account-dialog"); showToast("You’re signed out. Come back any time."); }
      catch (error) { showMessage("profile-message", authErrorMessage(error), true); }
    });
    $("#profile-form").addEventListener("submit", async event => {
      event.preventDefault();
      const name = $("#profile-display-name").value.trim().replace(/\s+/gu, " ");
      if (Array.from(name).length < 2 || Array.from(name).length > 40 || !currentUser) { showMessage("profile-message", "Please enter a name between 2 and 40 characters.", true); return; }
      const previousName = displayName();
      const previousKey = usernameKey(previousName);
      let reservation;
      try {
        reservation = await reserveUsername(name, currentUser);
        await claimCreatorAdmin(currentUser, reservation.key);
        usernameReady = true;
        rememberAccountName(currentUser, name);
        await saveMemberProfile(currentUser, name);
        if (previousKey !== reservation.key) await releaseUsername(previousKey, currentUser.uid).catch(error => console.warn("Could not release the old display name:", error));
        $("#account-display-name").textContent = name;
        $("#account-avatar").textContent = initials(name);
        updateProfileUI();
        showMessage("profile-message", "Your profile is updated.");
      } catch (error) {
        if (reservation?.created && reservation.key !== previousKey) await releaseUsername(reservation.key, currentUser.uid).catch(() => {});
        showMessage("profile-message", authErrorMessage(error), true);
      }
    });

    $("#compose-button").addEventListener("click", openComposer);
    $("#open-composer").addEventListener("click", openComposer);
    $("#empty-create").addEventListener("click", () => canWrite() ? openComposer() : openAccountDialog("signup"));
    $("#close-composer").addEventListener("click", () => closeDialog("composer-dialog"));
    $("#composer-dialog").addEventListener("click", event => { if (event.target.classList.contains("dialog-scrim")) closeDialog("composer-dialog"); });
    $("#post-form").addEventListener("submit", createPost);
    $("#post-body").addEventListener("input", event => { $("#character-count").textContent = `${event.target.value.length} / 800`; });

    postList.addEventListener("click", async event => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      const card = button.closest(".post-card");
      const post = allPosts.find(item => item.id === card?.dataset.postId);
      if (!post) return;
      const action = button.dataset.action;
      if (action === "like") return toggleReaction(post, "likes");
      if (action === "save") return toggleReaction(post, "favorites");
      if (action === "comments") {
        if (openComments.has(post.id)) openComments.delete(post.id); else openComments.add(post.id);
        renderPosts();
        if (openComments.has(post.id)) document.querySelector(`[data-post-id="${CSS.escape(post.id)}"] .comment-input`)?.focus();
        return;
      }
      if (action === "menu") {
        document.querySelectorAll(".post-menu").forEach(menu => menu.remove());
        const menu = document.createElement("div");
        menu.className = "post-menu";
        menu.innerHTML = post.author.id === currentUser?.uid || isAdmin()
          ? `<button data-action="edit-post">Edit post</button><button data-action="delete-post">Delete post</button>`
          : `<button data-action="report-post">Report post</button>`;
        button.after(menu);
        button.setAttribute("aria-expanded", "true");
        return;
      }
      if (action === "edit-post") { button.closest(".post-menu")?.remove(); editPost(post, card); return; }
      if (action === "delete-post") {
        button.closest(".post-menu")?.remove();
        if (!window.confirm("Delete this post and its replies? This cannot be undone.")) return;
        try { await postRef(post.id).remove(); showToast("Your post was removed."); }
        catch (error) { showToast(authErrorMessage(error)); }
        return;
      }
      if (action === "share") {
        const url = `${location.href.split("#")[0]}#${post.id}`;
        try { await navigator.clipboard.writeText(url); showToast("Post link copied."); }
        catch (_) { showToast("Copy the page link to share this conversation."); }
        return;
      }
      if (action === "report-post") {
        if (!requireAccount("report a post")) return;
        try { await db.ref("reports").push({ postId: post.id, reporterId: currentUser.uid, timestamp: Date.now(), status: "open" }); showToast("Thanks for looking out for the room."); }
        catch (error) { showToast(authErrorMessage(error)); }
        return;
      }
      const commentElement = button.closest(".comment");
      const comment = post.comments.find(item => item.id === commentElement?.dataset.commentId);
      if (action === "edit-comment" && comment) editComment(post, comment);
      if (action === "delete-comment" && comment) {
        if (!window.confirm("Delete this reply? This cannot be undone.")) return;
        try { await db.ref(`posts/${post.id}/comments/${comment.id}`).remove(); showToast("Your reply was removed."); }
        catch (error) { showToast(authErrorMessage(error)); }
      }
    });

    postList.addEventListener("submit", event => {
      const form = event.target.closest(".comment-reply-form");
      if (!form) return;
      event.preventDefault();
      submitComment(form);
    });

    document.querySelectorAll(".space-link").forEach(button => button.addEventListener("click", () => setActiveSpace(button.dataset.space)));
    $("#spaces-list").addEventListener("click", event => {
      const button = event.target.closest(".space-link");
      if (button) setActiveSpace(button.dataset.space);
    });
    document.querySelectorAll(".nav-item[data-view]").forEach(button => button.addEventListener("click", () => {
      activeView = button.dataset.view; activeSpace = "All spaces"; visiblePostCount = 6; updateSelectedNavigation(); renderPosts();
    }));
    document.querySelectorAll(".feed-tab").forEach(button => button.addEventListener("click", () => { activeFeed = button.dataset.feed; visiblePostCount = 6; updateSelectedNavigation(); renderPosts(); }));
    $("#sort-select").addEventListener("change", renderPosts);
    $("#trend-sort-button").addEventListener("click", () => { $("#sort-select").value = $("#sort-select").value === "popular" ? "recent" : "popular"; renderPosts(); showToast($("#sort-select").value === "popular" ? "Showing the most loved first." : "Showing the newest first."); });
    $("#load-more").addEventListener("click", () => { visiblePostCount += 6; renderPosts(); });
    $("#search-input").addEventListener("input", event => { query = event.target.value.trim(); visiblePostCount = 6; renderPosts(); });
    $("#clear-filter").addEventListener("click", () => {
      activeSpace = "All spaces"; activeView = "home"; activeFeed = "for-you"; query = ""; visiblePostCount = 6; $("#search-input").value = ""; updateSelectedNavigation(); renderPosts();
    });
    $("#people-list").addEventListener("click", toggleFollow);
    $("#members-list").addEventListener("click", toggleFollow);
    $("#see-people").addEventListener("click", () => { renderPeople(); openDialog("members-dialog"); });
    $("#trending-list").addEventListener("click", event => { const topic = event.target.closest("[data-space-topic]"); if (topic) setActiveSpace(topic.dataset.spaceTopic); });
    $("#trending-list").addEventListener("keydown", event => { if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-space-topic]")) { event.preventDefault(); setActiveSpace(event.target.dataset.spaceTopic); } });
    $("#add-space-button").addEventListener("click", () => { renderSpaces(); openDialog("spaces-dialog"); });
    $("#space-explorer").addEventListener("click", event => {
      const button = event.target.closest("[data-join-space]");
      if (!button) return;
      const name = button.dataset.joinSpace;
      if (joinedSpaces.has(name)) joinedSpaces.delete(name); else joinedSpaces.add(name);
      saveSpaces(); renderSpaces();
      if (activeSpace === name && !joinedSpaces.has(name)) setActiveSpace("All spaces");
    });
    $("#notifications-button").addEventListener("click", openNotifications);
    $("#settings-button").addEventListener("click", () => openAccountDialog(canWrite() ? "account" : "signup"));
    const infoPages = {
      about: ["About Commonroom", "Commonroom is a place to share work in progress, ask honest questions, and notice small wins. Posts and replies stay connected through the community’s Firebase database."],
      guidelines: ["Community guidelines", "Be kind and curious. Critique ideas without attacking people. Don’t post private information, spam, or content you don’t have permission to share. Use the report option if something feels wrong."],
      privacy: ["Privacy", "Email addresses and passwords are handled by Firebase Authentication. Posts, replies, and display names are stored in the community’s Firebase Realtime Database. The public member directory stores display names and user IDs, not email addresses. This page never stores your password."]
    };
    document.querySelectorAll("[data-info]").forEach(button => button.addEventListener("click", () => {
      const [title, text] = infoPages[button.dataset.info];
      $("#info-title").textContent = title;
      $("#info-copy").textContent = text;
      openDialog("info-dialog");
    }));
    document.querySelectorAll("[data-close-dialog]").forEach(button => button.addEventListener("click", () => closeDialog(button.dataset.closeDialog)));
    document.querySelectorAll(".composer-dialog").forEach(dialog => dialog.addEventListener("click", event => { if (event.target.classList.contains("dialog-scrim")) dialog.close(); }));
    document.addEventListener("click", event => { if (!event.target.closest(".post-menu-wrap")) document.querySelectorAll(".post-menu").forEach(menu => menu.remove()); });
    $(".top-search").addEventListener("click", event => { if (window.innerWidth <= 690 && !event.target.closest("input")) { event.currentTarget.classList.add("search-open"); $("#search-input").focus(); } });
    document.addEventListener("click", event => { if (window.innerWidth <= 690 && !event.target.closest(".top-search")) $(".top-search").classList.remove("search-open"); });
    document.addEventListener("keydown", event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); $("#search-input").focus(); }
      if (event.key === "Escape") document.querySelectorAll(".post-menu").forEach(menu => menu.remove());
    });
  }

  function toggleFollow(event) {
    const button = event.target.closest("[data-follow]");
    if (!button) return;
    if (!requireAccount("follow members")) return;
    const id = button.dataset.follow;
    if (followingIds.has(id)) followingIds.delete(id); else followingIds.add(id);
    saveFollowing();
    renderPeople();
    renderPosts();
    showToast(followingIds.has(id) ? "You’ll see more from them." : "You unfollowed this person.");
  }

  function setActiveSpace(space) {
    activeView = "home";
    activeSpace = space;
    visiblePostCount = 6;
    updateSelectedNavigation();
    renderPosts();
  }

  function initialize() {
    const date = new Date();
    $("#today-label").textContent = `YOUR ${date.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase()} MOMENT`;
    $("#auth-name").value = localStorage.getItem("communityUsername") || "";
    renderSpaces(); renderPosts(); renderPeople(); renderTopics();
    attachEvents();
    if (!auth || !db) {
      showToast("The community connection is unavailable. Check Firebase setup.");
      return;
    }
    initAuthentication();
  }

  initialize();
})();
