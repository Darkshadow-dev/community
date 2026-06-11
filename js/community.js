/*====================================
  🔐 FIREBASE AUTH + ADMIN SYSTEM
====================================*/

const ADMIN_UID = "CR4bUnDwgQaYsxN8aGe55ZwCc792"; // <-- ONLY YOU

let userId = null;
let authReady = false;

// Anonymous login
firebase.auth().signInAnonymously();

// Get real UID
firebase.auth().onAuthStateChanged(user => {
  if (user) {
    userId = user.uid;
    authReady = true;
  }
});


/*====================================
  🔧 HELPERS
====================================*/

const $ = id => document.getElementById(id);

const postsWrap = document.getElementById("communityPosts");
const form = document.getElementById("uploadForm");
const popup = document.getElementById("popup");

const postWindow = document.getElementById("postWindow");
const openCreatorBtn = document.getElementById("openCreatorBtn");
const closeWindow = document.getElementById("closeWindow");
const minimizeWindow = document.getElementById("minimizeWindow");
const windowContent = document.getElementById("windowContent");

const sortPosts = document.getElementById("sortPosts");

let allPosts = [];
let visiblePosts = 6;

/* WINDOW */

openCreatorBtn.onclick = ()=>{
  postWindow.classList.remove("hidden");
};

closeWindow.onclick = ()=>{
  postWindow.classList.add("hidden");
};

minimizeWindow.onclick = ()=>{
  windowContent.classList.toggle("hidden");
};

/* DRAG */

dragWindow(postWindow, document.getElementById("windowDrag"));

