## EMO-CARE Response System

Welcome to the **EMO-CARE Response System**, an interactive AI application designed to respond to your emotions and voice in real-time. This README provides an overview of the project, its setup, and how to use it.

### Overview

The EMO-CARE system utilizes facial recognition and speech recognition technologies to interact with users based on their emotional state. The system captures video input, detects emotions, and generates appropriate responses through a chat interface.

### Features

- **Real-time Emotion Detection**: The application uses facial recognition to analyze the user's emotions and display corresponding emojis and responses.
  
- **Voice Interaction**: Users can communicate with the AI using voice commands, which are transcribed in real-time.
  
- **Chat Interface**: A user-friendly chat interface allows for text-based communication alongside voice interaction.

### Technologies Used

- HTML5
- CSS3
- JavaScript
- Face API for emotion detection
- Web Speech API for voice recognition
- Hugging Face API for generating AI responses

### File Structure

The project consists of two main files:

1. **`index.html`**: The main HTML file that structures the user interface.
2. **`script.js`**: The JavaScript file that contains the logic for emotion detection, speech recognition, and chat functionalities.

### Setup Instructions

1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd emo-care-response-system
   ```

2. **Open `index.html` in a Web Browser**:
   Simply double-click on `index.html` or open it through your preferred web browser.

3. **Ensure Camera Access**:
   The application requires access to your device's camera for emotion detection. Make sure to allow camera permissions when prompted.

### Usage

- **Starting the Application**:
  - Click on the "Start Camera" button to begin video capture.
  
- **Interacting with the AI**:
  - Use the microphone button to start voice input or type directly into the chat input field.
  - The AI will respond based on detected emotions or typed messages.

- **Emotion History**:
  - The system keeps track of your emotional interactions, which can be viewed in the "Emotion History" section.

### Customization

You can customize various aspects of the application by modifying the JavaScript file:

- **Emotion Responses**: Update the `expressionsToEmojiAndPrompt` object in `script.js` to change how the AI responds to different emotions.
  
- **API Key Configuration**: Replace the placeholder API key with your own from Hugging Face if you wish to use a different model for generating responses.

### Troubleshooting

If you encounter issues:

- Ensure your browser supports the Web Speech API and has permissions enabled for microphone and camera access.
  
- Check console logs for any errors related to model loading or speech recognition.

### Contributing

Contributions are welcome! If you have suggestions or improvements, feel free to fork the repository and submit a pull request.

### License

This project is licensed under the MIT License. See the LICENSE file for details.

---

Thank you for using EMO-CARE! We hope this application enhances your interaction experience through emotional awareness and responsive communication.

Citations:
[1] https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/32478100/a0a351f2-22b1-42cf-b33a-ecae8d92d683/paste.txt
[2] https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/32478100/861e97e7-729d-4281-aff3-a3f6e496859c/paste-2.txt
