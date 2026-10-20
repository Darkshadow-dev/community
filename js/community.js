/*====================================
  COMMUNITY SYSTEM
  FIREBASE COMMUNITY POSTS
====================================*/


const ADMIN_UID = "HlLj9hzon7bs2aEUpuOn97HWl9v1";


let userId = null;
let authReady = false;

let allPosts = [];
let visiblePosts = 6;

let editingPostId = null;


/*====================================
  DOM HELPER
====================================*/

function $(id){
    return document.getElementById(id);
}


/*====================================
  DOM REFERENCES
====================================*/

const postsWrap = $("communityPosts");

const form = $("uploadForm");

const popup = $("popup");

const postWindow = $("postWindow");

const openCreatorBtn = $("openCreatorBtn");

const closeWindow = $("closeWindow");

const minimizeWindow = $("minimizeWindow");

const windowContent = $("windowContent");

const sortPosts = $("sortPosts");

const categoryFilter = $("categoryFilter");

const searchBox = $("searchBox");

const editWindow = $("editWindow");

const closeEditWindow = $("closeEditWindow");

const saveEditBtn = $("saveEditBtn");

const loadMoreBtn = $("loadMoreBtn");


/*====================================
  FIREBASE AUTH
====================================*/

firebase.auth().signInAnonymously()
.catch(error => {

    console.error("Anonymous login error:", error);

    showPopup("Login failed: " + error.message, "error");

});


firebase.auth().onAuthStateChanged(user => {

    if(!user){
        return;
    }

    userId = user.uid;

    authReady = true;

    console.log("Firebase user:", userId);

});


/*====================================
  HTML SECURITY
====================================*/

