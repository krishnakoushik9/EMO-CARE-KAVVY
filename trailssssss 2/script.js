// Global variables
const video = document.getElementById('video');
const loadingMessage = document.getElementById('loading-message');
const errorMessage = document.getElementById('error-message');
const statusMessage = document.getElementById('status-message');
const emotionIndicator = document.getElementById('emotion-indicator');
let canvas;
let lastDetectionTime = 0;
const emotionDetectionDelay = 2000;
let lastExpression = '';
let isEmotionLocked = false;
let isProcessing = false;
let recognition;
let isListening = false;
let conversationHistory = [];
const maxHistory = 20;
const API_KEY = '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';
const HF_ENDPOINT = 'https://api-inference.huggingface.co/models/mistralai/Mixtral-8x7B-Instruct-v0.1';

// Loading Screen Handler
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

    function updateLoadingText() {
        if (progressIndex < loadingTexts.length) {
            loadingProgress.style.opacity = '0';
            setTimeout(() => {
                loadingProgress.textContent = loadingTexts[progressIndex];
                loadingProgress.style.opacity = '1';
                progressIndex++;
                
                if (progressIndex < loadingTexts.length) {
                    setTimeout(updateLoadingText, 1000);
                } else {
                    setTimeout(() => {
                        loadingScreen.style.opacity = '0';
                        loadingScreen.style.transition = 'opacity 1s ease-out';
                        setTimeout(() => {
                            loadingScreen.style.display = 'none';
                        }, 1000);
                    }, 1000);
                }
            }, 500);
        }
    }

    updateLoadingText();
}

