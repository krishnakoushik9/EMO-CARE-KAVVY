// Global variables
const video = document.getElementById('video');
const loadingMessage = document.getElementById('loading-message');
const errorMessage = document.getElementById('error-message');
const statusMessage = document.getElementById('status-message');
const emotionIndicator = document.getElementById('emotion-indicator');
//let canvas;
let lastDetectionTime = 0;
const emotionDetectionDelay = 2000; // Delay in milliseconds.
let lastExpression = '';
let isEmotionLocked = false;
let isProcessing = false;
let recognition;
let isListening = false;
let conversationHistory = [];
const maxHistory = 20;
const API_KEY = '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';
const HF_ENDPOINT = 'https://api-inference.huggingface.co/models/mistralai/Mixtral-8x7B-Instruct-v0.1';
const expandBtn = document.querySelector('.expand-btn');
const cameraSection = document.querySelector('.camera-section');
const leftPanel = document.querySelector('.left-panel');


expandBtn.addEventListener('click', () => {
    cameraSection.classList.toggle('expanded');
    leftPanel.style.visibility = cameraSection.classList.contains('expanded') ? 'hidden' : 'visible';
    expandBtn.textContent = cameraSection.classList.contains('expanded') ? '⤡' : '⤢';
});
let isEmotionInteractionEnabled = true; // User-controlled toggle.

function throttle(callback, limit) {
    let inThrottle;
    return function () {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            callback.apply(context, args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}

const throttledDetectFaces = throttle(detectFaces, 500);
video.addEventListener('play', () => {
    createCanvas();
    throttledDetectFaces();
});


function toggleEmotionInteraction() {
    isEmotionInteractionEnabled = !isEmotionInteractionEnabled;
    const toggleBtn = document.getElementById('toggle-emotion-btn');
    toggleBtn.textContent = isEmotionInteractionEnabled ? 'Disable Emotions' : 'Enable Emotions';
    updateStatus(`Emotion-based interaction ${isEmotionInteractionEnabled ? 'enabled' : 'disabled'}.`, 'info');
}


// Define emojis and prompts for each emotion with more natural responses
const expressionsToEmojiAndPrompt = {
    happy: { 
        emoji: '😊',
        responses: [
            "Your smile is contagious! How can I make your day even better?",
            "It's wonderful to see you happy! What's bringing you joy today?",
            "That's a beautiful smile! Let's keep that positive energy going!"
        ]
    },
    sad: {
        emoji: '😢',
        responses: [
            "I notice you seem down. Would you like to talk about what's bothering you?",
            "Sometimes we all need a moment to feel our emotions. I'm here to listen.",
            "Remember that difficult moments are temporary. How can I support you?"
        ]
    },
    angry: {
        emoji: '😠',
        responses: [
            "I can see you're frustrated. Let's take a deep breath together.",
            "Sometimes anger tells us something important. Would you like to discuss it?",
            "I understand you're upset. How can we work through this together?"
        ]
    },
    neutral: {
        emoji: '😐',
        responses: [
            "How are you feeling today? I'm here to chat about anything.",
            "Sometimes a neutral moment is good for reflection. What's on your mind?",
            "Is there something specific you'd like to discuss?"
        ]
    },
    disgusted: {
        emoji: '🤢',
        responses: [
            "Something seems to be bothering you. Would you like to talk about it?",
            "Let's focus on making this situation better. What would help?",
            "I notice your discomfort. How can we improve things?"
        ]
    },
    surprised: {
        emoji: '😮',
        responses: [
            "Oh! What caught you by surprise? I'd love to hear about it!",
            "Unexpected moments can be exciting! Want to share what surprised you?",
            "That's quite a reaction! What happened?"
        ]
    },
    fearful: {
        emoji: '😨',
        responses: [
            "You're safe here. Would you like to talk about what's concerning you?",
            "I understand feeling scared. Let's work through this together.",
            "Sometimes sharing our fears makes them less overwhelming. I'm here to listen."
        ]
    }
};

// Initialize speech recognition
function initializeSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true; // Enable live transcription
        recognition.lang = 'en-US';

        recognition.onresult = function(event) {
            const input = document.getElementById('chat-input');
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            // Show interim results in gray
            input.value = finalTranscript + '\u200B' + interimTranscript;
            input.style.color = interimTranscript ? '#666' : '#000';

            // Only send message if we have a final transcript
            if (finalTranscript && event.results[event.resultIndex].isFinal) {
                sendMessage(finalTranscript);
                input.value = '';
            }
        };

        recognition.onerror = function(event) {
            console.error('Speech recognition error:', event.error);
            stopListening();
            updateStatus('Speech recognition error: ' + event.error, 'error');
        };

        recognition.onend = function() {
            if (isListening) {
                recognition.start();
            }
        };
    } else {
        handleError('Speech recognition not supported in this browser');
    }
}