function escapeHtml(text){

    if(text === undefined || text === null){
        return "";
    }

    return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


function format(text){

    if(!text){
        return "";
    }

    return escapeHtml(text)
    .replace(/\n/g, "<br>");

}


/*====================================
  POPUP
====================================*/

function showPopup(text, type = ""){

    if(!popup){
        return;
    }

    popup.innerText = text;

    popup.className = "popup show " + type;

    setTimeout(() => {

        popup.className = "popup";

    }, 2500);

}


/*====================================
  FIREBASE ERROR
====================================*/

function firebaseError(error){

    console.error("Firebase error:", error);

    let message = "Database error.";

    if(error && error.code === "PERMISSION_DENIED"){
        message = "Firebase permission denied.";
    }

    if(error && error.message){
        console.error(error.message);
    }

    showPopup(message, "error");

}


/*====================================
  ADMIN
====================================*/

function isAdmin(){

    return userId === ADMIN_UID;

}


/*====================================
  CREATE WINDOW
====================================*/

if(openCreatorBtn){

    openCreatorBtn.onclick = () => {

        postWindow.classList.remove("hidden");

    };

}


if(closeWindow){

    closeWindow.onclick = () => {

        postWindow.classList.add("hidden");

    };

}


if(minimizeWindow){

    minimizeWindow.onclick = () => {

        windowContent.classList.toggle("hidden");

    };

}


/*====================================
  DRAG WINDOWS
====================================*/

function dragWindow(element, handle){

    if(!element || !handle){
        return;
    }

    let x = 0;
    let y = 0;

    handle.onmousedown = e => {

        e.preventDefault();

        x = e.clientX;
        y = e.clientY;

        document.onmousemove = move;
        document.onmouseup = stop;

    };


    function move(e){

        let dx = x - e.clientX;
        let dy = y - e.clientY;

        x = e.clientX;
        y = e.clientY;

        element.style.left =
        (element.offsetLeft - dx) + "px";

        element.style.top =
        (element.offsetTop - dy) + "px";

        element.style.transform = "none";

    }


    function stop(){

        document.onmousemove = null;
        document.onmouseup = null;

    }

}


dragWindow(
    postWindow,
    $("windowDrag")
);


dragWindow(
    editWindow,
    $("editWindowDrag")
);


/*====================================
  CREATE POST
====================================*/

if(form){

    form.addEventListener("submit", async e => {

        e.preventDefault();


        if(!authReady){

            showPopup(
                "Waiting for Firebase login...",
                "error"
            );

            return;

        }


        const username =
        $("username").value.trim();

localStorage.setItem(
    "communityUsername",
    username
);

        const title =
        $("postTitle").value.trim();


        const category =
        $("postCategory").value;


        const content =
        $("postContent").value.trim();


        const code =
        $("postCode").value.trim();


        if(!username){

            showPopup(
                "Please enter your username.",
                "error"
            );

            return;

        }


        if(!title){

            showPopup(
                "Please enter a title.",
                "error"
            );

            return;

        }


        const id =
        Date.now().toString();


        const post = {

            id: id,

            username: username,

            title: title,

            category: category,

            content: content,

            code: code,

            timestamp: Date.now(),

            userId: userId,

            likes: {},

            dislikes: {},

            favorites: {},

            comments: {}

        };


        const submitBtn =
        $("submitBtn");


        if(submitBtn){
            submitBtn.disabled = true;
            submitBtn.innerText = "Creating...";
        }


        try{

            await db.ref(
                "posts/" + id
            ).set(post);


            form.reset();

            postWindow.classList.add("hidden");


            showPopup(
                "Post created successfully!",
                "success"
            );

        }
        catch(error){

            firebaseError(error);

        }
        finally{

            if(submitBtn){

                submitBtn.disabled = false;
                submitBtn.innerText = "Create Post";

            }

        }

    });

}


/*====================================
  LOAD POSTS
====================================*/

db.ref("posts").on(
    "value",

    snap => {

        const data = snap.val() || {};

        allPosts =
        Object.values(data);


        allPosts.sort(
            (a, b) =>
            (b.timestamp || 0) -
            (a.timestamp || 0)
        );


        console.log(
            "Posts loaded:",
            allPosts.length
        );


        console.log("Calling renderPosts()");
renderPosts();
console.log("Posts container:", postsWrap);
console.log("Posts container HTML:", postsWrap ? postsWrap.innerHTML : "NO POSTS CONTAINER");

        updateStats();

    },

    error => {

        firebaseError(error);

    }

);


/*====================================
  RENDER POSTS
====================================*/

function renderPosts(){

    if(!postsWrap){
        return;
    }


    let posts =
    getFilteredPosts();


    posts =
    getSortedPosts(posts);


    const visible =
    posts.slice(0, visiblePosts);


    postsWrap.innerHTML = "";


    if(visible.length === 0){

        postsWrap.innerHTML = `

        <div class="post">

            <h3>No posts found</h3>

            <p class="post-content">
            There are currently no community posts matching your search.
            </p>

        </div>

        `;

        updateLoadButton(0);

        return;

    }


    visible.forEach(post => {

        postsWrap.appendChild(
            createPostElement(post)
        );

    });


    updateLoadButton(posts.length);

}


/*====================================
  FILTER
====================================*/

function getFilteredPosts(){

    let posts =
    [...allPosts];


    const category =
    categoryFilter ?
    categoryFilter.value :
    "all";


    const search =
    searchBox ?
    searchBox.value.trim().toLowerCase() :
    "";


    if(category !== "all"){

        posts =
        posts.filter(post =>
            post.category === category
        );

    }


    if(search){

        posts =
        posts.filter(post => {

            const text = [

                post.username,
                post.title,
                post.content,
                post.code,
                post.category

            ]
            .join(" ")
            .toLowerCase();


            return text.includes(search);

        });

    }


    return posts;

}


/*====================================
  SORT
====================================*/

function getSortedPosts(posts){

    const sort =
    sortPosts ?
    sortPosts.value :
    "latest";


    return posts.sort((a, b) => {


        if(sort === "oldest"){

            return (
                (a.timestamp || 0) -
                (b.timestamp || 0)
            );

        }


        if(sort === "liked"){

            return (
                getCount(b.likes) -
                getCount(a.likes)
            );

        }

if(sort === "disliked"){

    return (
        getCount(b.dislikes) -
        getCount(a.dislikes)
    );

}


        if(sort === "favorites"){

            return (
                getCount(b.favorites) -
                getCount(a.favorites)
            );

        }


        return (
            (b.timestamp || 0) -
            (a.timestamp || 0)
        );

    });

}


/*====================================
  CREATE POST CARD
====================================*/

function createPostElement(post){

    const article = document.createElement("article");

    article.className = "post";

    const likes = getCount(post.likes);
    const dislikes = getCount(post.dislikes);
    const favorites = getCount(post.favorites);
    const comments = getCount(post.comments);

    const date = formatDate(post.timestamp);

    article.innerHTML = `

        <h3>
            ${escapeHtml(post.title)}
        </h3>

        <div class="meta">
            @${escapeHtml(post.username)}
            • ${date}
            ${post.edited ? " • Edited" : ""}
        </div>

        <div class="badges">

            <span class="badge ${escapeHtml(post.category)}">
                ${escapeHtml(capitalize(post.category))}
            </span>

        </div>

        <div class="post-content">
            ${formatMentions(post.content)}
        </div>

        ${
            post.code
            ?
            `
            <div class="code-box">

                <div class="code-header">

                    <span>
                        Code / Extra Information
                    </span>

                    <button
                        class="copy-code"
                    >
                        Copy
                    </button>

                </div>

                <pre>${escapeHtml(post.code)}</pre>

            </div>
            `
            :
            ""
        }

        <div class="actions">

            <button
                class="like-btn"
                data-action="like"
                data-id="${escapeHtml(post.id)}"
            >
                👍 ${likes}
            </button>

            <button
                class="dislike-btn"
                data-action="dislike"
                data-id="${escapeHtml(post.id)}"
            >
                👎 ${dislikes}
            </button>

            <button
                class="favorite-btn"
                data-action="favorite"
                data-id="${escapeHtml(post.id)}"
            >
                ⭐ ${favorites}
            </button>

            <button
                class="comment-btn"
                data-action="comment"
                data-id="${escapeHtml(post.id)}"
            >
                💬 ${comments}
            </button>

            ${
                post.userId === userId || isAdmin()
                ?
                `

                <button
                    class="edit-btn"
                    data-action="edit"
                    data-id="${escapeHtml(post.id)}"
                >
                    ✏️ Edit
                </button>

                <button
                    class="delete-btn"
                    data-action="delete"
                    data-id="${escapeHtml(post.id)}"
                >
                    🗑 Delete
                </button>

                `
                :
                ""
            }

        </div>

        <div
            class="comments-wrap"
            id="comments-${escapeHtml(post.id)}"
        >

            <div class="comment-form">

                <input
                    type="text"
                    class="comment-input"
                    placeholder="Write a comment... Use @username"
                >

                <button
                    class="comment-submit"
                    data-post-id="${escapeHtml(post.id)}"
                >
                    Comment
                </button>

            </div>

            <div class="comments-list"></div>

        </div>

    `;

    /* COPY CODE */

    const copyBtn = article.querySelector(".copy-code");

    if(copyBtn){

        copyBtn.onclick = async () => {

            try{

                await navigator.clipboard.writeText(
                    post.code || ""
                );

                showPopup(
                    "Code copied!",
                    "success"
                );

            }
            catch(error){

                showPopup(
                    "Could not copy code.",
                    "error"
                );

            }

        };

    }


    /* POST ACTIONS */

    article
    .querySelectorAll("[data-action]")
    .forEach(button => {

        button.onclick = () => {

            const action =
            button.dataset.action;

            const id =
            button.dataset.id;

            if(action === "like"){
                changeReaction(id, "likes");
            }

            if(action === "dislike"){
                changeReaction(id, "dislikes");
            }

            if(action === "favorite"){
                changeReaction(id, "favorites");
            }

            if(action === "edit"){
                openEditWindow(id);
            }

            if(action === "delete"){
                deletePost(id);
            }

        };

    });


    /* COMMENT SUBMIT */

    const commentSubmit =
    article.querySelector(".comment-submit");

    const commentInput =
    article.querySelector(".comment-input");

    if(commentSubmit && commentInput){

        commentSubmit.onclick = () => {

            addComment(
                post.id,
                commentInput.value
            );

        };

        commentInput.addEventListener(
            "keydown",
            e => {

                if(e.key === "Enter"){

                    e.preventDefault();

                    addComment(
                        post.id,
                        commentInput.value
                    );

                }

            }
        );

    }


    /* LOAD COMMENTS */

    loadComments(
        post.id,
        article.querySelector(".comments-list")
    );


    return article;

}


/*====================================
  COMMENTS
====================================*/

async function addComment(postId, text){

    if(!authReady){

        showPopup(
            "Waiting for Firebase login...",
            "error"
        );

        return;

    }


    text = text.trim();


    if(!text){

        showPopup(
            "Comment cannot be empty.",
            "error"
        );

        return;

    }


    let username =
    localStorage.getItem(
        "communityUsername"
    );


    if(!username){

        username =
        prompt(
            "Enter your username:"
        );

        if(!username){
            return;
        }

        username = username.trim();

        if(!username){
            return;
        }

        localStorage.setItem(
            "communityUsername",
            username
        );

    }


    const commentId =
    db.ref(
        "posts/" +
        postId +
        "/comments"
    ).push().key;


    const comment = {

        id: commentId,

        userId: userId,

        username: username,

        content: text,

        timestamp: Date.now(),

        edited: false

    };


    try{

        await db.ref(
            "posts/" +
            postId +
            "/comments/" +
            commentId
        ).set(comment);

        showPopup(
            "Comment added!",
            "success"
        );

    }
    catch(error){

        firebaseError(error);

    }

}


/*====================================
  LOAD COMMENTS
====================================*/

function loadComments(
    postId,
    container
){

    if(!container){
        return;
    }


    db.ref(
        "posts/" +
        postId +
        "/comments"
    ).on(
        "value",

        snapshot => {

            const data =
            snapshot.val() || {};


            const comments =
            Object.values(data);


            comments.sort(
                (a, b) =>
                (a.timestamp || 0) -
                (b.timestamp || 0)
            );


            container.innerHTML = "";


            if(comments.length === 0){

                container.innerHTML = `
                    <div class="no-comments">
                        No comments yet.
                    </div>
                `;

                return;

            }


            comments.forEach(comment => {

                container.appendChild(
                    createCommentElement(comment, postId)
                );

            });

        },

        error => {

            console.error(
                "Comment loading error:",
                error
            );

        }

    );

}


/*====================================
  CREATE COMMENT
====================================*/

function createCommentElement(
    comment,
    postId
){

    const element =
    document.createElement("div");


    element.className =
    "comment";


    const canManage =
    comment.userId === userId ||
    isAdmin();


    element.innerHTML = `

        <div class="comment-header">

            <strong>
                @${escapeHtml(comment.username)}
            </strong>

            <span>
                ${formatDate(comment.timestamp)}
                ${comment.edited ? " • Edited" : ""}
            </span>

        </div>


        <div class="comment-content">
            ${formatMentions(comment.content)}
        </div>


        ${
            canManage
            ?
            `

            <div class="comment-actions">

                <button
                    class="comment-edit"
                >
                    Edit
                </button>

                <button
                    class="comment-delete"
                >
                    Delete
                </button>

            </div>

            `
            :
            ""
        }

    `;


    const editBtn =
    element.querySelector(
        ".comment-edit"
    );


    const deleteBtn =
    element.querySelector(
        ".comment-delete"
    );


    if(editBtn){

        editBtn.onclick = () => {

            editComment(
                postId,
                comment
            );

        };

    }


    if(deleteBtn){

        deleteBtn.onclick = () => {

            deleteComment(
                postId,
                comment.id
            );

        };

    }


    return element;

}

/*====================================
  MENTIONS
====================================*/

function formatMentions(text){

    if(!text){
        return "";
    }


    let safe =
    escapeHtml(text);


    safe =
    safe.replace(
        /(^|\s)@([a-zA-Z0-9_.-]+)/g,
        '$1<span class="mention">@$2</span>'
    );


    safe =
    safe.replace(
        /\n/g,
        "<br>"
    );


    return safe;

}

/*====================================
  EDIT COMMENT
====================================*/

async function editComment(
    postId,
    comment
){

    if(
        comment.userId !== userId &&
        !isAdmin()
    ){

        showPopup(
            "You cannot edit this comment.",
            "error"
        );

        return;

    }


    const newText =
    prompt(
        "Edit your comment:",
        comment.content
    );


    if(newText === null){
        return;
    }


    const content =
    newText.trim();


    if(!content){

        showPopup(
            "Comment cannot be empty.",
            "error"
        );

        return;

    }


    try{

        await db.ref(
            "posts/" +
            postId +
            "/comments/" +
            comment.id
        ).update({

            content: content,

            edited: true,

            editedTime: Date.now()

        });


        showPopup(
            "Comment updated!",
            "success"
        );

    }
    catch(error){

        firebaseError(error);

    }

}

/*====================================
  DELETE COMMENT
====================================*/

function deleteComment(
    postId,
    commentId
){

    customConfirm(
        "Delete Comment",
        "Are you sure you want to delete this comment?",

        async confirmed => {

            if(!confirmed){
                return;
            }


            try{

                await db.ref(
                    "posts/" +
                    postId +
                    "/comments/" +
                    commentId
                ).remove();


                showPopup(
                    "Comment deleted.",
                    "success"
                );

            }
            catch(error){

                firebaseError(error);

            }

        }

    );

}

/*====================================
  REACTIONS
====================================*/

/*====================================
  REACTIONS
====================================*/

async function changeReaction(
    postId,
    type
){

    if(!authReady){

        showPopup(
            "Waiting for login...",
            "error"
        );

        return;

    }


    const postRef =
    db.ref(
        "posts/" +
        postId
    );


    const myReaction =
    postRef
    .child(type)
    .child(userId);


    try{

        const snapshot =
        await myReaction.once("value");


        if(snapshot.exists()){

            await myReaction.remove();

            return;

        }


        if(type === "likes"){

            await postRef
            .child("dislikes")
            .child(userId)
            .remove();

        }


        if(type === "dislikes"){

            await postRef
            .child("likes")
            .child(userId)
            .remove();

        }


        await myReaction.set(true);

    }
    catch(error){

        firebaseError(error);

    }

}


/*====================================
  EDIT POST
====================================*/

function openEditWindow(id){

    const post =
    allPosts.find(
        p => p.id === id
    );


    if(!post){
        return;
    }


    if(
        post.userId !== userId &&
        !isAdmin()
    ){

        showPopup(
            "You cannot edit this post.",
            "error"
        );

        return;

    }


    editingPostId = id;


    $("editTitle").value =
    post.title || "";


    $("editContent").value =
    post.content || "";


    $("editCode").value =
    post.code || "";


    editWindow.classList.remove(
        "hidden"
    );

}


if(closeEditWindow){

    closeEditWindow.onclick = () => {

        editWindow.classList.add(
            "hidden"
        );

        editingPostId = null;

    };

}


if(saveEditBtn){

    saveEditBtn.onclick = async () => {

        if(!editingPostId){
            return;
        }


        const post =
        allPosts.find(
            p => p.id === editingPostId
        );


        if(!post){
            return;
        }


        if(
            post.userId !== userId &&
            !isAdmin()
        ){

            showPopup(
                "You cannot edit this post.",
                "error"
            );

            return;

        }


        const title =
        $("editTitle").value.trim();


        const content =
        $("editContent").value.trim();


        const code =
        $("editCode").value.trim();


        if(!title){

            showPopup(
                "Title cannot be empty.",
                "error"
            );

            return;

        }


        try{

            await db.ref(
                "posts/" +
                editingPostId
            ).update({

                title: title,

                content: content,

                code: code,

                edited: true,

                editedAt: Date.now()

            });


            editWindow.classList.add(
                "hidden"
            );


            editingPostId = null;


            showPopup(
                "Post updated!",
                "success"
            );

        }
        catch(error){

            firebaseError(error);

        }

    };

}


/*====================================
  DELETE POST
====================================*/

function deletePost(id){

    const post =
    allPosts.find(
        p => p.id === id
    );


    if(!post){
        return;
    }


    if(
        post.userId !== userId &&
        !isAdmin()
    ){

        showPopup(
            "You cannot delete this post.",
            "error"
        );

        return;

    }


    customConfirm(
        "Delete Post",
        "Are you sure you want to delete this post?",
        async confirmed => {

            if(!confirmed){
                return;
            }


            try{

                await db.ref(
                    "posts/" + id
                ).remove();


                showPopup(
                    "Post deleted.",
                    "success"
                );

            }
            catch(error){

                firebaseError(error);

            }

        }
    );

}


/*====================================
  CONFIRM
====================================*/

function customConfirm(
    title,
    text,
    callback
){

    const overlay =
    $("confirmOverlay");


    if(!overlay){

        callback(
            confirm(text)
        );

        return;

    }


    $("confirmTitle").innerText =
    title;


    $("confirmText").innerText =
    text;


    overlay.classList.remove(
        "hidden"
    );


    $("confirmYes").onclick = () => {

        overlay.classList.add(
            "hidden"
        );

        callback(true);

    };


    $("confirmNo").onclick = () => {

        overlay.classList.add(
            "hidden"
        );

        callback(false);

    };

}


/*====================================
  STATS
====================================*/

function updateStats(){

    const postCount =
    $("postCount");


    const userCount =
    $("userCount");


    const projectCount =
    $("projectCount");


    const commentCount =
    $("commentCount");


    if(postCount){

        postCount.innerText =
        allPosts.length;

    }


    const users =
    new Set();


    let projects = 0;

    let comments = 0;


    allPosts.forEach(post => {

        if(post.userId){

            users.add(
                post.userId
            );

        }


        if(post.category === "project"){

            projects++;

        }


        comments +=
        getCount(post.comments);

    });


    if(userCount){

        userCount.innerText =
        users.size;

    }


    if(projectCount){

        projectCount.innerText =
        projects;

    }


    if(commentCount){

        commentCount.innerText =
        comments;

    }

}


/*====================================
  HELPERS
====================================*/

function getCount(object){

    if(!object){
        return 0;
    }


    return Object.keys(object).length;

}


function capitalize(text){

    if(!text){
        return "";
    }


    return text.charAt(0).toUpperCase() +
    text.slice(1);

}


function formatDate(timestamp){

    if(!timestamp){
        return "Unknown date";
    }


    return new Date(
        timestamp
    ).toLocaleString();

}


/*====================================
  SEARCH
====================================*/

if(searchBox){

    searchBox.addEventListener(
        "input",
        () => {

            visiblePosts = 6;

            renderPosts();

        }
    );

}


/*====================================
  FILTER
====================================*/

if(categoryFilter){

    categoryFilter.addEventListener(
        "change",
        () => {

            visiblePosts = 6;

            renderPosts();

        }
    );

}


/*====================================
  SORT
====================================*/

if(sortPosts){

    sortPosts.addEventListener(
        "change",
        () => {

            visiblePosts = 6;

            renderPosts();

        }
    );

}


/*====================================
  LOAD MORE
====================================*/

if(loadMoreBtn){

    loadMoreBtn.onclick = () => {

        visiblePosts += 6;

        renderPosts();

    };

}


function updateLoadButton(total){

    if(!loadMoreBtn){
        return;
    }


    if(total <= visiblePosts){

        loadMoreBtn.style.display =
        "none";

    }
    else{

        loadMoreBtn.style.display =
        "block";

    }

}

const savedUsername =
localStorage.getItem(
    "communityUsername"
);

if(savedUsername){

    const usernameInput =
    $("username");

    if(usernameInput){
        usernameInput.value =
        savedUsername;
    }

}

/*====================================
  INITIAL
====================================*/

console.log(
    "Community system loaded."
);

