import { auth, provider, db } from "./firebase-config.js";
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import { doc, setDoc, getDoc, collection, addDoc, getDocs, serverTimestamp, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

// Pages protégées
const protectedPages = ["dashboard.html"];
const currentPage = window.location.pathname.split("/").pop();

if (protectedPages.includes(currentPage)) {
  onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "index.html";
  });
}

// Connexion Google
const loginBtn = document.getElementById("loginBtn");
if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          name: user.displayName,
          email: user.email,
          role: "utilisateur"
        });
      }
      window.location.href = "dashboard.html";
    } catch (err) {
      console.error("Erreur de connexion:", err);
    }
  });
}

// Déconnexion
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
  });
}

// Tendance : charger posts
const postsContainer = document.getElementById("postsContainer");
if (postsContainer) loadPosts();

async function loadPosts() {
  const snapshot = await getDocs(collection(db, "tendance"));
  postsContainer.innerHTML = "";
  snapshot.forEach((docSnap) => {
    const post = docSnap.data();
    const postCard = document.createElement("div");
    postCard.classList.add("card");
    postCard.innerHTML = `
      <img src="${post.imageUrl}" class="post-img">
      <p>${post.caption}</p>
      <small>Publié le ${new Date(post.timestamp.seconds * 1000).toLocaleString()}</small>
      <button class="btn small" onclick="likePost('${docSnap.id}')">❤️ ${post.likes?.length || 0}</button>
    `;
    postsContainer.appendChild(postCard);
  });
}

// Like
window.likePost = async function (postId) {
  if (!auth.currentUser) {
    alert("Connectez-vous pour liker.");
    return;
  }
  const postRef = doc(db, "tendance", postId);
  await updateDoc(postRef, {
    likes: arrayUnion(auth.currentUser.uid)
  });
  loadPosts();
};

// Publication admin
const postForm = document.getElementById("postForm");
if (postForm) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    const userData = snap.data();

    if (userData.role === "admin") {
      document.getElementById("adminPostArea").classList.remove("hidden");

      postForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const caption = document.getElementById("caption").value;
        const file = document.getElementById("imageUpload").files[0];
        if (!file) return;

        const lastPost = userData.lastPost;
        if (lastPost && (Date.now() - lastPost.toMillis()) < 48 * 60 * 60 * 1000) {
          document.getElementById("cooldownMessage").classList.remove("hidden");
          return;
        }

        const imageUrl = URL.createObjectURL(file); // ⚠️ A remplacer par Firebase Storage

        await addDoc(collection(db, "tendance"), {
          caption,
          imageUrl,
          timestamp: serverTimestamp(),
          likes: [],
          author: user.uid
        });

        await updateDoc(userRef, { lastPost: serverTimestamp() });
        postForm.reset();
        loadPosts();
      });
    }
  });
}

// Dashboard infos
onAuthStateChanged(auth, (user) => {
  if (user) {
    const userName = document.getElementById("userName");
    if (userName) userName.textContent = user.displayName;
  }
});
