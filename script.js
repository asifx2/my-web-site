// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, onSnapshot, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- DOM ELEMENTS ---
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const chatMessages = document.getElementById('chat-messages');
const userInfo = document.getElementById('user-info');
const loader = document.getElementById('loader');

// --- FIREBASE CONFIGURATION ---
// These global variables are provided by the environment.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-chat-app';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : { apiKey: "DEMO", authDomain: "DEMO", projectId: "DEMO" };
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let db, auth;
let currentUserId = null;
let messagesCollection;

// --- INITIALIZATION ---
async function main() {
    try {
        // Initialize Firebase App
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);

        // Define the collection path for messages for this specific app instance
        const collectionPath = `/artifacts/${appId}/public/data/messages`;
        messagesCollection = collection(db, collectionPath);
        
        // Set up authentication state listener
        setupAuthListener();

    } catch (error) {
        console.error("Firebase initialization failed:", error);
        loader.textContent = "Error: Could not connect to chat service.";
    }
}

// --- AUTHENTICATION ---
function setupAuthListener() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is signed in.
            currentUserId = user.uid;
            userInfo.textContent = `ID: ${currentUserId.substring(0, 8)}...`;
            console.log("Authenticated with User ID:", currentUserId);
            
            // User is ready, now listen for messages
            listenForMessages();
            
            loader.style.display = 'none'; // Hide loader
        } else {
            // User is signed out, attempt to sign in.
            console.log("No user found, attempting to sign in...");
            await signIn();
        }
    });
}

async function signIn() {
    try {
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
            console.log("Signed in with custom token.");
        } else {
            await signInAnonymously(auth);
            console.log("Signed in anonymously.");
        }
    } catch (error) {
        console.error("Authentication failed:", error);
        loader.textContent = "Authentication failed.";
    }
}


// --- REAL-TIME MESSAGE HANDLING ---
function listenForMessages() {
    // Create a query to get messages.
    // Note: We fetch without ordering and sort on the client to avoid needing a composite index.
    const q = query(messagesCollection);

    onSnapshot(q, (querySnapshot) => {
        const messages = [];
        querySnapshot.forEach((doc) => {
            messages.push({ id: doc.id, ...doc.data() });
        });

        // Sort messages by timestamp client-side
        messages.sort((a, b) => {
            const timeA = a.timestamp?.toMillis() || 0;
            const timeB = b.timestamp?.toMillis() || 0;
            return timeA - timeB;
        });
        
        renderMessages(messages);

    }, (error) => {
        console.error("Error listening to messages:", error);
    });
}

// --- RENDERING ---
function renderMessages(messages) {
    chatMessages.innerHTML = ''; // Clear existing messages
    messages.forEach(msg => {
        if (!msg.text || !msg.userId) return; // Skip malformed messages
        
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        
        const p = document.createElement('p');
        p.textContent = msg.text;
        messageElement.appendChild(p);

        // Add message metadata (sender ID)
        const meta = document.createElement('div');
        meta.classList.add('message-meta');
        
        // Determine if the message was sent or received
        if (msg.userId === currentUserId) {
            messageElement.classList.add('sent');
            meta.textContent = `You`;
        } else {
            messageElement.classList.add('received');
            meta.textContent = `User ${msg.userId.substring(0, 4)}`;
        }
        messageElement.appendChild(meta);

        chatMessages.appendChild(messageElement);
    });
    scrollToBottom();
}

// --- ACTIONS ---
async function sendMessage(e) {
    e.preventDefault();
    const messageText = messageInput.value.trim();

    if (messageText && currentUserId) {
        const messageData = {
            text: messageText,
            userId: currentUserId,
            timestamp: serverTimestamp() // Use server-side timestamp for accurate ordering
        };

        try {
            await addDoc(messagesCollection, messageData);
            messageInput.value = ''; // Clear input field
            console.log("Message sent:", messageData);
        } catch (error) {
            console.error("Error sending message: ", error);
        }
    }
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// --- EVENT LISTENERS ---
chatForm.addEventListener('submit', sendMessage);

// --- START THE APP ---
main();