function dragWindow(el, handle){

  let x = 0;
  let y = 0;

  handle.onmousedown = dragMouseDown;

  function dragMouseDown(e){
    e.preventDefault();

    x = e.clientX;
    y = e.clientY;

    document.onmouseup = closeDrag;
    document.onmousemove = drag;
  }

  function drag(e){

    e.preventDefault();

    const dx = x - e.clientX;
    const dy = y - e.clientY;

    x = e.clientX;
    y = e.clientY;

    el.style.top = (el.offsetTop - dy) + "px";
    el.style.left = (el.offsetLeft - dx) + "px";
    el.style.transform = "none";
  }

  function closeDrag(){
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

/* POPUP */

function showPopup(text){

  popup.innerText = text;

  popup.classList.add("show");

  setTimeout(()=>{
    popup.classList.remove("show");
  }, 1800);
}

/* CONFIRM */

function customConfirm(title, text, callback){

  const overlay = document.getElementById("confirmOverlay");

  document.getElementById("confirmTitle").innerText = title;
  document.getElementById("confirmText").innerText = text;

  overlay.classList.remove("hidden");

  document.getElementById("confirmYes").onclick = ()=>{
    overlay.classList.add("hidden");
    callback(true);
  };

  document.getElementById("confirmNo").onclick = ()=>{
    overlay.classList.add("hidden");
    callback(false);
  };
}

/* CREATE */

form.addEventListener("submit", async e=>{

  e.preventDefault();

  const btn = document.getElementById("submitBtn");

  btn.innerText = "Posting...";

  const username = document.getElementById("username").value.trim();
  const title = document.getElementById("postTitle").value.trim();
  const content = document.getElementById("postContent").value.trim();
  const code = document.getElementById("postCode").value.trim();

  if(!username || !title){
    btn.innerText = "Submit Post";
    return;
  }

  const id = Date.now().toString();

  await db.ref("posts/" + id).set({
    id,
    username,
    title,
    content,
    code,
    timestamp:Date.now(),
    userId,
    likes:{},
    dislikes:{},
    favorites:{},
    comments:{}
  });

  form.reset();

  btn.innerText = "Posted ✔";

  showPopup("Post created");

  setTimeout(()=>{
    btn.innerText = "Submit Post";
  },1000);

});

/* LOAD */

db.ref("posts").on("value", snap=>{

  const data = snap.val() || {};

  allPosts = Object.values(data);

  renderPosts();
});

/* SORT */

sortPosts.addEventListener("change", renderPosts);

/* RENDER */

function renderPosts(){

  let posts = [...allPosts];

  const mode = sortPosts.value;

  if(mode === "latest"){
    posts.sort((a,b)=>b.timestamp-a.timestamp);
  }

  if(mode === "oldest"){
    posts.sort((a,b)=>a.timestamp-b.timestamp);
  }

  if(mode === "liked"){
    posts.sort((a,b)=>
      Object.keys(b.likes||{}).length -
      Object.keys(a.likes||{}).length
    );
  }

  if(mode === "favorites"){
    posts = posts.filter(p=>p.favorites && p.favorites[userId]);
  }

  posts = posts.slice(0, visiblePosts);

  postsWrap.innerHTML = "";

  posts.forEach(post=>{

    const div = document.createElement("div");

    div.className = "post";

    const likes = Object.keys(post.likes || {}).length;
    const dislikes = Object.keys(post.dislikes || {}).length;
    const favorites = Object.keys(post.favorites || {}).length;

    div.innerHTML = `
      <h3>${escapeHtml(post.title)}</h3>

      <div class="meta">
        by ${escapeHtml(post.username)}
        • ${new Date(post.timestamp).toLocaleString()}
      </div>

      <div class="post-content">
        ${format(post.content)}
      </div>

      ${
        post.code ?
        `
        <div class="code-box">
          <pre>${escapeHtml(post.code)}</pre>
        </div>
        `
        : ""
      }

      <div class="actions">

        <button class="like-btn"
        onclick="toggleLike('${post.id}')">
        👍 ${likes}
        </button>

        <button class="dislike-btn"
        onclick="toggleDislike('${post.id}')">
        👎 ${dislikes}
        </button>

        <button class="favorite-btn"
        onclick="toggleFavorite('${post.id}')">
        ⭐ ${favorites}
        </button>

        <button class="comment-btn"
        onclick="toggleComments('${post.id}')">
        💬 Comment
        </button>

${
  (
    post.userId === userId ||
    userId === ADMIN_UID
  )
  ?
  `
  <button class="edit-btn"
  onclick="editPost('${post.id}', this)">
  ✏ Edit
  </button>

  <button class="delete-btn"
  onclick="deletePost('${post.id}')">
  🗑 Delete
  </button>
  `
  : ""
}

      </div>

      <div class="comments-wrap hidden"
      id="comments-${post.id}">

        <div class="comment-sort">
          <select onchange="renderComments('${post.id}', this.value)">
            <option value="latest">Newest Comments</option>
            <option value="oldest">Oldest Comments</option>
            <option value="liked">Most Liked Comments</option>
          </select>
        </div>

        <div class="comment-box">

          <input type="text"
          id="commentUser-${post.id}"
          placeholder="Your name">

          <textarea
          id="commentText-${post.id}"
          rows="3"
          placeholder="Write comment..."></textarea>

          <button class="comment-btn"
          onclick="sendComment('${post.id}', this)">
          Send Comment
          </button>

        </div>

        <div id="commentList-${post.id}"></div>

      </div>
    `;

    postsWrap.appendChild(div);
  });

}

/* LOAD MORE */

document.getElementById("loadMoreBtn").onclick = ()=>{
  visiblePosts += 6;
  renderPosts();
};

/* LIKE */

async function toggleLike(id){

  const ref = db.ref(`posts/${id}/likes/${userId}`);
  const snap = await ref.once("value");

  if(snap.exists()){
    ref.remove();
  }else{
    ref.set(true);
    db.ref(`posts/${id}/dislikes/${userId}`).remove();
  }
}

/* DISLIKE */

async function toggleDislike(id){

  const ref = db.ref(`posts/${id}/dislikes/${userId}`);
  const snap = await ref.once("value");

  if(snap.exists()){
    ref.remove();
  }else{
    ref.set(true);
    db.ref(`posts/${id}/likes/${userId}`).remove();
  }
}

/* FAVORITE */

async function toggleFavorite(id){

  const ref = db.ref(`posts/${id}/favorites/${userId}`);
  const snap = await ref.once("value");

  if(snap.exists()){
    ref.remove();
    showPopup("Removed favorite");
  }else{
    ref.set(true);
    showPopup("Added favorite");
  }
}

/* COMMENTS */

function toggleComments(id){

  document
  .getElementById("comments-" + id)
  .classList
  .toggle("hidden");

  renderComments(id, "latest");
}

async function sendComment(postId, btn){

  btn.innerText = "Sending...";

  const name =
  document.getElementById(`commentUser-${postId}`).value.trim();

  const text =
  document.getElementById(`commentText-${postId}`).value.trim();

  if(!name || !text){
    btn.innerText = "Send Comment";
    return;
  }

  const id = Date.now().toString();

  await db.ref(`posts/${postId}/comments/${id}`).set({
    id,
    username:name,
    text,
    userId,
    timestamp:Date.now(),
    likes:{},
    dislikes:{}
  });

  document.getElementById(`commentText-${postId}`).value = "";

  btn.innerText = "Commented ✔";

  showPopup("Comment added");

  setTimeout(()=>{
    btn.innerText = "Send Comment";
  },1000);

  renderComments(postId, "latest");
}

/* RENDER COMMENTS */

function renderComments(postId, mode){

  db.ref(`posts/${postId}/comments`)
  .once("value")
  .then(snap=>{

    let comments =
    Object.values(snap.val() || {});

    if(mode === "latest"){
      comments.sort((a,b)=>b.timestamp-a.timestamp);
    }

    if(mode === "oldest"){
      comments.sort((a,b)=>a.timestamp-b.timestamp);
    }

    if(mode === "liked"){
      comments.sort((a,b)=>
        Object.keys(b.likes||{}).length -
        Object.keys(a.likes||{}).length
      );
    }

    const wrap =
    document.getElementById(`commentList-${postId}`);

    wrap.innerHTML = "";

    comments.forEach(c=>{

      const likes =
      Object.keys(c.likes || {}).length;

      const dislikes =
      Object.keys(c.dislikes || {}).length;

      wrap.innerHTML += `
        <div class="comment">

          <div class="comment-top">
            ${escapeHtml(c.username)}
            • ${new Date(c.timestamp).toLocaleString()}
          </div>

          <div>
            ${format(c.text)}
          </div>

<div class="comment-actions">

  <button class="c-like"
  onclick="toggleCommentLike('${postId}','${c.id}')">
  👍 ${likes}
  </button>

  <button class="c-dislike"
  onclick="toggleCommentDislike('${postId}','${c.id}')">
  👎 ${dislikes}
  </button>

  ${
    (!c.userId || c.userId === userId)
    ?
    `
    <button class="edit-btn"
    onclick="editComment('${postId}','${c.id}', this)">
    ✏ Edit
    </button>

    <button class="delete-btn"
    onclick="deleteComment('${postId}','${c.id}')">
    🗑 Delete
    </button>
    `
    :
    ""
  }

</div>

        </div>
      `;
    });

  });

}

/* COMMENT LIKE */

async function toggleCommentLike(postId, id){

  const ref =
  db.ref(`posts/${postId}/comments/${id}/likes/${userId}`);

  const snap = await ref.once("value");

  if(snap.exists()){
    ref.remove();
  }else{
    ref.set(true);

    db.ref(
    `posts/${postId}/comments/${id}/dislikes/${userId}`
    ).remove();
  }

  renderComments(postId, "latest");
}

/* COMMENT DISLIKE */

async function toggleCommentDislike(postId, id){

  const ref =
  db.ref(`posts/${postId}/comments/${id}/dislikes/${userId}`);

  const snap = await ref.once("value");

  if(snap.exists()){
    ref.remove();
  }else{
    ref.set(true);

    db.ref(
    `posts/${postId}/comments/${id}/likes/${userId}`
    ).remove();
  }

  renderComments(postId, "latest");
}

/* EDIT COMMENT */

async function editComment(postId, commentId, btn){

  btn.innerText = "Editing...";

  const snap = await db
  .ref(`posts/${postId}/comments/${commentId}`)
  .once("value");

  const comment = snap.val();

  const text = prompt(
    "Edit comment",
    comment.text
  );

  if(text === null){
    btn.innerText = "✏ Edit";
    return;
  }

  await db
  .ref(`posts/${postId}/comments/${commentId}`)
  .update({
    text
  });

  btn.innerText = "Edited ✔";

  showPopup("Comment updated");

  setTimeout(()=>{
    btn.innerText = "✏ Edit";
  },1000);

  renderComments(postId, "latest");
}

/* DELETE COMMENT */

function deleteComment(postId, commentId){

  customConfirm(
    "Delete Comment",
    "Delete this comment permanently?",
    async yes=>{

      if(!yes) return;

      await db
      .ref(`posts/${postId}/comments/${commentId}`)
      .remove();

      showPopup("Comment deleted");

      renderComments(postId, "latest");
    }
  );
}

/* DELETE */

async function deletePost(id){

  const snap =
  await db.ref("posts/" + id).once("value");

  const post = snap.val();

  if(!post){
    showPopup("Post not found");
    return;
  }

  const isOwner =
  post.userId === userId;

  const isAdmin =
  userId === ADMIN_UID;

  if(!isOwner && !isAdmin){

    showPopup("Not allowed");
    return;
  }

  customConfirm(
    "Delete Post",
    "Delete this post permanently?",
    async yes=>{

      if(!yes) return;

      await db.ref("posts/" + id).remove();

      showPopup("Post deleted");
    }
  );
}

/* EDIT */

async function editPost(id, btn){

  const snap =
  await db.ref("posts/" + id).once("value");

  const post = snap.val();

  if(!post){
    showPopup("Post not found");
    return;
  }

  const isOwner =
  post.userId === userId;

  const isAdmin =
  userId === ADMIN_UID;

  if(!isOwner && !isAdmin){

    showPopup("Not allowed");
    return;
  }

  btn.innerText = "Editing...";

  const title =
  prompt("Edit title", post.title);

  if(title === null){

    btn.innerText = "✏ Edit";
    return;
  }

  const content =
  prompt("Edit content", post.content);

  if(content === null){

    btn.innerText = "✏ Edit";
    return;
  }

  await db.ref("posts/" + id).update({
    title,
    content
  });

  btn.innerText = "Edited ✔";

  showPopup("Post updated");

  setTimeout(()=>{
    btn.innerText = "✏ Edit";
  },1000);
}

/* SEARCH */

document.getElementById("searchBox")
.addEventListener("input", e=>{

  const q = e.target.value.toLowerCase();

  document.querySelectorAll(".post")
  .forEach(post=>{

    const text =
    post.innerText.toLowerCase();

    post.style.display =
    text.includes(q)
    ? "block"
    : "none";
  });

});

/* FORMAT */

function format(text){

  if(!text) return "";

  return escapeHtml(text)
  .replace(/\n/g,"<br>");
}




function escapeHtml(text){

  return text.replace(/[&<>"']/g, m => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#039;'
  }[m]));
}

/* GLOBAL */

window.toggleLike = toggleLike;
window.toggleDislike = toggleDislike;
window.toggleFavorite = toggleFavorite;
window.toggleComments = toggleComments;
window.sendComment = sendComment;
window.renderComments = renderComments;
window.toggleCommentLike = toggleCommentLike;
window.toggleCommentDislike = toggleCommentDislike;
window.deletePost = deletePost;
window.editPost = editPost;
window.editComment = editComment;
window.deleteComment = deleteComment;