// Throttle Function
function throttle(callback, limit) {
    let inThrottle;
    return function () {
        const context = this;
        const args = arguments;
        if (!inThrottle) {
            callback.apply(context, args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}

// Face Detection
const throttledDetectFaces = throttle(detectFaces, 500);

video.addEventListener('play', () => {
    createCanvas();
    throttledDetectFaces();
});

// Emotion Configuration
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

// Speech Recognition
function initializeSpeechRecognition() {
    if ('webkitSpeechRecognition' in window) {
        recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
            const input = document.getElementById('chat-input');
            let [finalTranscript, interimTranscript] = ['', ''];

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                event.results[i].isFinal ? finalTranscript += transcript : interimTranscript += transcript;
            }

            input.value = finalTranscript + '\u200B' + interimTranscript;
            input.style.color = interimTranscript ? '#666' : '#000';

            if (finalTranscript) {
                sendMessage(finalTranscript);
                input.value = '';
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            stopListening();
            updateStatus(`Speech recognition error: ${event.error}`, 'error');
        };

        recognition.onend = () => isListening && recognition.start();
    } else {
        handleError('Speech recognition not supported in this browser');
    }
}

// Microphone Controls
function toggleMicrophone() {
    if (!recognition) initializeSpeechRecognition();
    isListening ? stopListening() : startListening();
}

function startListening() {
    try {
        recognition.start();
        isListening = true;
        document.getElementById('mic-btn').classList.add('active');
        updateStatus('Listening...', 'info');
    } catch (error) {
        handleError(`Error starting speech recognition: ${error.message}`);
    }
}

function stopListening() {
    try {
        recognition.stop();
        isListening = false;
        document.getElementById('mic-btn').classList.remove('active');
        updateStatus('Stopped listening', 'info');
    } catch (error) {
        handleError(`Error stopping speech recognition: ${error.message}`);
    }
}

// Chat Functions
function addMessageToChat(text, isUser = false) {
    const chatMessages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-bubble ${isUser ? 'user-message' : 'ai-message'}`;
    messageDiv.textContent = text;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    conversationHistory.push({ role: isUser ? 'user' : 'assistant', content: text });
    if (conversationHistory.length > maxHistory * 2) conversationHistory = conversationHistory.slice(-maxHistory * 2);
}

function sendMessage(text = '') {
    const inputElement = document.getElementById('chat-input');
    const message = text || inputElement.value.trim();
    if (message) {
        addMessageToChat(message, true);
        sendPromptToHuggingFace(message);
        inputElement.value = '';
    }
}

// Model Loading
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
    } catch (err) {
        handleError(`Error loading models: ${err.message}`);
    }
}

// Video Handling
async function startVideo() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 720, height: 560, facingMode: 'user' },
            audio: false
        });
        video.srcObject = stream;
        document.getElementById('start-btn').disabled = true;
        document.getElementById('stop-btn').disabled = false;
        updateStatus('Camera initialized!', 'success');
    } catch (err) {
        handleError(`Camera access denied: ${err.message}`);
    }
}

function stopVideo() {
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        document.getElementById('start-btn').disabled = false;
        document.getElementById('stop-btn').disabled = true;
        updateStatus('Camera stopped', 'info');
    }
}

// Canvas Handling
function createCanvas() {
    if (!canvas) {
        canvas = faceapi.createCanvasFromMedia(video);
        Object.assign(canvas.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            pointerEvents: 'none'
        });
        document.querySelector('.video-container').appendChild(canvas);
    }
}

// Face Detection
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

        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        
        if (detections.length === 0) {
            updateStatus('No face detected', 'warning');
            emotionIndicator.querySelector('.emoji').textContent = '😐';
            emotionIndicator.querySelector('.text').textContent = 'No face detected';
        } else {
            const resizedDetections = faceapi.resizeResults(detections, displaySize);
            faceapi.draw.drawDetections(canvas, resizedDetections);
            faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
            faceapi.draw.drawFaceExpressions(canvas, resizedDetections);
            lastDetectionTime = currentTime;
            processExpressions(resizedDetections);
        }
    } catch (err) {
        handleError(`Detection error: ${err.message}`);
    } finally {
        isProcessing = false;
        setTimeout(() => detectFaces(interval), interval);
    }
}

// AI Integration
async function sendPromptToHuggingFace(prompt) {
    try {
        const recentContext = conversationHistory
            .slice(-4)
            .map(msg => `${msg.role}: ${msg.content}`)
            .join('\n');

        const response = await fetch(HF_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                inputs: `
You are Deva, an AI assistant with a razor-sharp, sarcastic sense of humor, designed to flirt with the user. 
Use recent context to ensure responses flow smoothly and add new value to the conversation.

Current emotion: ${lastExpression}
Recent conversation:
${recentContext}
User: ${prompt}
Deva:`,
                parameters: {
                    max_new_tokens: 1250,
                    temperature: 0.9,
                    top_p: 0.9,
                    repetition_penalty: 1.2,
                    do_sample: true,
                },
            }),
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        const aiResponse = data[0]?.generated_text || data.generated_text;
        const devaResponse = extractDevaResponse(aiResponse, prompt);

        addMessageToChat(`Deva: ${devaResponse}`, false);
        playTextAsSpeech(devaResponse);
        updateStatus("Response received", "success");
        conversationHistory.push({ role: "assistant", content: devaResponse });
    } catch (error) {
        console.error("Error:", error.message);
        const fallbackResponse = "Deva: Oh, that's a cool thought! Tell me more.";
        addMessageToChat(fallbackResponse, false);
        playTextAsSpeech(fallbackResponse);
        updateStatus("Using fallback response", "info");
    } finally {
        isEmotionLocked = false;
    }
}

function extractDevaResponse(fullResponse, prompt) {
    const promptIndex = fullResponse.indexOf(`User: ${prompt}`);
    if (promptIndex === -1) return fullResponse;
    
    return fullResponse.slice(promptIndex + `User: ${prompt}`.length)
        .split("Deva:").slice(1).join("Deva:").trim();
}

// Speech Synthesis
let synthesisVoice = null;

function initializeSpeechSynthesis() {
    return new Promise((resolve) => {
        function loadVoices() {
            const voices = window.speechSynthesis.getVoices();
            synthesisVoice = voices.find(v => 
                v.name.toLowerCase().includes('roger') || 
                (v.lang.startsWith('en') && v.name.toLowerCase().includes('male'))
            ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
            resolve(synthesisVoice);
        }
        
        if (window.speechSynthesis.onvoiceschanged !== null) {
            window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
        }
        loadVoices();
    });
}

function playTextAsSpeech(text) {
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(text);
    
    if (synthesisVoice) {
        speech.voice = synthesisVoice;
    } else {
        initializeSpeechSynthesis().then(voice => {
            speech.voice = voice;
            window.speechSynthesis.speak(speech);
        });
        return;
    }

    Object.assign(speech, {
        lang: 'en-US',
        rate: 1.0,
        pitch: 0.7,
        volume: 1.0
    });

    speech.onend = () => {
        isEmotionLocked = false;
        updateStatus('You can now interact.', 'success');
    };

    window.speechSynthesis.speak(speech);
}

// UI Functions
function handleError(message) {
    console.error(message);
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    setTimeout(() => errorMessage.style.display = 'none', 5000);
}

function updateStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `message ${type}`;
    statusMessage.style.display = 'block';
    setTimeout(() => statusMessage.style.display = 'none', 3000);
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    handleLoadingScreen();
    loadModels();
    initializeSpeechRecognition();
    initializeSpeechSynthesis();

    // Camera Expand Functionality
    const expandBtn = document.querySelector('.expand-btn');
    const cameraSection = document.querySelector('.camera-section');

    expandBtn.addEventListener('click', () => {
        const videoContainer = document.querySelector('.video-container');
        const isExpanding = !cameraSection.classList.contains('expanded');

        if (isExpanding) {
            const clone = videoContainer.cloneNode(true);
            clone.classList.add('expanded-overlay');
            document.body.appendChild(clone);

            const closeBtn = document.createElement('button');
            closeBtn.className = 'close-expanded';
            closeBtn.innerHTML = '&times;';
            closeBtn.onclick = () => expandBtn.click();
            clone.appendChild(closeBtn);

            document.querySelector('.app-container').classList.add('blur-background');
        } else {
            document.querySelector('.expanded-overlay')?.remove();
            document.querySelector('.app-container').classList.remove('blur-background');
        }

        cameraSection.classList.toggle('expanded');
        expandBtn.textContent = isExpanding ? '⤡' : '⤢';
        videoContainer.style.visibility = isExpanding ? 'hidden' : 'visible';
    });

    // Event Listeners
    document.getElementById('mic-btn').addEventListener('click', toggleMicrophone);
    document.getElementById('send-btn').addEventListener('click', () => sendMessage());
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
});

// Cleanup
window.addEventListener('beforeunload', () => {
    stopVideo();
    if (isListening) stopListening();
});