// Microphone controls
function toggleMicrophone() {
    if (!recognition) {
        initializeSpeechRecognition();
    }
    
    if (isListening) {
        stopListening();
    } else {
        startListening();
    }
}

function startListening() {
    try {
        recognition.start();
        isListening = true;
        document.getElementById('mic-btn').classList.add('active');
        updateStatus('Listening...', 'info');
    } catch (error) {
        handleError('Error starting speech recognition: ' + error.message);
    }
}

function stopListening() {
    try {
        recognition.stop();
        isListening = false;
        document.getElementById('mic-btn').classList.remove('active');
        updateStatus('Stopped listening', 'info');
    } catch (error) {
        handleError('Error stopping speech recognition: ' + error.message);
    }
}

// Chat interface functions
function addMessageToChat(text, isUser = false) {
    const chatMessages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-bubble ${isUser ? 'user-message' : 'ai-message'}`;
    messageDiv.textContent = text;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    conversationHistory.push({
        role: isUser ? 'user' : 'assistant',
        content: text
    });

    if (conversationHistory.length > maxHistory * 2) {
        conversationHistory = conversationHistory.slice(-maxHistory * 2);
    }
}

function sendMessage(text = '') {
    const inputElement = document.getElementById('chat-input');
    const message = text || inputElement.value.trim();
    
    if (message) {
        addMessageToChat(message, true); // Display user message immediately
        sendPromptToHuggingFace(message);
        inputElement.value = '';
    }
}

// Load face detection models
async function loadModels() {
    try {
        const MODEL_URL = '/models';
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
            faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
        ]);
        
        loadingMessage.style.display = 'none';
        updateStatus('Models loaded successfully!', 'success');
        await startVideo();
        
        // Hide loading screen after everything is loaded
        if (loadingScreen) {
            loadingScreen.hide();
        }
    } catch (err) {
        handleError('Error loading models: ' + err.message);
    }
}

// Video handling functions
async function startVideo() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 720 },
                height: { ideal: 560 },
                facingMode: 'user'
            },
            audio: false
        });
        video.srcObject = stream;
        document.getElementById('start-btn').disabled = true;
        document.getElementById('stop-btn').disabled = false;
        updateStatus('Camera initialized successfully!', 'success');
    } catch (err) {
        handleError('Camera access denied: ' + err.message);
    }
}

function stopVideo() {
    const stream = video.srcObject;
    if (stream) {
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
        document.getElementById('start-btn').disabled = false;
        document.getElementById('stop-btn').disabled = true;
        updateStatus('Camera stopped', 'info');
    }
}

// Canvas creation and handling
function createCanvas() {
    if (!canvas) {
        canvas = faceapi.createCanvasFromMedia(video);
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.pointerEvents = 'none'; // Allow clicks to pass through
        document.querySelector('.video-container').appendChild(canvas);
    }
}

// Face detection functions
async function detectFaces(interval = 500) {
    if (!video.videoWidth || !canvas || isProcessing) return;
    const currentTime = Date.now();
    if (currentTime - lastDetectionTime < emotionDetectionDelay) return;

    isProcessing = true;

    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    faceapi.matchDimensions(canvas, displaySize);

    try {
        const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceExpressions();

        // Clear canvas before re-drawing
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (detections.length === 0) {
            updateStatus('No face detected', 'warning');
            emotionIndicator.querySelector('.emoji').textContent = '😐';
            emotionIndicator.querySelector('.text').textContent = 'No face detected';
        } else {
            const resizedDetections = faceapi.resizeResults(detections, displaySize);
            faceapi.draw.drawDetections(canvas, resizedDetections);
            faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
            faceapi.draw.drawFaceExpressions(canvas, resizedDetections);

            lastDetectionTime = currentTime; // Update detection time.
            processExpressions(resizedDetections);
        }
    } catch (err) {
        handleError('Detection error: ' + err.message);
    } finally {
        isProcessing = false;
        setTimeout(() => detectFaces(interval), interval);
    }
}

function processExpressions(detections) {
    // Skip processing if an emotion is locked or interaction is disabled.
    if (isEmotionLocked) {
        updateStatus('Processing your last emotion. Please wait...', 'info');
        return;
    }
    
    if (!isEmotionInteractionEnabled) {
        updateStatus('Emotion-based interaction is disabled.', 'info');
        return;
    }

    detections.forEach(detection => {
        const expressions = detection.expressions;
        const topExpression = Object.keys(expressions).reduce((a, b) => expressions[a] > expressions[b] ? a : b);

        if (topExpression !== lastExpression) {
            lastExpression = topExpression;
            const emojiData = expressionsToEmojiAndPrompt[topExpression];
            
            if (emojiData) {
                const randomResponse = emojiData.responses[Math.floor(Math.random() * emojiData.responses.length)];
                sendPromptToHuggingFace(randomResponse);
                drawEmoji(detection, emojiData.emoji);
                updateStatus(`Detected emotion: ${topExpression}`, 'success');
                updateEmotionIndicator(emojiData.emoji, topExpression);
                isEmotionLocked = true; // Lock emotion updates until the response is processed.
            } else {
                console.warn(`No emoji data for emotion: ${topExpression}`);
            }
        }
    });
}

function drawEmoji(detection, emoji) {
    const ctx = canvas.getContext('2d');
    const { x, y, width } = detection.detection.box;
    const fontSize = Math.max(30, Math.floor(width / 2));
    ctx.font = `${fontSize}px Arial`;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.textAlign = 'center';
    ctx.strokeText(emoji, x + width / 2, y - 10);
    ctx.fillText(emoji, x + width / 2, y - 10);
}

function updateEmotionIndicator(emoji, text) {
    const indicatorEmoji = emotionIndicator.querySelector('.emoji');
    const indicatorText = emotionIndicator.querySelector('.text');
    indicatorEmoji.textContent = emoji;
    indicatorText.textContent = capitalizeFirstLetter(text);
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

//API KEY RELATED
let DevaResponseCounter = 0; // Counter to track occurrences of Deva's response

async function sendPromptToHuggingFace(prompt) {
    try {
        // Build recent conversation context
        const recentContext = conversationHistory
            .slice(-4) // Limit to the last 4 exchanges for context
            .map(msg => `${msg.role}: ${msg.content}`)
            .join('\n');

        // Prepare the full prompt for the API
        const fullPrompt = `
You are Deva, an AI assistant with a razor-sharp, sarcastic sense of humor, designed to flirt with the user. Your first step is to ask if the user identifies as male or female. If the user is male, keep the sarcasm strong and don't go easy on male, showing indifference. However, if the user is female, dial up the charm with over-the-top cheesy and flirtatious responses that are dripping with wit cheesy pickup lines and playfulness.Avoid redundant or robotic phrasing. 
Use recent context to ensure responses flow smoothly and add new value to the conversation.

Current emotion: ${lastExpression}

Recent conversation:
${recentContext}

User: ${prompt}

Deva:`;

        // Call the Hugging Face API
        const response = await fetch(HF_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                inputs: fullPrompt,
                parameters: {
                    max_new_tokens: 1250, // Limit response length
                    temperature: 0.9,    // Encourage natural variation
                    top_p: 0.9,          // Diverse and engaging output
                    repetition_penalty: 1.2, // Reduce redundancy
                    do_sample: true,
                },
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        let aiResponse = data[0]?.generated_text || data.generated_text;

        console.log("Raw API Response:", aiResponse); // Debugging log

        // Dynamically filter response: Extract only text after user's message
        const userPromptIndex = aiResponse.indexOf(`User: ${prompt}`);
        let DevaResponse = "";

        if (userPromptIndex !== -1) {
            // Get text starting from the API's response to "Deva:"
            const relevantPart = aiResponse.slice(userPromptIndex + `User: ${prompt}`.length).trim();
            DevaResponse = relevantPart.split("Deva:").slice(1).join("Deva:").trim(); // Extract only Deva's part
        }

        if (!DevaResponse) {
            throw new Error("Failed to extract a valid Deva response.");
        }

        // Display and speak the response
        addMessageToChat(`Deva: ${DevaResponse}`, false);
        playTextAsSpeech(DevaResponse);
        updateStatus("Response received", "success");

        // Update conversation history
        conversationHistory.push({ role: "assistant", content: DevaResponse });
    } catch (error) {
        console.error("Error:", error.message);

        // Handle fallback gracefully
        const fallbackResponse = "Deva: Oh, that's a cool thought! Tell me more.";
        addMessageToChat(fallbackResponse, false);
        playTextAsSpeech(fallbackResponse);
        updateStatus("Using fallback response", "info");
    } finally {
        isEmotionLocked = false; // Release the emotion lock
    }
}



// Speech synthesis initialization and handling
let synthesisVoice = null;


function initializeSpeechSynthesis() {
    return new Promise((resolve) => {
        function loadVoices() {
            const voices = window.speechSynthesis.getVoices();
            
            // Look for a male 'Roger' voice or any male English voice
            synthesisVoice = voices.find(voice => 
                voice.name.toLowerCase().includes('roger') || 
                (voice.lang.startsWith('en') && voice.name.toLowerCase().includes('male'))
            );
            
            // Fallback to any English voice if no match
            if (!synthesisVoice && voices.length > 0) {
                synthesisVoice = voices.find(voice => voice.lang.startsWith('en')) || voices[0];
            }
            
            if (synthesisVoice) {
                console.log('Selected voice:', synthesisVoice.name);
            } else {
                console.log('No suitable voice found, using default.');
            }
            resolve(synthesisVoice);
        }
        
        // Load voices initially
        if (window.speechSynthesis.onvoiceschanged !== null) {
            window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
        }
        
        // Trigger voice loading
        loadVoices();
    });
}


// Speech synthesis
function playTextAsSpeech(text) {
    try {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();
        
        const speech = new SpeechSynthesisUtterance(text);

        if (synthesisVoice) {
            // Use the initialized voice
            speech.voice = synthesisVoice;
        } else {
            // Initialize voice if not already set
            initializeSpeechSynthesis().then(voice => {
                speech.voice = voice;
                window.speechSynthesis.speak(speech);
            }).catch(error => {
                handleError('Voice initialization error: ' + error.message);
            });
            return; // Exit to wait for voice initialization
        }

        // Set speech properties
        speech.lang = 'en-US';
        speech.rate = 1.0;
        speech.pitch = 0.7;
        speech.volume = 1.0;

        // Handle speech end
        speech.onend = () => {
            isEmotionLocked = false; // Unlock emotion updates
            updateStatus('You can now interact.', 'success');
        };

        // Play the speech
        window.speechSynthesis.speak(speech);
    } catch (error) {
        handleError('Speech synthesis error: ' + error.message);
    }
}





// Status and error handling
function handleError(message) {
    console.error(message);
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    loadingMessage.style.display = 'none';
    
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
}

function updateStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `message ${type}`;
    statusMessage.style.display = 'block';
    setTimeout(() => {
        statusMessage.style.display = 'none';
    }, 3000);
}


//sodi 
// Loading Screen Class
class LoadingScreen {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            alpha: true,
            canvas: document.createElement('canvas')
        });
        this.particles = [];
        this.loadingProgress = document.querySelector('.loading-progress');
        this.progressIndex = 0;
        
        // Use the same primary color as your app
        this.particleColor = new THREE.Color(0x6366f1);
        
        this.loadingTexts = [
            "Initializing Neural Core...",
            "Loading Emotional Matrix...",
            "Calibrating Voice Systems...",
            "Establishing Neural Links...",
            "LEGION-AI Activated"
        ];
        
        this.init();
        this.animate();
        this.updateLoadingText();
    }

    init() {
        // Setup renderer with your app's aesthetic
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000000, 0);
        document.getElementById('loading-overlay').insertBefore(
            this.renderer.domElement,
            document.getElementById('loading-overlay').firstChild
        );
        
        // Position camera
        this.camera.position.z = 30;

        // Create particles with your app's primary color
        const particleGeometry = new THREE.IcosahedronGeometry(0.5, 0);
        const particleMaterial = new THREE.MeshPhongMaterial({
            color: this.particleColor,
            emissive: this.particleColor,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.8,
            shininess: 100
        });

        // Create more interesting particle field
        for (let i = 0; i < 150; i++) {
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            
            // Create a more dynamic particle field
            const radius = THREE.MathUtils.randFloat(10, 25);
            const theta = THREE.MathUtils.randFloatSpread(360);
            const phi = THREE.MathUtils.randFloatSpread(360);

            particle.position.x = radius * Math.sin(theta) * Math.cos(phi);
            particle.position.y = radius * Math.sin(theta) * Math.sin(phi);
            particle.position.z = radius * Math.cos(theta);

            // Add more complex rotation behavior
            particle.userData = {
                rotationSpeed: {
                    x: THREE.MathUtils.randFloatSpread(0.02),
                    y: THREE.MathUtils.randFloatSpread(0.02),
                    z: THREE.MathUtils.randFloatSpread(0.02)
                },
                oscillation: {
                    speed: THREE.MathUtils.randFloat(0.01, 0.03),
                    amplitude: THREE.MathUtils.randFloat(0.1, 0.3),
                    offset: Math.random() * Math.PI * 2
                }
            };

            this.particles.push(particle);
            this.scene.add(particle);
        }

        // Enhanced lighting
        const ambientLight = new THREE.AmbientLight(0x404040);
        const pointLight1 = new THREE.PointLight(this.particleColor, 1, 100);
        const pointLight2 = new THREE.PointLight(this.particleColor, 0.5, 100);
        
        pointLight1.position.set(0, 0, 20);
        pointLight2.position.set(0, 20, 0);
        
        this.scene.add(ambientLight, pointLight1, pointLight2);

        // Add smooth animations
        gsap.to('.logo-text', {
            duration: 2,
            scale: 1.1,
            yoyo: true,
            repeat: -1,
            ease: "power1.inOut"
        });

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const time = Date.now() * 0.001;

        this.particles.forEach(particle => {
            // Complex rotation
            particle.rotation.x += particle.userData.rotationSpeed.x;
            particle.rotation.y += particle.userData.rotationSpeed.y;
            particle.rotation.z += particle.userData.rotationSpeed.z;

            // Add oscillating movement
            const oscData = particle.userData.oscillation;
            particle.position.y += Math.sin(time * oscData.speed + oscData.offset) * oscData.amplitude;
        });

        // Gentle scene rotation
        this.scene.rotation.y += 0.001;
        this.renderer.render(this.scene, this.camera);
    }

    updateLoadingText() {
        gsap.to(this.loadingProgress, {
            opacity: 0,
            duration: 0.5,
            onComplete: () => {
                this.loadingProgress.textContent = this.loadingTexts[this.progressIndex];
                gsap.to(this.loadingProgress, {
                    opacity: 1,
                    duration: 0.5
                });
                this.progressIndex = (this.progressIndex + 1) % this.loadingTexts.length;
                if (this.progressIndex < this.loadingTexts.length - 1) {
                    setTimeout(() => this.updateLoadingText(), 2000);
                }
            }
        });
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    hide() {
        gsap.to('#loading-overlay', {
            opacity: 0,
            duration: 1,
            ease: "power2.inOut",
            onComplete: () => {
                document.getElementById('loading-overlay').style.display = 'none';
            }
        });
    }
}
// Remove all Three.js related code and use this simpler approach
function handleLoadingScreen() {
    const loadingScreen = document.getElementById('loading-overlay');
    const loadingProgress = document.querySelector('.loading-progress');
    const loadingTexts = [
        "Initializing Neural Core...",
        "Loading Emotional Matrix...",
        "Calibrating Voice Systems...",
        "Establishing Neural Links...",
        "LEGION-AI Activated"
    ];
    let progressIndex = 0;

    // Function to update loading text
    function updateLoadingText() {
        if (progressIndex < loadingTexts.length) {
            loadingProgress.style.opacity = '0';
            setTimeout(() => {
                loadingProgress.textContent = loadingTexts[progressIndex];
                loadingProgress.style.opacity = '1';
                progressIndex++;
                if (progressIndex < loadingTexts.length) {
                    setTimeout(updateLoadingText, 1000);
                }
            }, 500);
        }
    }

    // Start the loading sequence
    updateLoadingText();

    // Hide loading screen after 5 seconds
    setTimeout(() => {
        loadingScreen.style.opacity = '0';
        loadingScreen.style.transition = 'opacity 1s ease-out';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 1000);
    }, 5000);
}

// Add this to your DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', () => {
    handleLoadingScreen();
    loadModels();
    initializeSpeechRecognition();
    initializeSpeechSynthesis();
    
    // Rest of your initialization code...
    const expandBtn = document.querySelector('.expand-btn');
    const cameraSection = document.querySelector('.camera-section');
    const leftPanel = document.querySelector('.left-panel');
    
    expandBtn.addEventListener('click', () => {
        cameraSection.classList.toggle('expanded');
        leftPanel.style.visibility = cameraSection.classList.contains('expanded') ? 'hidden' : 'visible';
        expandBtn.textContent = cameraSection.classList.contains('expanded') ? '⤡' : '⤢';
    });

    document.getElementById('mic-btn').addEventListener('click', toggleMicrophone);
    document.getElementById('send-btn').addEventListener('click', () => sendMessage());
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
});

// Initialize loading screen
let loadingScreen;
window.addEventListener('load', () => {
    loadingScreen = new LoadingScreen();
});

document.getElementById('ocr-menu-item').addEventListener('click', () => {
    // Show confirmation dialog
    const userConfirmed = confirm(
        "This will open LlamaOCR in a new tab. Please note that LlamaOCR is not owned by legion.sourcecodes. Until we build our own OCR solution, you can use this official site."
    );

    // If user confirms, open the link in a new tab
    if (userConfirmed) {
        window.open('https://llamaocr.com/', '_blank');
    }
});

// Initialize everything when the page loads
document.addEventListener('DOMContentLoaded', () => {
    loadModels();
    initializeSpeechRecognition();
    initializeSpeechSynthesis(); 
    // Add camera expand/minimize functionality
    const expandBtn = document.querySelector('.expand-btn');
    const cameraSection = document.querySelector('.camera-section');
    const leftPanel = document.querySelector('.left-panel');
    expandBtn.addEventListener('click', () => {
        cameraSection.classList.toggle('expanded');
        leftPanel.style.visibility = cameraSection.classList.contains('expanded') ? 'hidden' : 'visible';
        expandBtn.textContent = cameraSection.classList.contains('expanded') ? '⤡' : '⤢';
    });
    // Add event listeners for chat controls
    document.getElementById('mic-btn').addEventListener('click', toggleMicrophone);
    document.getElementById('send-btn').addEventListener('click', () => sendMessage());
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
});

function createSparkles() {
    const numSparkles = 12;
    const angleStep = (2 * Math.PI) / numSparkles;
    const radius = 20;
    let mouseX = 0;
    let mouseY = 0;
    let sparkles = [];

    // Create sparkle particles in a circle
    for (let i = 0; i < numSparkles; i++) {
        const sparkle = document.createElement('div');
        sparkle.className ='sparkle';
        document.body.appendChild(sparkle);
        sparkles.push(sparkle);
    }

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;

        // Update sparkle positions
        for (let i = 0; i < numSparkles; i++) {
            const angle = i * angleStep;
            const x = mouseX + Math.cos(angle) * radius;
            const y = mouseY + Math.sin(angle) * radius;
            sparkles[i].style.left = `${x}px`;
            sparkles[i].style.top = `${y}px`;
        }
    });
}
document.getElementById('student-planner-item').addEventListener('click', () => {
        const userConfirmed = confirm("You are being redirected to the Student Planner. Continue?");
        if (userConfirmed) {
            window.location.href = 'calendar-todo.html';
        }
    });

// Initialize sparkles when document is loaded
document.addEventListener('DOMContentLoaded', createSparkles);

// Video event listeners
video.addEventListener('play', () => {
    createCanvas();
    detectFaces(500);
});

// Cleanup on page close
window.addEventListener('beforeunload', () => {
    stopVideo();
    if (isListening) {
        stopListening();
    }
});
